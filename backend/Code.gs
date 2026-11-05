/**
 * Recipe Cost & Nutrition — Google Sheet backend (Google Apps Script)
 * Version 1.1.0
 *
 * วิธีติดตั้ง: ดูคู่มือ "ตั้งค่า Google Sheet + Apps Script"
 *   1) วางโค้ดนี้ใน Extensions > Apps Script ของ Google Sheet ที่สร้างใหม่
 *   2) รันฟังก์ชัน setup() ครั้งเดียว
 *   3) Deploy เป็น Web app (Execute as: Me, Who has access: Anyone)
 *
 * API (ทุกคำขอที่แตะข้อมูลเป็น POST, ส่ง body เป็น JSON ด้วย Content-Type: text/plain):
 *   GET  <url>                                   -> { ok, apiVersion, serverTime }   (health check, ไม่มีข้อมูล)
 *   POST { token, action: "ping" }               -> { ok, apiVersion, serverTime }
 *   POST { token, action: "pull", since? }       -> { ok, serverTime, data: { Ingredients: [...], ... } }
 *   POST { token, action: "push", changes: [{ table, row }] }
 *                                                -> { ok, serverTime, applied: [...], conflicts: [...] }
 *   POST { token, action: "writeSummary", rows } -> { ok, serverTime, written }
 */

const API_VERSION = 1;
const CODE_VERSION = '1.1.0';

const TABLES = {
  Ingredients: ['id', 'nameTh', 'nameEn', 'category', 'baseUnit', 'packPrice', 'packSize', 'packUnit', 'buyMode',
    'yieldPct', 'gramsPerPiece', 'densityGPerMl', 'kcal', 'protein', 'fat', 'carb', 'sugar', 'fiber', 'satFat',
    'sodiumMg', 'nutritionSource', 'updatedAt', 'deleted'],
  PriceHistory: ['id', 'ingredientId', 'packPrice', 'packSize', 'packUnit', 'store', 'recordedAt', 'updatedAt', 'deleted'],
  Recipes: ['id', 'name', 'category', 'servings', 'servingLabel', 'cookedWeightG', 'batchExtraCost', 'perServeExtraCost',
    'targetFoodCostPct', 'sellPrice', 'notes', 'updatedAt', 'deleted'],
  RecipeItems: ['id', 'recipeId', 'refType', 'refId', 'quantity', 'unit', 'quantityBasis', 'sortOrder', 'updatedAt', 'deleted'],
  Settings: ['key', 'value', 'updatedAt'],
  RecipeSummary: ['recipeId', 'name', 'servings', 'kcalPerServe', 'proteinPerServe', 'carbPerServe', 'fatPerServe',
    'costPerServe', 'suggestedPrice', 'calculatedAt'],
};

/** แท็บที่ sync สองทาง (RecipeSummary แอปเขียนทับอย่างเดียว) */
const SYNC_TABLES = ['Ingredients', 'PriceHistory', 'Recipes', 'RecipeItems', 'Settings'];

/** คอลัมน์ที่ต้องเก็บเป็นข้อความ เพื่อไม่ให้ Sheets แปลงเป็นวันที่/ตัวเลขเอง */
const TEXT_COLS = ['id', 'ingredientId', 'recipeId', 'refId', 'key', 'value', 'updatedAt', 'recordedAt', 'calculatedAt'];

/** คอลัมน์ราคาของวัตถุดิบ: แก้เมื่อไหร่ บันทึกประวัติราคาให้อัตโนมัติ */
const PRICE_COLS = ['packPrice', 'packSize', 'packUnit'];

/** dropdown ของแต่ละคอลัมน์ */
const LISTS = {
  category: ['แป้ง', 'น้ำตาล/ไซรัป', 'นม/เนย', 'ไข่', 'ผัก/ผลไม้', 'เนื้อสัตว์', 'เครื่องปรุง', 'บรรจุภัณฑ์', 'อาหาร', 'ขนม', 'เครื่องดื่ม', 'อื่นๆ'],
  baseUnit: ['g', 'ml'],
  packUnit: ['g', 'kg', 'ml', 'l', 'piece'],
  buyMode: ['pack', 'weight'],
  refType: ['ingredient', 'recipe'],
  unit: ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece'],
  quantityBasis: ['net', 'purchased'],
};

/** ช่วงค่าที่ยอมรับของคอลัมน์ตัวเลข (กันพิมพ์ผิดตอนแก้จากคอมพิวเตอร์) */
const NUMBER_RULES = {
  packPrice: [0, 1e7], packSize: [0.0001, 1e7], yieldPct: [1, 100], gramsPerPiece: [0.0001, 1e6],
  densityGPerMl: [0.01, 30], kcal: [0, 1000], protein: [0, 100], fat: [0, 100], carb: [0, 100],
  sugar: [0, 100], fiber: [0, 100], satFat: [0, 100], sodiumMg: [0, 100000],
  servings: [1, 100000], quantity: [0.0001, 1e7], targetFoodCostPct: [1, 100],
};

// ---------------------------------------------------------------- setup

/** รันครั้งเดียวหลังวางโค้ด: สร้างแท็บ หัวคอลัมน์ dropdown และ token */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABLES).forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const headers = TABLES[name];
    const lastCol = sh.getLastColumn();
    const existing = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].filter(String) : [];
    if (existing.length === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#E3EADB');
      sh.setFrozenRows(1);
    } else {
      const missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
      if (missing.length) {
        // เติมคอลัมน์ที่ขาดต่อท้าย (เช่น อัปเดตโค้ดเวอร์ชันใหม่)
        sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#E3EADB');
      }
    }
    formatColumns_(sh, name);
  });
  // ลบชีตว่างเริ่มต้น (Sheet1 / ชีต1) ถ้าไม่มีข้อมูล
  ['Sheet1', 'ชีต1'].forEach(function (n) {
    const def = ss.getSheetByName(n);
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  });
  const token = getOrCreateToken_();
  console.log('ตั้งค่าเสร็จแล้ว TOKEN ของคุณคือ: ' + token);
  console.log('เก็บ token นี้ไว้ใส่ในแอป และอย่าแชร์ให้ใคร');
  return token;
}

/** สร้าง token ใหม่ (ใช้เมื่อคิดว่า token รั่ว) — token เก่าจะใช้ไม่ได้ทันที */
function resetToken() {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  PropertiesService.getScriptProperties().setProperty('TOKEN', token);
  console.log('TOKEN ใหม่: ' + token);
  return token;
}

/** เมนูใน Google Sheet */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Recipe App')
    .addItem('แสดง token', 'showToken')
    .addItem('ตรวจ/ซ่อมแท็บ (setup)', 'setup')
    .addToUi();
}

function showToken() {
  SpreadsheetApp.getUi().alert('TOKEN ของแอป', getOrCreateToken_(), SpreadsheetApp.getUi().ButtonSet.OK);
}

function getOrCreateToken_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('TOKEN') || resetToken();
}

function formatColumns_(sh, name) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const rows = Math.max(sh.getMaxRows() - 1, 1);
  headers.forEach(function (h, i) {
    if (!h) return;
    const rng = sh.getRange(2, i + 1, rows, 1);
    if (TEXT_COLS.indexOf(h) !== -1) rng.setNumberFormat('@');
    if (h === 'deleted') {
      rng.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    } else if (LISTS[h] && name !== 'Settings') {
      rng.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(LISTS[h], true).setAllowInvalid(false).build());
    } else if (NUMBER_RULES[h]) {
      rng.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireNumberBetween(NUMBER_RULES[h][0], NUMBER_RULES[h][1])
        .setAllowInvalid(false)
        .setHelpText(h + ' ต้องอยู่ระหว่าง ' + NUMBER_RULES[h][0] + ' ถึง ' + NUMBER_RULES[h][1]).build());
    }
  });
}

// ---------------------------------------------------------------- HTTP

function doGet() {
  return handle_(function () {
    return { ok: true, apiVersion: API_VERSION, codeVersion: CODE_VERSION, serverTime: now_() };
  });
}

function doPost(e) {
  return handle_(function () {
    let body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
      throw apiError_('bad_json', 'อ่าน JSON ไม่ได้');
    }
    auth_(body.token);
    const action = body.action || 'ping';
    if (action === 'ping') return { ok: true, apiVersion: API_VERSION, codeVersion: CODE_VERSION, serverTime: now_() };

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw apiError_('busy', 'มีการเขียนข้อมูลอยู่ ลองใหม่อีกครั้ง');
    try {
      if (action === 'pull') return pull_(body.since);
      if (action === 'push') return push_(body.changes);
      if (action === 'writeSummary') return writeSummary_(body.rows);
      throw apiError_('unknown_action', 'ไม่รู้จัก action: ' + action);
    } finally {
      lock.releaseLock();
    }
  });
}

function handle_(fn) {
  let out;
  try {
    out = fn();
  } catch (err) {
    out = { ok: false, error: err.code || 'server_error', message: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function auth_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected) throw apiError_('not_setup', 'ยังไม่ได้รัน setup()');
  if (typeof token !== 'string' || token !== expected) throw apiError_('unauthorized', 'token ไม่ถูกต้อง');
}

function apiError_(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// ---------------------------------------------------------------- actions

/**
 * ดึงแถวที่ updatedAt ใหม่กว่า since (ISO string) ไม่ส่ง since = ทุกแถว
 * แถวที่มีข้อมูลแต่ไม่มี id/updatedAt (เช่น วางข้อมูลจำนวนมาก) จะถูกเติมให้ก่อน
 */
function pull_(since) {
  if (since != null && typeof since !== 'string') throw apiError_('bad_since', 'since ต้องเป็น ISO string');
  const data = {};
  SYNC_TABLES.forEach(function (name) {
    repairRows_(name);
    data[name] = readTable_(name).rows
      .filter(function (r) { return !since || String(r.updatedAt || '') > since; })
      .map(strip_);
  });
  return { ok: true, serverTime: now_(), data: data };
}

/**
 * รับการเปลี่ยนแปลงจากแอป: upsert ตาม key
 * ถ้าแถวใน Sheet ใหม่กว่า (updatedAt มากกว่า) จะไม่เขียนทับ และส่งแถวนั้นกลับใน conflicts
 *
 * v1.1: แถวใหม่ของแต่ละแท็บเขียนลง Sheet ทีเดียวทั้งก้อน (ตั้ง format + เขียนค่า = 2 คำสั่งต่อแท็บ)
 * เดิมเขียนทีละช่อง ทำให้ข้อมูลชุดแรกหลายสิบแถวช้าจนแอปรอไม่ไหว
 */
function push_(changes) {
  if (!Array.isArray(changes)) throw apiError_('bad_changes', 'changes ต้องเป็น array');
  if (changes.length > 500) throw apiError_('too_many', 'ส่งได้ครั้งละไม่เกิน 500 รายการ');
  const tables = {};
  const applied = [];
  const conflicts = [];

  const open = function (name) {
    if (tables[name]) return tables[name];
    const t = readTable_(name);
    const key = keyOf_(name);
    const index = {};
    t.rows.forEach(function (r) { index[String(r[key])] = r; });
    tables[name] = { t: t, key: key, index: index, updates: {}, appends: [] };
    return tables[name];
  };

  changes.forEach(function (c, idx) {
    if (!c || SYNC_TABLES.indexOf(c.table) === -1) throw apiError_('bad_table', 'รายการที่ ' + idx + ': table ไม่ถูกต้อง');
    const key = keyOf_(c.table);
    const row = c.row || {};
    if (row[key] === undefined || row[key] === null || row[key] === '') {
      throw apiError_('missing_key', 'รายการที่ ' + idx + ': ไม่มี ' + key);
    }
    const st = open(c.table);
    const headers = st.t.headers;
    if (!row.updatedAt) row.updatedAt = now_();
    const k = String(row[key]);
    const existing = st.index[k] || null;

    if (existing && String(existing.updatedAt || '') > String(row.updatedAt)) {
      conflicts.push({ table: c.table, row: strip_(existing) });
      return;
    }

    const values = headers.map(function (h) {
      if (!h) return '';
      if (Object.prototype.hasOwnProperty.call(row, h)) return toCell_(h, row[h]);
      return existing ? toCell_(h, existing[h]) : (h === 'deleted' ? false : '');
    });
    const merged = {};
    headers.forEach(function (h, i) { if (h) merged[h] = values[i]; });

    if (existing && existing._row) {
      st.updates[existing._row] = values;
      merged._row = existing._row;
    } else if (existing && existing._append !== undefined) {
      st.appends[existing._append] = values;
      merged._append = existing._append;
    } else {
      merged._append = st.appends.length;
      st.appends.push(values);
    }
    st.index[k] = merged;
    applied.push({ table: c.table, key: k, updatedAt: String(row.updatedAt) });
  });

  Object.keys(tables).forEach(function (name) {
    const st = tables[name];
    const sh = st.t.sh;
    const width = st.t.headers.length;
    Object.keys(st.updates).forEach(function (r) {
      sh.getRange(Number(r), 1, 1, width).setValues([st.updates[r]]);
    });
    if (st.appends.length) {
      const start = nextRow_(st.t);
      const block = sh.getRange(start, 1, st.appends.length, width);
      const fmtRow = st.t.headers.map(function (h) { return TEXT_COLS.indexOf(h) !== -1 ? '@' : 'General'; });
      block.setNumberFormats(st.appends.map(function () { return fmtRow; }));
      block.setValues(st.appends);
    }
  });

  return { ok: true, serverTime: now_(), applied: applied, conflicts: conflicts };
}

/** แอปเขียนสรุปผลทั้งหมดทับแท็บ RecipeSummary (อ่านอย่างเดียวสำหรับคน) */
function writeSummary_(rows) {
  if (!Array.isArray(rows)) throw apiError_('bad_rows', 'rows ต้องเป็น array');
  const sh = sheet_('RecipeSummary');
  const headers = TABLES.RecipeSummary;
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), headers.length)).clearContent();
  if (rows.length) {
    const stamp = now_();
    const values = rows.map(function (r) {
      return headers.map(function (h) {
        if (h === 'calculatedAt') return r.calculatedAt || stamp;
        return r[h] === undefined || r[h] === null ? '' : r[h];
      });
    });
    sh.getRange(2, 1, values.length, headers.length).setValues(values);
  }
  return { ok: true, serverTime: now_(), written: rows.length };
}

// ---------------------------------------------------------------- edits made by hand in the Sheet

/**
 * Simple trigger: ทำงานเมื่อคนแก้ข้อมูลใน Sheet เอง (การเขียนจากแอปไม่ทำให้ฟังก์ชันนี้ทำงาน)
 * - เติม id ให้แถวใหม่ที่ยังไม่มี id
 * - อัปเดต updatedAt ของแถวที่ถูกแก้ แอปจึงรู้ว่าแถวไหนเปลี่ยน
 * - ถ้าแก้ราคาวัตถุดิบ บันทึกแถวใหม่ใน PriceHistory
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const name = sh.getName();
    if (SYNC_TABLES.indexOf(name) === -1) return;
    const r0 = e.range.getRow();
    const n = e.range.getNumRows();
    if (r0 === 1 && n === 1) return; // แก้หัวคอลัมน์
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const uCol = headers.indexOf('updatedAt') + 1;
    if (!uCol) return;
    const c0 = e.range.getColumn();
    const c1 = c0 + e.range.getNumColumns() - 1;
    if (c0 === uCol && c1 === uCol) return; // คนแก้ updatedAt เอง ปล่อยไว้

    const start = Math.max(r0, 2);
    const count = r0 + n - start;
    if (count <= 0) return;

    const stamp = now_();
    const key = keyOf_(name);
    const kCol = headers.indexOf(key) + 1;
    const block = sh.getRange(start, 1, count, headers.length).getValues();
    const editedHeaders = headers.slice(c0 - 1, c1);
    const priceEdited = name === 'Ingredients' && editedHeaders.some(function (h) { return PRICE_COLS.indexOf(h) !== -1; });

    block.forEach(function (row, i) {
      if (!rowHasData_(row, headers)) return;
      const rowNum = start + i;
      setTextFormats_(sh, headers, rowNum);
      let id = row[kCol - 1];
      if (kCol && (id === '' || id === null) && name !== 'Settings') {
        id = Utilities.getUuid();
        sh.getRange(rowNum, kCol).setValue(id);
      }
      sh.getRange(rowNum, uCol).setValue(stamp);
      if (priceEdited) {
        const obj = {};
        headers.forEach(function (h, j) { obj[h] = row[j]; });
        logPrice_(id, obj, stamp);
      }
    });
  } catch (err) {
    console.error('onEdit error: ' + err);
  }
}

function logPrice_(ingredientId, ing, stamp) {
  if (!ingredientId || ing.packPrice === '' || ing.packPrice === null) return;
  const t = readTable_('PriceHistory');
  const rowNum = nextRow_(t);
  const values = t.headers.map(function (h) {
    switch (h) {
      case 'id': return Utilities.getUuid();
      case 'ingredientId': return String(ingredientId);
      case 'packPrice': return ing.packPrice;
      case 'packSize': return ing.packSize;
      case 'packUnit': return ing.packUnit;
      case 'store': return '';
      case 'recordedAt': return stamp.slice(0, 10);
      case 'updatedAt': return stamp;
      case 'deleted': return false;
      default: return '';
    }
  });
  setTextFormats_(t.sh, t.headers, rowNum);
  t.sh.getRange(rowNum, 1, 1, values.length).setValues([values]);
}

// ---------------------------------------------------------------- helpers

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw apiError_('missing_sheet', 'ไม่พบแท็บ ' + name + ' — รัน setup() ก่อน');
  return sh;
}

function keyOf_(name) {
  if (name === 'Settings') return 'key';
  if (name === 'RecipeSummary') return 'recipeId';
  return 'id';
}

/** อ่านทั้งแท็บเป็น object ตามชื่อหัวคอลัมน์ ข้ามแถวที่ไม่มี key */
function readTable_(name) {
  const sh = sheet_(name);
  const lastCol = sh.getLastColumn();
  const headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const key = keyOf_(name);
  if (headers.indexOf(key) === -1) throw apiError_('bad_headers', 'แท็บ ' + name + ' ไม่มีคอลัมน์ ' + key);
  const last = sh.getLastRow();
  const rows = [];
  if (last >= 2) {
    const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
    values.forEach(function (v, i) {
      const obj = {};
      headers.forEach(function (h, j) { if (h) obj[h] = normalize_(h, v[j]); });
      if (obj[key] === '' || obj[key] === null || obj[key] === undefined) return;
      obj._row = i + 2;
      rows.push(obj);
    });
  }
  return { sh: sh, headers: headers, rows: rows, last: last };
}

/** เติม id / updatedAt ให้แถวที่มีข้อมูลแต่ยังไม่มี (กรณีวางข้อมูลก่อนติดตั้ง หรือ onEdit ไม่ทำงาน) */
function repairRows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const kCol = headers.indexOf(keyOf_(name)) + 1;
  const uCol = headers.indexOf('updatedAt') + 1;
  if (!uCol) return;
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  const stamp = now_();
  values.forEach(function (row, i) {
    if (!rowHasData_(row, headers)) return;
    const rowNum = i + 2;
    const needId = kCol && name !== 'Settings' && (row[kCol - 1] === '' || row[kCol - 1] === null);
    const needStamp = row[uCol - 1] === '' || row[uCol - 1] === null;
    if (!needId && !needStamp) return;
    setTextFormats_(sh, headers, rowNum);
    if (needId) sh.getRange(rowNum, kCol).setValue(Utilities.getUuid());
    if (needStamp) sh.getRange(rowNum, uCol).setValue(stamp);
  });
}

function rowHasData_(row, headers) {
  return row.some(function (v, j) {
    const h = headers[j];
    if (h === 'updatedAt' || h === 'deleted') return false;
    return v !== '' && v !== null && v !== false;
  });
}

function findRow_(rows, key, value) {
  const s = String(value);
  for (let i = 0; i < rows.length; i++) if (String(rows[i][key]) === s) return rows[i];
  return null;
}

/** แถวว่างถัดไป (หลังแถวสุดท้ายที่มีข้อมูล) */
function nextRow_(t) {
  let maxRow = 1;
  t.rows.forEach(function (r) { if (r._row > maxRow) maxRow = r._row; });
  const row = Math.max(maxRow, t.sh.getLastRow()) + 1;
  t.last = row;
  return row;
}

function setTextFormats_(sh, headers, rowNum) {
  headers.forEach(function (h, i) {
    if (TEXT_COLS.indexOf(h) !== -1) sh.getRange(rowNum, i + 1).setNumberFormat('@');
  });
}

function normalize_(h, v) {
  if (v instanceof Date) return h === 'recordedAt' ? Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd') : v.toISOString();
  if (h === 'deleted') return v === true || v === 'TRUE' || v === 'true';
  if (TEXT_COLS.indexOf(h) !== -1 && v !== '' && v !== null) return String(v);
  return v;
}

function toCell_(h, v) {
  if (v === undefined || v === null) return h === 'deleted' ? false : '';
  if (h === 'deleted') return v === true || v === 'TRUE' || v === 'true';
  if (TEXT_COLS.indexOf(h) !== -1) return typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function strip_(r) {
  const out = {};
  Object.keys(r).forEach(function (k) { if (k !== '_row') out[k] = r[k]; });
  return out;
}

function now_() {
  return new Date().toISOString();
}
