// Minimal mock of Google Apps Script services to exercise Code.gs logic in Node.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

function makeSheet(name) {
  const grid = []; // grid[r][c], 0-based
  const formats = {};
  const sheet = {
    _grid: grid, _formats: formats,
    getName: () => name,
    getMaxRows: () => 1000,
    getLastRow: () => {
      for (let r = grid.length - 1; r >= 0; r--) if ((grid[r] || []).some(v => v !== '' && v !== undefined && v !== null)) return r + 1;
      return 0;
    },
    getLastColumn: () => {
      let m = 0;
      grid.forEach(row => (row || []).forEach((v, c) => { if (v !== '' && v !== undefined && v !== null) m = Math.max(m, c + 1); }));
      return m;
    },
    setFrozenRows: () => {},
    getRange: (r, c, nr = 1, nc = 1) => makeRange(sheet, r, c, nr, nc),
  };
  return sheet;
}

function makeRange(sheet, r, c, nr, nc) {
  const g = sheet._grid;
  const cell = (rr, cc) => { const row = g[rr - 1] || []; const v = row[cc - 1]; return v === undefined ? '' : v; };
  const set = (rr, cc, v) => {
    while (g.length < rr) g.push([]);
    const fmt = sheet._formats[`${rr},${cc}`];
    // Emulate Sheets auto-parsing ISO-looking strings into Date unless cell is plain text
    if (typeof v === 'string' && fmt !== '@' && /^\d{4}-\d{2}-\d{2}T/.test(v)) v = new Date(v);
    g[rr - 1][cc - 1] = v;
  };
  const range = {
    getSheet: () => sheet,
    getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc,
    getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(cell(r + i, c + j)); out.push(row); } return out; },
    setValues: (vals) => {
      assert.strictEqual(vals.length, nr, 'setValues row count mismatch');
      vals.forEach((row, i) => { assert.strictEqual(row.length, nc, 'setValues col count mismatch'); row.forEach((v, j) => set(r + i, c + j, v)); });
      return range;
    },
    setValue: (v) => { set(r, c, v); return range; },
    setNumberFormats: (rows) => { rows.forEach((row, i) => row.forEach((f, j) => { sheet._formats[`${r + i},${c + j}`] = f; })); return range; },
    setNumberFormat: (f) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sheet._formats[`${r + i},${c + j}`] = f; return range; },
    // Like real Sheets: a checkbox rule turns empty cells into FALSE, which getLastRow() then counts.
    setDataValidation: (rule) => { if (rule && rule.checkbox) for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (cell(r + i, c + j) === '') set(r + i, c + j, false); return range; },
    clearDataValidations: () => range,
    setFontWeight: () => range, setBackground: () => range,
    clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (g[r + i - 1]) g[r + i - 1][c + j - 1] = ''; return range; },
  };
  return range;
}

const sheets = { Sheet1: makeSheet('Sheet1') };
const ss = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = makeSheet(n)),
  deleteSheet: (s) => { delete sheets[s.getName()]; },
  getSheets: () => Object.values(sheets),
};
const dv = () => { const b = {}; ['requireValueInList', 'setAllowInvalid', 'requireNumberBetween', 'setHelpText'].forEach((k) => (b[k] = () => b)); b.requireCheckbox = () => { b._cb = true; return b; }; b.build = () => ({ checkbox: !!b._cb }); return b; };
const props = {};
let uuidN = 0;
const ctx = {
  console: { log: () => {}, error: (m) => { throw new Error('console.error called: ' + m); } },
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, newDataValidation: dv },
  Utilities: {
    getUuid: () => `00000000-0000-4000-8000-${String(++uuidN).padStart(12, '0')}`,
    formatDate: (d) => d.toISOString().slice(0, 10),
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ContentService: { createTextOutput: (s) => ({ _s: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  Date, JSON, Object, Array, String, Math, Number, Error,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), ctx);

const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } })._s);
const sleep = () => { const t = Date.now(); while (Date.now() === t) {} };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS', name); };

// ---- tests
let token;
test('setup creates 6 tabs, removes Sheet1, creates token', () => {
  token = ctx.setup();
  assert.ok(token && token.length >= 32);
  ['Ingredients', 'PriceHistory', 'Recipes', 'RecipeItems', 'Settings', 'RecipeSummary'].forEach(n => assert.ok(sheets[n], n));
  assert.ok(!sheets.Sheet1);
  assert.deepStrictEqual(sheets.Ingredients._grid[0].slice(0, 3), ['id', 'nameTh', 'nameEn']);
});

test('setup is idempotent and keeps token', () => {
  assert.strictEqual(ctx.setup(), token);
});

test('GET health check carries no data', () => {
  const r = JSON.parse(ctx.doGet()._s);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data, undefined);
});

test('wrong token is rejected', () => {
  const r = post({ token: 'nope', action: 'pull' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'unauthorized');
});

test('bad JSON is rejected', () => {
  const r = JSON.parse(ctx.doPost({ postData: { contents: '{bad' } })._s);
  assert.strictEqual(r.error, 'bad_json');
});

const butter = { id: 'ing-butter', nameTh: 'เนยจืด', category: 'นม/เนย', baseUnit: 'g', packPrice: 95, packSize: 200, packUnit: 'g', buyMode: 'pack', yieldPct: 100, kcal: 717, protein: 0.9, fat: 81.1, carb: 0.1, updatedAt: '2026-11-05T10:00:00.000Z', deleted: false };

test('push inserts a new row; updatedAt stays text', () => {
  const r = post({ token, action: 'push', changes: [{ table: 'Ingredients', row: butter }] });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.applied.length, 1);
  const row = sheets.Ingredients._grid[1];
  assert.strictEqual(row[0], 'ing-butter');
  const uIdx = sheets.Ingredients._grid[0].indexOf('updatedAt');
  assert.strictEqual(typeof row[uIdx], 'string', 'updatedAt must not become a Date');
});

test('pull returns the row with same values', () => {
  const r = post({ token, action: 'pull' });
  assert.strictEqual(r.data.Ingredients.length, 1);
  const got = r.data.Ingredients[0];
  assert.strictEqual(got.packPrice, 95);
  assert.strictEqual(got.deleted, false);
  assert.strictEqual(got.updatedAt, butter.updatedAt);
  assert.strictEqual(got._row, undefined);
});

test('push newer update overwrites, partial row keeps other columns', () => {
  const r = post({ token, action: 'push', changes: [{ table: 'Ingredients', row: { id: 'ing-butter', packPrice: 105, updatedAt: '2026-11-05T11:00:00.000Z' } }] });
  assert.strictEqual(r.applied.length, 1);
  const got = post({ token, action: 'pull' }).data.Ingredients[0];
  assert.strictEqual(got.packPrice, 105);
  assert.strictEqual(got.kcal, 717);
  assert.strictEqual(sheets.Ingredients.getLastRow(), 2, 'no duplicate row');
});

test('push older update is a conflict and does not overwrite', () => {
  const r = post({ token, action: 'push', changes: [{ table: 'Ingredients', row: { id: 'ing-butter', packPrice: 1, updatedAt: '2026-11-05T09:00:00.000Z' } }] });
  assert.strictEqual(r.applied.length, 0);
  assert.strictEqual(r.conflicts.length, 1);
  assert.strictEqual(r.conflicts[0].row.packPrice, 105);
});

test('push rejects unknown table and missing key', () => {
  assert.strictEqual(post({ token, action: 'push', changes: [{ table: 'Hack', row: { id: 'x' } }] }).error, 'bad_table');
  assert.strictEqual(post({ token, action: 'push', changes: [{ table: 'Recipes', row: { name: 'x' } }] }).error, 'missing_key');
  assert.strictEqual(post({ token, action: 'push', changes: [{ table: 'RecipeSummary', row: { recipeId: 'x' } }] }).error, 'bad_table');
});

test('multiple changes in one push, Settings keyed by key', () => {
  const r = post({ token, action: 'push', changes: [
    { table: 'Recipes', row: { id: 'rec-1', name: 'ขนมปังกล้วยหอม', servings: 8, servingLabel: 'ชิ้น', updatedAt: '2026-11-05T10:00:00.000Z' } },
    { table: 'RecipeItems', row: { id: 'it-1', recipeId: 'rec-1', refType: 'ingredient', refId: 'ing-butter', quantity: 100, unit: 'g', quantityBasis: 'net', sortOrder: 1, updatedAt: '2026-11-05T10:00:00.000Z' } },
    { table: 'Settings', row: { key: 'defaultFoodCostPct', value: '35', updatedAt: '2026-11-05T10:00:00.000Z' } },
  ] });
  assert.strictEqual(r.applied.length, 3, JSON.stringify(r));
  const d = post({ token, action: 'pull' }).data;
  assert.strictEqual(d.Recipes[0].servings, 8);
  assert.strictEqual(d.RecipeItems[0].refId, 'ing-butter');
  assert.strictEqual(d.Settings[0].value, '35');
});

test('pull since filters older rows', () => {
  const d = post({ token, action: 'pull', since: '2026-11-05T10:30:00.000Z' }).data;
  assert.strictEqual(d.Ingredients.length, 1);
  assert.strictEqual(d.Recipes.length, 0);
});

test('manual price edit in Sheet stamps updatedAt and logs PriceHistory', () => {
  const sh = sheets.Ingredients;
  const head = sh._grid[0];
  const col = head.indexOf('packPrice') + 1;
  sh.getRange(2, col).setValue(99);
  const before = String(sh._grid[1][head.indexOf('updatedAt')]);
  sleep();
  ctx.onEdit({ range: sh.getRange(2, col) });
  const after = sh._grid[1][head.indexOf('updatedAt')];
  assert.strictEqual(typeof after, 'string');
  assert.ok(after > before, 'updatedAt moved forward');
  const ph = post({ token, action: 'pull' }).data.PriceHistory;
  assert.strictEqual(ph.length, 1);
  assert.strictEqual(ph[0].ingredientId, 'ing-butter');
  assert.strictEqual(ph[0].packPrice, 99);
  assert.strictEqual(ph[0].recordedAt.length, 10);
});

test('manual non-price edit does not log PriceHistory', () => {
  const sh = sheets.Ingredients;
  const col = sh._grid[0].indexOf('kcal') + 1;
  sh.getRange(2, col).setValue(720);
  ctx.onEdit({ range: sh.getRange(2, col) });
  assert.strictEqual(post({ token, action: 'pull' }).data.PriceHistory.length, 1);
});

test('manual new row without id gets a uuid', () => {
  const sh = sheets.Ingredients;
  const head = sh._grid[0];
  sh.getRange(3, head.indexOf('nameTh') + 1).setValue('แป้งสาลี');
  ctx.onEdit({ range: sh.getRange(3, head.indexOf('nameTh') + 1) });
  const id = sh._grid[2][0];
  assert.ok(/^0000/.test(id), 'id filled');
  const names = post({ token, action: 'pull' }).data.Ingredients.map(r => r.nameTh);
  assert.deepStrictEqual(names, ['เนยจืด', 'แป้งสาลี']);
});

test('multi-row paste: every row stamped', () => {
  const sh = sheets.Ingredients;
  const nameCol = sh._grid[0].indexOf('nameTh') + 1;
  sh.getRange(4, nameCol, 2, 1).setValues([['น้ำตาล'], ['ไข่ไก่']]);
  ctx.onEdit({ range: sh.getRange(4, nameCol, 2, 1) });
  const rows = post({ token, action: 'pull' }).data.Ingredients;
  assert.strictEqual(rows.length, 4);
  rows.forEach(r => assert.ok(r.id && r.updatedAt, JSON.stringify(r)));
});

test('rows added without onEdit are repaired on pull', () => {
  const sh = sheets.Ingredients;
  sh.getRange(6, sh._grid[0].indexOf('nameTh') + 1).setValue('กล้วยหอม');
  const rows = post({ token, action: 'pull' }).data.Ingredients;
  assert.strictEqual(rows.length, 5);
  assert.ok(rows[4].id && rows[4].updatedAt);
});

test('editing header row is ignored by onEdit', () => {
  const sh = sheets.Ingredients;
  ctx.onEdit({ range: sh.getRange(1, 2) });
});

test('soft delete via push', () => {
  post({ token, action: 'push', changes: [{ table: 'Ingredients', row: { id: 'ing-butter', deleted: true, updatedAt: '2026-11-06T00:00:00.000Z' } }] });
  const b = post({ token, action: 'pull' }).data.Ingredients.find(r => r.id === 'ing-butter');
  assert.strictEqual(b.deleted, true);
});

test('writeSummary replaces all rows', () => {
  let r = post({ token, action: 'writeSummary', rows: [{ recipeId: 'a', name: 'A', servings: 8, costPerServe: 10.92 }, { recipeId: 'b', name: 'B' }] });
  assert.strictEqual(r.written, 2);
  r = post({ token, action: 'writeSummary', rows: [{ recipeId: 'a', name: 'A2' }] });
  assert.strictEqual(sheets.RecipeSummary.getLastRow(), 2);
  assert.strictEqual(sheets.RecipeSummary._grid[1][1], 'A2');
});

test('push batch limit', () => {
  const changes = Array.from({ length: 501 }, (_, i) => ({ table: 'Recipes', row: { id: 'r' + i } }));
  assert.strictEqual(post({ token, action: 'push', changes }).error, 'too_many');
});

test('v1.1 bulk push: 60 new rows + 1 update use a handful of sheet writes, text stays text', () => {
  const sh = sheets.Ingredients;
  const orig = sh.getRange;
  let writes = 0;
  sh.getRange = (...args) => {
    const r = orig(...args);
    const wrap = (fn) => (...a) => { writes++; return fn(...a); };
    r.setValues = wrap(r.setValues); r.setValue = wrap(r.setValue); r.setNumberFormat = wrap(r.setNumberFormat); r.setNumberFormats = wrap(r.setNumberFormats);
    return r;
  };
  const before = sh.getLastRow();
  const changes = Array.from({ length: 60 }, (_, i) => ({ table: 'Ingredients', row: { id: 'bulk-' + i, nameTh: 'วัตถุดิบ ' + i, packPrice: i, updatedAt: '2026-11-07T00:00:00.000Z', deleted: false } }));
  changes.push({ table: 'Ingredients', row: { id: 'ing-butter', packPrice: 150, updatedAt: '2026-11-07T00:00:00.000Z' } });
  changes.push({ table: 'Ingredients', row: { id: 'bulk-3', nameTh: 'แก้ซ้ำในชุดเดียวกัน', updatedAt: '2026-11-07T00:00:01.000Z' } });
  const r = post({ token, action: 'push', changes });
  sh.getRange = orig;
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.applied.length, 62);
  assert.strictEqual(sh.getLastRow(), before + 60, 'one row per new id, no duplicates');
  assert.ok(writes <= 4, 'sheet writes: ' + writes);
  const d = post({ token, action: 'pull', since: '2026-11-06T00:00:00.000Z' }).data.Ingredients;
  assert.strictEqual(d.length, 61);
  const b3 = d.find((x) => x.id === 'bulk-3');
  assert.strictEqual(b3.nameTh, 'แก้ซ้ำในชุดเดียวกัน');
  assert.strictEqual(b3.packPrice, 3, 'second change in the batch keeps fields from the first');
  assert.strictEqual(typeof b3.updatedAt, 'string');
  assert.strictEqual(d.find((x) => x.id === 'ing-butter').packPrice, 150);
});

test('ping reports code version so the app can tell an old deployment', () => {
  assert.strictEqual(post({ token, action: 'ping' }).codeVersion, '1.2.0');
});

test('v1.2 D-07: setup moves rows written after row 1000 (v1.0/v1.1 checkbox bug) back to row 2', () => {
  const sh = sheets.Recipes;
  const head = sh._grid[0];
  // old layout: checkboxes (FALSE) on 999 empty rows, real rows appended at 1001+
  for (let r = 2; r <= 1000; r++) sh.getRange(r, head.indexOf('deleted') + 1).setValue(false);
  const oldRow = (id, name) => head.map((h) => (h === 'id' ? id : h === 'name' ? name : h === 'servings' ? 4 : h === 'updatedAt' ? '2026-11-05T15:00:00.000Z' : h === 'deleted' ? false : ''));
  sh.getRange(1001, 1, 3, head.length).setValues([oldRow('old-a', 'A'), oldRow('old-b', 'B'), oldRow('old-c', 'C')]);
  const keepBefore = post({ token, action: 'pull' }).data.Recipes.length;
  assert.strictEqual(sh.getLastRow(), 1003);
  ctx.setup();
  const ids = post({ token, action: 'pull' }).data.Recipes.map((r) => r.id);
  assert.strictEqual(ids.length, keepBefore, 'no rows lost or duplicated');
  assert.deepStrictEqual(ids.slice(-3), ['old-a', 'old-b', 'old-c']);
  assert.strictEqual(sh.getLastRow(), 1 + keepBefore, 'rows are contiguous from row 2, no FALSE tail');
  // the next push lands right after the data
  post({ token, action: 'push', changes: [{ table: 'Recipes', row: { id: 'new-1', name: 'N', servings: 1, updatedAt: '2026-11-05T16:00:00.000Z' } }] });
  assert.strictEqual(sh.getLastRow(), 2 + keepBefore);
  assert.strictEqual(sh._grid[1 + keepBefore][head.indexOf('id')], 'new-1');
});

test('v1.2: fresh setup → first pushed row is row 2 even though deleted has checkboxes', () => {
  const g = require('./gas-env.cjs').createGasServer();
  g.post(JSON.stringify({ token: g.token, action: 'push', changes: [{ table: 'Ingredients', row: { id: 'x1', nameTh: 'แป้ง', updatedAt: '2026-11-05T16:00:00.000Z' } }] }));
  assert.strictEqual(g.findRow('Ingredients', 'id', 'x1'), 2);
  assert.strictEqual(g.sheets.Ingredients.getLastRow(), 2);
  assert.strictEqual(g.sheets.Ingredients._grid[1][g.sheets.Ingredients._grid[0].indexOf('deleted')], false);
});

console.log(`\n${passed} tests passed`);
