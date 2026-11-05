import { create } from 'zustand';
import { api, ApiError, type ApiConfig } from './api';
import { db, nowIso, type OutboxRow, type SyncTable } from './db';
import * as M from './mapping';
import { getMeta, loadCatalog, onLocalWrite, setMeta } from './repo';
import { Calculator } from '../engine/calc';
import type { SheetRow } from './mapping';

export type SyncState = 'not_configured' | 'idle' | 'syncing' | 'offline' | 'error';

interface SyncStore {
  state: SyncState;
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Rows replaced by a newer version from the Sheet during the last sync (FR-32). */
  conflicts: { table: SyncTable; name: string }[];
  set: (p: Partial<SyncStore>) => void;
}

export const useSync = create<SyncStore>((set) => ({
  state: 'not_configured', pending: 0, lastSyncAt: null, lastError: null, conflicts: [],
  set: (p) => set(p),
}));

const TABLES: SyncTable[] = ['Ingredients', 'PriceHistory', 'Recipes', 'RecipeItems', 'Settings'];
/** Overlap so edits stamped by a slightly-behind clock are not missed; applying a row twice is harmless. */
const PULL_OVERLAP_MS = 5 * 60 * 1000;

export async function getConfig(): Promise<ApiConfig | null> {
  const url = await getMeta<string>('syncUrl', '');
  const token = await getMeta<string>('syncToken', '');
  return url && token ? { url: url.trim(), token: token.trim() } : null;
}

export async function saveConfig(url: string, token: string) {
  await setMeta('syncUrl', url.trim());
  await setMeta('syncToken', token.trim());
  await setMeta('lastPull', '');
}

export async function clearConfig() {
  await setMeta('syncUrl', '');
  await setMeta('syncToken', '');
  useSync.getState().set({ state: 'not_configured' });
}

function localTable(t: SyncTable) {
  switch (t) {
    case 'Ingredients': return db.ingredients;
    case 'PriceHistory': return db.priceHistory;
    case 'Recipes': return db.recipes;
    case 'RecipeItems': return db.recipeItems;
    case 'Settings': return db.settings;
  }
}

function toRow(t: SyncTable, v: unknown): SheetRow {
  switch (t) {
    case 'Ingredients': return M.ingredientToRow(v as never);
    case 'PriceHistory': return M.priceToRow(v as never);
    case 'Recipes': return M.recipeToRow(v as never);
    case 'RecipeItems': return M.itemToRow(v as never);
    case 'Settings': return M.settingToRow(v as never);
  }
}

function fromRow(t: SyncTable, r: SheetRow): { updatedAt: string } & Record<string, unknown> {
  switch (t) {
    case 'Ingredients': return M.rowToIngredient(r) as never;
    case 'PriceHistory': return M.rowToPrice(r) as never;
    case 'Recipes': return M.rowToRecipe(r) as never;
    case 'RecipeItems': return M.rowToItem(r) as never;
    case 'Settings': return M.rowToSetting(r) as never;
  }
}

function displayName(v: Record<string, unknown>): string {
  return String(v.nameTh ?? v.name ?? v.key ?? v.id ?? '');
}

async function refreshPending() {
  useSync.getState().set({ pending: await db.outbox.count() });
}

/** Apply remote rows locally unless the local copy is newer (it will be pushed instead). */
async function applyRemote(t: SyncTable, rows: SheetRow[]) {
  const table = localTable(t) as unknown as import('dexie').Table<Record<string, unknown>, string>;
  const key = M.keyOf(t);
  for (const r of rows) {
    const remote = fromRow(t, r);
    const k = String(remote[key] ?? '');
    if (!k) continue;
    const local = await table.get(k);
    if (local && String(local.updatedAt ?? '') > remote.updatedAt) continue;
    await table.put(remote);
  }
}

let running: Promise<void> | null = null;

/** One full sync: push the outbox, then pull changes, then refresh the summary tab. */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const st = useSync.getState();
    const cfg = await getConfig();
    if (!cfg) { st.set({ state: 'not_configured' }); await refreshPending(); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { st.set({ state: 'offline' }); await refreshPending(); return; }
    st.set({ state: 'syncing', lastError: null });
    try {
      const conflicts = await pushOutbox(cfg);
      await pull(cfg);
      await writeSummary(cfg).catch(() => undefined); // summary is best-effort
      st.set({ state: 'idle', lastSyncAt: nowIso(), conflicts });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'unknown';
      st.set({ state: code === 'network' || code === 'timeout' ? 'offline' : 'error', lastError: code });
    } finally {
      await refreshPending();
    }
  })().finally(() => { running = null; });
  return running;
}

async function pushOutbox(cfg: ApiConfig): Promise<SyncStore['conflicts']> {
  const conflicts: SyncStore['conflicts'] = [];
  // Loop: new writes may land while a batch is in flight.
  for (let round = 0; round < 20; round++) {
    const queued: OutboxRow[] = await db.outbox.orderBy('seq').limit(400).toArray();
    if (!queued.length) break;
    const maxSeq = queued[queued.length - 1].seq!;
    const unique = new Map<string, OutboxRow>();
    queued.forEach((q) => unique.set(`${q.table}|${q.key}`, q));
    const changes: { table: SyncTable; row: SheetRow }[] = [];
    for (const q of unique.values()) {
      const v = await localTable(q.table).get(q.key as never);
      if (v) changes.push({ table: q.table, row: toRow(q.table, v) });
    }
    const res = changes.length ? await api.push(cfg, changes) : { applied: [], conflicts: [] };
    for (const c of res.conflicts) {
      const remote = fromRow(c.table, c.row);
      await (localTable(c.table) as unknown as import('dexie').Table<Record<string, unknown>, string>).put(remote);
      conflicts.push({ table: c.table, name: displayName(remote) });
    }
    // Remove what was sent; entries queued after maxSeq stay for the next round.
    await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
  }
  return conflicts;
}

async function pull(cfg: ApiConfig) {
  const last = await getMeta<string>('lastPull', '');
  const since = last ? new Date(Date.parse(last) - PULL_OVERLAP_MS).toISOString() : undefined;
  const res = await api.pull(cfg, since);
  await db.transaction('rw', [db.ingredients, db.priceHistory, db.recipes, db.recipeItems, db.settings], async () => {
    for (const t of TABLES) await applyRemote(t, res.data[t] ?? []);
  });
  await setMeta('lastPull', res.serverTime);
}

async function writeSummary(cfg: ApiConfig) {
  const cat = await loadCatalog();
  const calc = new Calculator(cat);
  const rows = [...cat.recipes.values()].filter((r) => !r.deleted).map((r) => {
    const res = calc.evaluate(r.id)!;
    const ps = res.perServe;
    const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
    return {
      recipeId: r.id, name: r.name, servings: r.servings,
      kcalPerServe: round(ps.nutrients.kcal, 0), proteinPerServe: round(ps.nutrients.protein, 1),
      carbPerServe: round(ps.nutrients.carb, 1), fatPerServe: round(ps.nutrients.fat, 1),
      costPerServe: res.costComplete ? round(ps.costSatang / 100, 2) : '',
      suggestedPrice: res.costComplete ? round(res.suggestedPriceSatang / 100, 2) : '',
    };
  });
  await api.writeSummary(cfg, rows);
}

let debounce: ReturnType<typeof setTimeout> | null = null;

/** Start background sync: on launch, after local writes, when back online, and every 5 minutes while visible. */
export function startSync() {
  void refreshPending();
  void syncNow();
  onLocalWrite(() => {
    void refreshPending();
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), 1500);
  });
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => useSync.getState().set({ state: 'offline' }));
  setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow(); });
}
