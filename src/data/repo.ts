import { db, newId, nowIso, type PriceHistoryRow, type SyncTable } from './db';
import { DEFAULT_KITCHEN } from '../engine/types';
import type { Catalog, Ingredient, KitchenSettings, Recipe, RecipeItem } from '../engine/types';

type Listener = () => void;
const listeners = new Set<Listener>();
/** Sync service subscribes here to push soon after any local write. */
export function onLocalWrite(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

async function enqueue(table: SyncTable, key: string) {
  await db.outbox.add({ table, key, queuedAt: nowIso() });
}

// ---------------------------------------------------------------- ingredients

export async function saveIngredient(input: Omit<Ingredient, 'updatedAt' | 'id'> & { id?: string }, store?: string): Promise<Ingredient> {
  const now = nowIso();
  const ing: Ingredient = { ...input, id: input.id ?? newId(), updatedAt: now };
  await db.transaction('rw', db.ingredients, db.priceHistory, db.outbox, async () => {
    const prev = await db.ingredients.get(ing.id);
    await db.ingredients.put(ing);
    await enqueue('Ingredients', ing.id);
    const priceChanged = ing.packPrice !== null && (!prev || prev.packPrice !== ing.packPrice || prev.packSize !== ing.packSize || prev.packUnit !== ing.packUnit);
    if (priceChanged) {
      const ph: PriceHistoryRow = {
        id: newId(), ingredientId: ing.id, packPrice: ing.packPrice!, packSize: ing.packSize, packUnit: ing.packUnit,
        store, recordedAt: now.slice(0, 10), updatedAt: now,
      };
      await db.priceHistory.put(ph);
      await enqueue('PriceHistory', ph.id);
    }
  });
  notify();
  return ing;
}

export async function deleteIngredient(id: string) {
  const ing = await db.ingredients.get(id);
  if (!ing) return;
  await db.transaction('rw', db.ingredients, db.outbox, async () => {
    await db.ingredients.put({ ...ing, deleted: true, updatedAt: nowIso() });
    await enqueue('Ingredients', id);
  });
  notify();
}

/** Recipes that use this ingredient (for "ใช้อยู่ใน N สูตร" and safe-delete warnings). */
export async function recipesUsing(refId: string): Promise<string[]> {
  const items = await db.recipeItems.where('refId').equals(refId).toArray();
  return [...new Set(items.filter((i) => !i.deleted).map((i) => i.recipeId))];
}

// ---------------------------------------------------------------- recipes

export async function saveRecipe(input: Omit<Recipe, 'updatedAt' | 'id'> & { id?: string }): Promise<Recipe> {
  const r: Recipe = { ...input, id: input.id ?? newId(), updatedAt: nowIso() };
  await db.transaction('rw', db.recipes, db.outbox, async () => {
    await db.recipes.put(r);
    await enqueue('Recipes', r.id);
  });
  notify();
  return r;
}

/**
 * Change some fields of a recipe, reading the latest stored row inside the transaction.
 * D-02: saving a stale copy from the screen lost fields edited a moment earlier.
 */
export async function patchRecipe(id: string, patch: Partial<Recipe>): Promise<Recipe | null> {
  let out: Recipe | null = null;
  await db.transaction('rw', db.recipes, db.outbox, async () => {
    const cur = await db.recipes.get(id);
    if (!cur) return;
    out = { ...cur, ...patch, id, updatedAt: nowIso() };
    await db.recipes.put(out);
    await enqueue('Recipes', id);
  });
  notify();
  return out;
}

export async function deleteRecipe(id: string) {
  const r = await db.recipes.get(id);
  if (!r) return;
  const now = nowIso();
  await db.transaction('rw', db.recipes, db.recipeItems, db.outbox, async () => {
    await db.recipes.put({ ...r, deleted: true, updatedAt: now });
    await enqueue('Recipes', id);
    const items = await db.recipeItems.where('recipeId').equals(id).toArray();
    for (const it of items.filter((i) => !i.deleted)) {
      await db.recipeItems.put({ ...it, deleted: true, updatedAt: now });
      await enqueue('RecipeItems', it.id);
    }
  });
  notify();
}

/** Copy a recipe with all items. With `factor`, quantities are scaled (FR-14 "บันทึกเป็นสูตรใหม่"). */
export async function duplicateRecipe(id: string, opts: { name: string; servings?: number; factor?: number }): Promise<Recipe | null> {
  const r = await db.recipes.get(id);
  if (!r) return null;
  const items = (await db.recipeItems.where('recipeId').equals(id).toArray()).filter((i) => !i.deleted);
  const now = nowIso();
  const copy: Recipe = { ...r, id: newId(), name: opts.name, servings: opts.servings ?? r.servings, updatedAt: now, deleted: false };
  await db.transaction('rw', db.recipes, db.recipeItems, db.outbox, async () => {
    await db.recipes.put(copy);
    await enqueue('Recipes', copy.id);
    for (const it of items) {
      const ni: RecipeItem = { ...it, id: newId(), recipeId: copy.id, quantity: it.quantity * (opts.factor ?? 1), updatedAt: now };
      await db.recipeItems.put(ni);
      await enqueue('RecipeItems', ni.id);
    }
  });
  notify();
  return copy;
}

export async function saveItem(input: Omit<RecipeItem, 'updatedAt' | 'id'> & { id?: string }): Promise<RecipeItem> {
  const it: RecipeItem = { ...input, id: input.id ?? newId(), updatedAt: nowIso() };
  await db.transaction('rw', db.recipeItems, db.outbox, async () => {
    await db.recipeItems.put(it);
    await enqueue('RecipeItems', it.id);
  });
  notify();
  return it;
}

export async function deleteItem(id: string): Promise<RecipeItem | undefined> {
  const it = await db.recipeItems.get(id);
  if (!it) return;
  await db.transaction('rw', db.recipeItems, db.outbox, async () => {
    await db.recipeItems.put({ ...it, deleted: true, updatedAt: nowIso() });
    await enqueue('RecipeItems', id);
  });
  notify();
  return it;
}

export async function restoreItem(it: RecipeItem) {
  return saveItem({ ...it, deleted: false });
}

// ---------------------------------------------------------------- settings (synced to the Sheet)

const KITCHEN_KEYS = ['defaultFoodCostPct', 'tspMl', 'tbspMl', 'cupMl'] as const;

export async function getKitchenSettings(): Promise<KitchenSettings> {
  const rows = await db.settings.toArray();
  const out: KitchenSettings = { ...DEFAULT_KITCHEN };
  for (const r of rows) {
    if ((KITCHEN_KEYS as readonly string[]).includes(r.key)) {
      const n = Number(r.value);
      if (Number.isFinite(n) && n > 0) (out as unknown as Record<string, number>)[r.key] = n;
    }
  }
  return out;
}

export async function setKitchenSetting(key: (typeof KITCHEN_KEYS)[number], value: number) {
  await db.transaction('rw', db.settings, db.outbox, async () => {
    await db.settings.put({ key, value: String(value), updatedAt: nowIso() });
    await enqueue('Settings', key);
  });
  notify();
}

// ---------------------------------------------------------------- local-only preferences

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const r = await db.meta.get(key);
  return r ? (r.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

// ---------------------------------------------------------------- catalog for the engine

export function buildCatalog(ingredients: Ingredient[], recipes: Recipe[], items: RecipeItem[], settings: KitchenSettings): Catalog {
  const itemsByRecipe = new Map<string, RecipeItem[]>();
  for (const it of items) {
    if (it.deleted) continue;
    const arr = itemsByRecipe.get(it.recipeId) ?? [];
    arr.push(it);
    itemsByRecipe.set(it.recipeId, arr);
  }
  return {
    ingredients: new Map(ingredients.map((i) => [i.id, i])),
    recipes: new Map(recipes.map((r) => [r.id, r])),
    itemsByRecipe,
    settings,
  };
}

export async function loadCatalog(): Promise<Catalog> {
  const [ingredients, recipes, items, settings] = await Promise.all([
    db.ingredients.toArray(), db.recipes.toArray(), db.recipeItems.toArray(), getKitchenSettings(),
  ]);
  return buildCatalog(ingredients, recipes, items, settings);
}
