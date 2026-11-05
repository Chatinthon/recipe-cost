// Minimal in-memory emulation of the Google Apps Script services Code.gs uses.
// Lets us run the real backend code in Node: backend tests and app sync tests both use it.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function makeSheet(name) {
  const grid = [];
  const formats = {};
  const sheet = {
    _grid: grid, _formats: formats,
    getName: () => name,
    getMaxRows: () => 1000,
    getLastRow: () => {
      for (let r = grid.length - 1; r >= 0; r--) if ((grid[r] || []).some((v) => v !== '' && v !== undefined && v !== null)) return r + 1;
      return 0;
    },
    getLastColumn: () => {
      let m = 0;
      grid.forEach((row) => (row || []).forEach((v, c) => { if (v !== '' && v !== undefined && v !== null) m = Math.max(m, c + 1); }));
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
    // Real Sheets parse ISO-looking strings into dates unless the cell is plain text.
    if (typeof v === 'string' && fmt !== '@' && /^\d{4}-\d{2}-\d{2}T/.test(v)) v = new Date(v);
    g[rr - 1][cc - 1] = v;
  };
  const range = {
    getSheet: () => sheet,
    getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc,
    getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(cell(r + i, c + j)); out.push(row); } return out; },
    setValues: (vals) => {
      if (vals.length !== nr) throw new Error('setValues row count mismatch');
      vals.forEach((row, i) => { if (row.length !== nc) throw new Error('setValues col count mismatch'); row.forEach((v, j) => set(r + i, c + j, v)); });
      return range;
    },
    setValue: (v) => { set(r, c, v); return range; },
    setNumberFormats: (rows) => { rows.forEach((row, i) => row.forEach((f, j) => { sheet._formats[`${r + i},${c + j}`] = f; })); return range; },
    setNumberFormat: (f) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sheet._formats[`${r + i},${c + j}`] = f; return range; },
    setDataValidation: () => range,
    setFontWeight: () => range, setBackground: () => range,
    clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (g[r + i - 1]) g[r + i - 1][c + j - 1] = ''; return range; },
  };
  return range;
}

function createGasServer() {
  const sheets = { Sheet1: makeSheet('Sheet1') };
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
    deleteSheet: (s) => { delete sheets[s.getName()]; },
    getSheets: () => Object.values(sheets),
  };
  const dv = () => { const b = {}; ['requireCheckbox', 'requireValueInList', 'setAllowInvalid', 'requireNumberBetween', 'setHelpText'].forEach((k) => (b[k] = () => b)); b.build = () => ({}); return b; };
  const props = {};
  let uuidN = 0;
  const ctx = {
    console: { log: () => {}, error: (m) => { throw new Error('console.error called: ' + m); } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, newDataValidation: dv },
    Utilities: {
      getUuid: () => `00000000-0000-4000-8000-${String(++uuidN).padStart(12, '0')}`,
      formatDate: (d) => d.toISOString().slice(0, 10),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ContentService: { createTextOutput: (s) => ({ _s: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Date, JSON, Object, Array, String, Math, Number, Error,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), ctx);
  const token = ctx.setup();
  return {
    ctx, sheets, token,
    /** Same contract as an HTTP POST to the Web App: body string in, parsed JSON out. */
    post: (body) => JSON.parse(ctx.doPost({ postData: { contents: body } })._s),
    get: () => JSON.parse(ctx.doGet()._s),
    /** Simulate a person typing into a cell. */
    edit: (sheetName, row, col, value) => {
      const sh = sheets[sheetName];
      const c = typeof col === 'number' ? col : sh._grid[0].indexOf(col) + 1;
      sh.getRange(row, c).setValue(value);
      ctx.onEdit({ range: sh.getRange(row, c) });
    },
    findRow: (sheetName, key, value) => {
      const sh = sheets[sheetName];
      const k = sh._grid[0].indexOf(key);
      const i = sh._grid.findIndex((r, idx) => idx > 0 && r && String(r[k]) === String(value));
      return i === -1 ? -1 : i + 1;
    },
  };
}

module.exports = { createGasServer };
