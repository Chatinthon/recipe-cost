// End-to-end sync tests: the app's data layer against the real Code.gs running in an emulated Apps Script.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { resetDbForTests } from './db';
import { setTransport } from './api';
import { saveConfig, syncNow, useSync } from './sync';
import * as repo from './repo';
import { Calculator } from '../engine/calc';

const require = createRequire(import.meta.url);
const { createGasServer } = require('../../backend/test/gas-env.cjs');

type Server = ReturnType<typeof createGasServer>;
let server: Server;
let n = 0;
let online = true;

beforeEach(async () => {
  server = createGasServer();
  online = true;
  const db = resetDbForTests('t' + ++n);
  await db.open();
  setTransport(async (_url, body) => {
    if (!online) throw new TypeError('Failed to fetch');
    return server.post(body);
  });
  await saveConfig('https://script.google.com/macros/s/TEST/exec', server.token);
  useSync.getState().set({ state: 'idle', conflicts: [], lastError: null });
});

const butter = () => ({
  nameTh: 'เนยจืด', baseUnit: 'g' as const, packPrice: 9500, packSize: 200, packUnit: 'g' as const, buyMode: 'pack' as const,
  yieldPct: 100, nutrition: { kcal: 717, protein: 0.9, fat: 81.1, carb: 0.1 },
});

describe('push', () => {
  it('local ingredient reaches the Sheet in baht, with a PriceHistory row', async () => {
    const ing = await repo.saveIngredient(butter());
    await syncNow();
    const sh = server.sheets.Ingredients;
    const row = server.findRow('Ingredients', 'id', ing.id);
    expect(row).toBeGreaterThan(1);
    const head = sh._grid[0];
    expect(sh._grid[row - 1][head.indexOf('packPrice')]).toBe(95);
    expect(sh._grid[row - 1][head.indexOf('nameTh')]).toBe('เนยจืด');
    expect(server.sheets.PriceHistory.getLastRow()).toBe(2);
    expect(useSync.getState().state).toBe('idle');
    expect(useSync.getState().pending).toBe(0);
  });

  it('recipe summary tab is written after sync', async () => {
    const ing = await repo.saveIngredient(butter());
    const r = await repo.saveRecipe({ name: 'ขนม', servings: 4, servingLabel: 'ชิ้น', batchExtraCost: 0, perServeExtraCost: 0 });
    await repo.saveItem({ recipeId: r.id, refType: 'ingredient', refId: ing.id, quantity: 100, unit: 'g', quantityBasis: 'net', sortOrder: 1 });
    await syncNow();
    const s = server.sheets.RecipeSummary;
    const head = s._grid[0];
    expect(s._grid[1][head.indexOf('name')]).toBe('ขนม');
    expect(s._grid[1][head.indexOf('kcalPerServe')]).toBe(179); // 717 / 4
    expect(s._grid[1][head.indexOf('costPerServe')]).toBe(11.88); // 47.50 / 4 = 11.875 → 11.88
  });
});

describe('pull — AC-09 edit on a computer', () => {
  it('price edited in the Sheet updates the app and every recipe using it', async () => {
    const ing = await repo.saveIngredient(butter());
    const r = await repo.saveRecipe({ name: 'ขนม', servings: 1, servingLabel: 'ชิ้น', batchExtraCost: 0, perServeExtraCost: 0 });
    await repo.saveItem({ recipeId: r.id, refType: 'ingredient', refId: ing.id, quantity: 100, unit: 'g', quantityBasis: 'net', sortOrder: 1 });
    await syncNow();

    await new Promise((res) => setTimeout(res, 5));
    const row = server.findRow('Ingredients', 'id', ing.id);
    server.edit('Ingredients', row, 'packPrice', 105);
    await syncNow();

    const local = await repo.loadCatalog();
    expect(local.ingredients.get(ing.id)!.packPrice).toBe(10500);
    const res = new Calculator(local).evaluate(r.id)!;
    expect(Math.round(res.perServe.costSatang)).toBe(5250);
    // the Sheet logged the manual price change too
    expect(server.sheets.PriceHistory.getLastRow()).toBe(3);
  });

  it('a row typed into the Sheet by hand appears in the app', async () => {
    server.edit('Ingredients', 2, 'nameTh', 'อกไก่');
    server.edit('Ingredients', 2, 'kcal', 120);
    await syncNow();
    const cat = await repo.loadCatalog();
    const names = [...cat.ingredients.values()].map((i) => i.nameTh);
    expect(names).toContain('อกไก่');
  });

  it('soft delete in the Sheet is applied in the app', async () => {
    const ing = await repo.saveIngredient(butter());
    await syncNow();
    await new Promise((res) => setTimeout(res, 5));
    server.edit('Ingredients', server.findRow('Ingredients', 'id', ing.id), 'deleted', true);
    await syncNow();
    const cat = await repo.loadCatalog();
    expect(cat.ingredients.get(ing.id)!.deleted).toBe(true);
  });
});

describe('offline queue — AC-10', () => {
  it('writes made offline wait in the outbox and go up when back online', async () => {
    online = false;
    const ing = await repo.saveIngredient(butter());
    await syncNow();
    expect(useSync.getState().state).toBe('offline');
    expect(useSync.getState().pending).toBe(2); // ingredient + price history
    expect(server.findRow('Ingredients', 'id', ing.id)).toBe(-1);

    online = true;
    await syncNow();
    expect(useSync.getState().pending).toBe(0);
    expect(server.findRow('Ingredients', 'id', ing.id)).toBeGreaterThan(1);
  });
});

describe('conflict — AC-11', () => {
  it('newer edit in the Sheet wins over an older offline edit, and is reported', async () => {
    const ing = await repo.saveIngredient(butter());
    await syncNow();

    online = false;
    await repo.saveIngredient({ ...ing, packPrice: 9900 }); // offline edit, older
    await new Promise((res) => setTimeout(res, 5));
    server.edit('Ingredients', server.findRow('Ingredients', 'id', ing.id), 'packPrice', 120); // newer, on the computer

    online = true;
    await syncNow();
    const cat = await repo.loadCatalog();
    expect(cat.ingredients.get(ing.id)!.packPrice).toBe(12000);
    expect(useSync.getState().conflicts.map((c) => c.name)).toContain('เนยจืด');
  });
});

describe('errors', () => {
  it('wrong token → error state, data kept locally', async () => {
    await saveConfig('https://script.google.com/macros/s/TEST/exec', 'wrong');
    await repo.saveIngredient(butter());
    await syncNow();
    expect(useSync.getState().state).toBe('error');
    expect(useSync.getState().lastError).toBe('unauthorized');
    expect(useSync.getState().pending).toBe(2);
  });

  it('URL that is not an Apps Script URL is refused before any request', async () => {
    let called = false;
    setTransport(async () => { called = true; return {}; });
    await saveConfig('https://evil.example.com/exec', server.token);
    await syncNow();
    expect(called).toBe(false);
    expect(useSync.getState().lastError).toBe('bad_url');
  });

  it('not configured → nothing sent, app still works', async () => {
    await saveConfig('', '');
    await repo.saveIngredient(butter());
    await syncNow();
    expect(useSync.getState().state).toBe('not_configured');
  });
});

describe('settings sync', () => {
  it('food cost default goes to the Settings tab and comes back on a fresh device', async () => {
    await repo.setKitchenSetting('defaultFoodCostPct', 40);
    await syncNow();
    // second device: new empty DB, same server
    const db2 = resetDbForTests('device2-' + n);
    await db2.open();
    await saveConfig('https://script.google.com/macros/s/TEST/exec', server.token);
    await syncNow();
    expect((await repo.getKitchenSettings()).defaultFoodCostPct).toBe(40);
  });
});

describe('D-02 regression: quick consecutive field edits', () => {
  it('patchRecipe keeps fields saved a moment earlier', async () => {
    const r = await repo.saveRecipe({ name: 'x', servings: 8, servingLabel: 'ชิ้น', batchExtraCost: 0, perServeExtraCost: 0 });
    await Promise.all([repo.patchRecipe(r.id, { batchExtraCost: 800 }), repo.patchRecipe(r.id, { perServeExtraCost: 300 }), repo.patchRecipe(r.id, { targetFoodCostPct: 40 })]);
    const cat = await repo.loadCatalog();
    const got = cat.recipes.get(r.id)!;
    expect([got.batchExtraCost, got.perServeExtraCost, got.targetFoodCostPct]).toEqual([800, 300, 40]);
  });
});
