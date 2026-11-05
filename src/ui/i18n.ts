import { create } from 'zustand';

export type Lang = 'th' | 'en';
export type Theme = 'system' | 'light' | 'dark';

const read = <T extends string>(k: string, d: T): T => {
  try { return (localStorage.getItem(k) as T) || d; } catch { return d; }
};
const write = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
};

interface Prefs {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
}

export const usePrefs = create<Prefs>((set) => ({
  lang: read<Lang>('rc.lang', 'th'),
  theme: read<Theme>('rc.theme', 'system'),
  setLang: (lang) => { write('rc.lang', lang); document.documentElement.lang = lang; set({ lang }); },
  setTheme: (theme) => { write('rc.theme', theme); applyTheme(theme); set({ theme }); },
}));

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111410' : '#F5F7F1');
}

const th = {
  appName: 'Recipe Cost & Nutrition',
  hello: 'สวัสดีครับ',
  myRecipes: 'สูตรของฉัน',
  recipes: 'สูตร', ingredients: 'วัตถุดิบ', settings: 'ตั้งค่า',
  searchRecipe: 'ค้นหาสูตร หรือวัตถุดิบ', searchIngredient: 'ค้นหาวัตถุดิบ',
  all: 'ทั้งหมด', newRecipe: 'สูตรใหม่', newIngredient: 'วัตถุดิบใหม่',
  noRecipes: 'ยังไม่มีสูตร', noRecipesHint: 'สร้างสูตรแรก แล้วเพิ่มวัตถุดิบเพื่อดู kcal และต้นทุนต่อ serve',
  noIngredients: 'ยังไม่มีวัตถุดิบ', noIngredientsHint: 'เพิ่มเอง หรือนำเข้าชุดวัตถุดิบตั้งต้นจาก USDA',
  createFirstRecipe: 'สร้างสูตรแรก', importStarter: 'นำเข้าชุดวัตถุดิบตั้งต้น',
  itemsCount: '{n} วัตถุดิบ', perServe: 'ต่อ 1 {label}', per: '/ {label}',
  missingPrice: 'ขาดราคา {n} รายการ', incomplete: 'ผลยังไม่ครบ',
  back: 'กลับ', more: 'ตัวเลือกเพิ่มเติม', save: 'บันทึก', cancel: 'ยกเลิก', delete: 'ลบ', undo: 'เลิกทำ', done: 'เสร็จ', close: 'ปิด', add: 'เพิ่ม',
  editRecipe: 'แก้ไขสูตร', recipeName: 'ชื่อสูตร', makesPerBatch: 'ทำ 1 ครั้งได้', servingUnit: 'หน่วย', decrease: 'ลด', increase: 'เพิ่ม',
  category: 'หมวด', totalCost: 'ต้นทุนรวม', addIngredient: 'เพิ่มวัตถุดิบ', viewDetail: 'ดูผลละเอียด', cost: 'ต้นทุน',
  extras: 'ต้นทุนเพิ่มเติม & ราคาขาย', cookedWeight: 'น้ำหนักหลังปรุง (g)', cookedWeightHint: 'ไม่ใส่ก็ได้ ใช้คิดค่าต่อ 100 g',
  batchExtra: 'ต้นทุนแฝงต่อการทำ 1 ครั้ง (฿)', batchExtraHint: 'เช่น ค่าแก๊ส ค่าไฟ', perServeExtra: 'ต้นทุนแฝงต่อ serve (฿)', perServeExtraHint: 'เช่น กล่อง สติ๊กเกอร์',
  targetFoodCost: 'food cost เป้าหมาย (%)', targetFoodCostHint: 'ว่าง = ใช้ค่าในตั้งค่า ({n}%)', sellPrice: 'ราคาขายจริง (฿ / serve)', notes: 'วิธีทำ / โน้ต',
  duplicate: 'คัดลอกสูตร', deleteRecipe: 'ลบสูตร', confirmDeleteRecipe: 'ลบสูตร "{name}"?', copyOf: '{name} (สำเนา)',
  removed: 'ลบ {name} แล้ว', dragHint: 'ปัดซ้ายเพื่อลบ',
  // add ingredient sheet
  pickIngredient: 'เลือกวัตถุดิบ', fromRecipes: 'สูตรอื่น (ใช้เป็นวัตถุดิบ)', createNew: 'สร้างใหม่ "{q}"', createNewPlain: 'สร้างวัตถุดิบใหม่',
  quantity: 'ปริมาณ', unit: 'หน่วย', basisNet: 'น้ำหนักสุทธิ', basisPurchased: 'น้ำหนักที่ซื้อ', basisHint: 'สุทธิ = หลังปอก/ตัดแต่ง',
  cycleError: 'ใช้สูตรนี้ไม่ได้ เพราะจะอ้างวนกลับมาที่สูตรเดิม', editItem: 'แก้ปริมาณ', removeItem: 'เอาออกจากสูตร', subRecipe: 'สูตรย่อย',
  // units
  u_g: 'g', u_kg: 'kg', u_mg: 'mg', u_ml: 'ml', u_l: 'l', u_tsp: 'ช้อนชา', u_tbsp: 'ช้อนโต๊ะ', u_cup: 'ถ้วย', u_piece: 'ชิ้น/ฟอง',
  // result
  nutrition: 'โภชนาการ', costTab: 'ต้นทุน', perServeShort: 'ต่อ serve', per100g: 'ต่อ 100 g', wholeRecipe: 'ทั้งสูตร',
  energy: 'พลังงาน', protein: 'โปรตีน', carb: 'คาร์บ', fat: 'ไขมัน', sugar: 'น้ำตาล', fiber: 'ใยอาหาร', satFat: 'ไขมันอิ่มตัว', sodium: 'โซเดียม',
  energyFrom: 'สัดส่วนพลังงาน', costPerServe: 'ต้นทุน / {label}', wholeBatch: 'รวมทั้งสูตร {v}', suggestedPrice: 'ราคาขายแนะนำ', foodCostAt: 'food cost {n}%',
  actualPrice: 'ราคาขายจริง (฿/{label})', profitPer: 'กำไร / {label}', breakdown: 'ต้นทุนแยกตามวัตถุดิบ', sortedDesc: 'เรียงจากมากไปน้อย',
  topCostTip: '{name} คิดเป็น {pct} ของต้นทุน — ลองเทียบราคาแพ็กอื่นในคลังวัตถุดิบ', scaleShop: 'ปรับขนาด & รายการซื้อ', shopShort: 'รายการซื้อของ', shareImage: 'แชร์เป็นรูป',
  missingList: 'ขาดข้อมูล', per100Note: 'คิดจากน้ำหนัก {g} g', atwaterNote: 'kcal จาก macro ต่างจากที่กรอก {pct}',
  // shopping
  shopping: 'ปรับขนาด & รายการซื้อ', originalMakes: 'สูตรเดิม {n} {label} → อยากได้', factor: 'ตัวคูณ', payTotal: 'ต้องจ่ายรวม', usedCost: 'ต้นทุนของที่ใช้',
  samePerServe: 'ต่อ {label}เท่าเดิม', toBuy: 'ต้องซื้อ ({n})', tickWhenBought: 'ติ๊กเมื่อซื้อแล้ว', use: 'ใช้', buy: 'ซื้อ', weighBuy: 'ชั่งซื้อ', leftover: 'เหลือ',
  saveAsNew: 'บันทึกเป็นสูตรใหม่', shareList: 'แชร์รายการ', addAnotherRecipe: 'เพิ่มสูตรอื่นในรายการซื้อ', scaledQuantities: 'ปริมาณในสูตรหลังปรับขนาด',
  savedAsNew: 'บันทึก "{name}" แล้ว', copied: 'คัดลอกแล้ว', boughtCheck: 'ซื้อ{name}แล้ว', noPrice: 'ไม่มีราคา', removeFromList: 'เอาออก',
  // ingredient editor
  editIngredient: 'แก้ไขวัตถุดิบ', nameTh: 'ชื่อวัตถุดิบ (ไทย)', nameEn: 'ชื่อภาษาอังกฤษ', purchasePrice: 'ราคาที่ซื้อ', buyPack: 'แพ็ก', buyWeight: 'ชั่งน้ำหนัก',
  packPrice: 'ราคาแพ็ก (฿)', packSize: 'ขนาดแพ็ก', pricePerKg: 'ราคาต่อ', computed: 'คำนวณได้', store: 'ร้านที่ซื้อ (ไม่บังคับ)', priceHistory: 'ประวัติราคา',
  nutritionPer100: 'โภชนาการต่อ 100 {u}', fromLabel: 'แปลงจากฉลาก', searchUsda: 'ค้นหา USDA', source: 'แหล่งข้อมูล', optionalNutrients: 'น้ำตาล ใยอาหาร โซเดียม (ไม่บังคับ)',
  advanced: 'ขั้นสูง: yield %, g/ชิ้น, ความหนาแน่น', yieldPct: 'ส่วนที่ใช้ได้ (yield %)', yieldHint: 'เช่น กล้วยปอกเปลือกเหลือ 65%', gramsPerPiece: 'น้ำหนักต่อชิ้น (g)',
  density: 'ความหนาแน่น (g/ml)', densityHint: 'ใช้แปลงช้อน/ถ้วยเป็นกรัม ค่าเริ่มต้น 1.0', baseUnit: 'หน่วยหลัก', autosaved: 'บันทึกอัตโนมัติ', usedIn: 'ใช้อยู่ใน {n} สูตร',
  deleteIngredient: 'ลบวัตถุดิบ', confirmDeleteIngredient: 'ลบ "{name}"? สูตรที่ใช้อยู่ ({n}) จะขึ้นว่าขาดข้อมูล', created: 'สร้างแล้ว',
  // label sheet
  labelTitle: 'แปลงค่าจากฉลากโภชนาการ', servingSize: 'หนึ่งหน่วยบริโภค (g)', labelValues: 'ค่าบนฉลาก ต่อหนึ่งหน่วยบริโภค', applyValues: 'ใช้ค่านี้',
  // usda
  usdaTitle: 'ค้นหาค่าโภชนาการ (USDA)', usdaHint: 'ค้นเป็นภาษาอังกฤษ เช่น chicken breast raw', usdaNeedKey: 'ต้องใส่ USDA API key ในหน้าตั้งค่าก่อน',
  usdaBadKey: 'API key ไม่ถูกต้อง', usdaRate: 'ใช้ครบโควตาแล้ว ลองใหม่ในอีก 1 ชั่วโมง', usdaNetwork: 'ต่ออินเทอร์เน็ตไม่ได้', usdaNoResult: 'ไม่พบผลลัพธ์',
  includeBranded: 'รวมสินค้ายี่ห้อ', useThis: 'ใช้ค่านี้', partialData: 'ข้อมูลไม่ครบ', usdaAttribution: 'ข้อมูลจาก USDA FoodData Central',
  // starter
  starterTitle: 'ชุดวัตถุดิบตั้งต้น', starterIntro: 'ค้นค่าโภชนาการจาก USDA ให้ {n} รายการ ตรวจชื่อที่ USDA จับคู่ได้ แล้วเลือกเฉพาะที่ต้องการ ราคายังต้องใส่เอง',
  starterFetch: 'ค้นค่าจาก USDA', starterFetching: 'กำลังค้น {i}/{n}', starterImport: 'นำเข้า {n} รายการ', starterDone: 'นำเข้า {n} รายการแล้ว', alreadyHave: 'มีแล้ว', notFound: 'ไม่พบ', starterItemFailed: 'ค้นไม่สำเร็จ — กด "ค้นค่าจาก USDA" อีกครั้งเพื่อลองใหม่', starterSomeFailed: 'ค้นไม่สำเร็จ {n} รายการ กด "ค้นค่าจาก USDA" อีกครั้งเพื่อลองเฉพาะรายการนั้น ส่วนที่ค้นได้แล้วนำเข้าได้เลย',
  // sync
  synced: 'sync แล้ว', syncing: 'กำลัง sync', pendingSync: 'รอ sync {n}', offline: 'ออฟไลน์', syncError: 'sync ไม่สำเร็จ', notConnected: 'ยังไม่เชื่อม Sheet',
  conflictMsg: '{n} รายการถูกแทนที่ด้วยค่าที่ใหม่กว่าจาก Google Sheet', pullToRefresh: 'ดึงลงเพื่อ sync', releaseToRefresh: 'ปล่อยเพื่อ sync',
  // settings
  language: 'ภาษา', theme: 'ธีม', themeSystem: 'ตามระบบ', themeLight: 'สว่าง', themeDark: 'มืด', defaultFoodCost: 'food cost เริ่มต้น (%)',
  kitchenUnits: 'หน่วยครัว (ml)', tsp: '1 ช้อนชา', tbsp: '1 ช้อนโต๊ะ', cup: '1 ถ้วย', sheetConn: 'เชื่อม Google Sheet', webAppUrl: 'Web app URL', token: 'TOKEN',
  testConn: 'ทดสอบการเชื่อม', syncNow: 'sync ตอนนี้', disconnect: 'เลิกเชื่อม', connOk: 'เชื่อมสำเร็จ', lastSync: 'sync ล่าสุด {t}', pendingN: 'รอส่ง {n} รายการ',
  sheetGuide: 'ยังไม่มี? ดูคู่มือตั้งค่า Google Sheet + Apps Script', usdaKey: 'USDA API key', usdaKeyHint: 'สมัครฟรีที่ fdc.nal.usda.gov/api-key-signup',
  previewNote: 'นี่คือเวอร์ชันตัวอย่างบน claude.ai: ข้อมูลเก็บในเครื่องนี้เท่านั้น เชื่อม Google Sheet และค้นหา USDA ได้ในเวอร์ชันที่ติดตั้งจาก GitHub Pages', dataSection: 'ข้อมูล', exportJson: 'Export JSON', about: 'เกี่ยวกับ', version: 'เวอร์ชัน',
  err_unauthorized: 'TOKEN ไม่ถูกต้อง', err_not_setup: 'ยังไม่ได้รัน setup() ใน Apps Script', err_bad_url: 'URL ต้องขึ้นต้นด้วย https://script.google.com/',
  err_not_json: 'Web app ไม่ได้ตอบเป็น JSON — ตรวจว่า Who has access = Anyone', err_network: 'ต่ออินเทอร์เน็ตไม่ได้', err_timeout: 'Google ตอบช้าเกินไป ลองใหม่',
  err_busy: 'มีการเขียนข้อมูลอยู่ ลองใหม่อีกครั้ง', err_unknown: 'เกิดข้อผิดพลาด',
  // validation
  v_required: 'ต้องกรอก', v_min0: 'ต้องไม่ติดลบ', v_gt0: 'ต้องมากกว่า 0', v_min1: 'ต้องอย่างน้อย 1', v_range1_100: 'ต้องอยู่ระหว่าง 1–100',
  v_required_for_piece: 'ต้องใส่น้ำหนักต่อชิ้น เมื่อซื้อเป็นชิ้น', v_max900: 'kcal ต่อ 100 g ไม่ควรเกิน 900', v_sum_over_100: 'โปรตีน+คาร์บ+ไขมัน ต่อ 100 g รวมเกิน 100 g — พิมพ์ผิดหรือเปล่า?',
  v_atwater_mismatch: 'kcal ต่างจากที่คำนวณจาก macro เกิน 15% — ตรวจตัวเลขอีกครั้ง', v_sugar_over_carb: 'น้ำตาลมากกว่าคาร์บ', v_satfat_over_fat: 'ไขมันอิ่มตัวมากกว่าไขมันรวม',
  issue_missing_price: 'ไม่มีราคา', issue_missing_nutrition: 'ไม่มีโภชนาการ', issue_missing_grams_per_piece: 'ไม่มีน้ำหนักต่อชิ้น', issue_missing_pack_size: 'ไม่มีขนาดแพ็ก',
  issue_missing_ref: 'วัตถุดิบถูกลบ', issue_cycle: 'อ้างวน', issue_bad_quantity: 'ปริมาณไม่ถูกต้อง',
  categories: 'แป้ง|น้ำตาล/ไซรัป|นม/เนย|ไข่|ผัก/ผลไม้|เนื้อสัตว์|เครื่องปรุง|บรรจุภัณฑ์|อาหาร|ขนม|เครื่องดื่ม|อื่นๆ',
  recipeCats: 'ขนม|อาหาร|เครื่องดื่ม|อื่นๆ',
};

type Dict = typeof th;

const en: Dict = {
  appName: 'Recipe Cost & Nutrition',
  hello: 'Hello',
  myRecipes: 'My recipes',
  recipes: 'Recipes', ingredients: 'Ingredients', settings: 'Settings',
  searchRecipe: 'Search recipes or ingredients', searchIngredient: 'Search ingredients',
  all: 'All', newRecipe: 'New recipe', newIngredient: 'New ingredient',
  noRecipes: 'No recipes yet', noRecipesHint: 'Create a recipe and add ingredients to see kcal and cost per serving',
  noIngredients: 'No ingredients yet', noIngredientsHint: 'Add your own or import the USDA starter set',
  createFirstRecipe: 'Create first recipe', importStarter: 'Import starter ingredients',
  itemsCount: '{n} ingredients', perServe: 'per 1 {label}', per: '/ {label}',
  missingPrice: '{n} missing price', incomplete: 'Incomplete',
  back: 'Back', more: 'More options', save: 'Save', cancel: 'Cancel', delete: 'Delete', undo: 'Undo', done: 'Done', close: 'Close', add: 'Add',
  editRecipe: 'Edit recipe', recipeName: 'Recipe name', makesPerBatch: 'One batch makes', servingUnit: 'Unit', decrease: 'Decrease', increase: 'Increase',
  category: 'Category', totalCost: 'Total cost', addIngredient: 'Add ingredient', viewDetail: 'Details', cost: 'Cost',
  extras: 'Extra costs & selling price', cookedWeight: 'Cooked weight (g)', cookedWeightHint: 'Optional, used for per 100 g',
  batchExtra: 'Extra cost per batch (฿)', batchExtraHint: 'e.g. gas, electricity', perServeExtra: 'Extra cost per serving (฿)', perServeExtraHint: 'e.g. box, sticker',
  targetFoodCost: 'Target food cost (%)', targetFoodCostHint: 'Empty = settings default ({n}%)', sellPrice: 'Selling price (฿ / serving)', notes: 'Method / notes',
  duplicate: 'Duplicate', deleteRecipe: 'Delete recipe', confirmDeleteRecipe: 'Delete "{name}"?', copyOf: '{name} (copy)',
  removed: 'Removed {name}', dragHint: 'Swipe left to remove',
  pickIngredient: 'Pick an ingredient', fromRecipes: 'Other recipes (as ingredient)', createNew: 'Create "{q}"', createNewPlain: 'Create ingredient',
  quantity: 'Quantity', unit: 'Unit', basisNet: 'Net weight', basisPurchased: 'As purchased', basisHint: 'Net = after peeling/trimming',
  cycleError: 'Cannot use this recipe: it would refer back to itself', editItem: 'Edit quantity', removeItem: 'Remove from recipe', subRecipe: 'Sub-recipe',
  u_g: 'g', u_kg: 'kg', u_mg: 'mg', u_ml: 'ml', u_l: 'l', u_tsp: 'tsp', u_tbsp: 'tbsp', u_cup: 'cup', u_piece: 'piece',
  nutrition: 'Nutrition', costTab: 'Cost', perServeShort: 'Per serving', per100g: 'Per 100 g', wholeRecipe: 'Whole recipe',
  energy: 'Energy', protein: 'Protein', carb: 'Carbs', fat: 'Fat', sugar: 'Sugar', fiber: 'Fiber', satFat: 'Saturated fat', sodium: 'Sodium',
  energyFrom: 'Energy split', costPerServe: 'Cost / {label}', wholeBatch: 'Whole recipe {v}', suggestedPrice: 'Suggested price', foodCostAt: 'food cost {n}%',
  actualPrice: 'Selling price (฿/{label})', profitPer: 'Profit / {label}', breakdown: 'Cost by ingredient', sortedDesc: 'Highest first',
  topCostTip: '{name} is {pct} of the cost — compare other pack sizes in Ingredients', scaleShop: 'Scale & shopping list', shopShort: 'Shopping list', shareImage: 'Share as image',
  missingList: 'Missing data', per100Note: 'Based on {g} g', atwaterNote: 'kcal from macros differs {pct} from entered',
  shopping: 'Scale & shopping list', originalMakes: 'Recipe makes {n} {label} → I want', factor: 'Factor', payTotal: 'Total to pay', usedCost: 'Cost of what is used',
  samePerServe: 'Same per {label}', toBuy: 'To buy ({n})', tickWhenBought: 'Tick when bought', use: 'Use', buy: 'Buy', weighBuy: 'Weigh', leftover: 'Left',
  saveAsNew: 'Save as new recipe', shareList: 'Share list', addAnotherRecipe: 'Add another recipe', scaledQuantities: 'Scaled recipe quantities',
  savedAsNew: 'Saved "{name}"', copied: 'Copied', boughtCheck: 'Bought {name}', noPrice: 'No price', removeFromList: 'Remove',
  editIngredient: 'Edit ingredient', nameTh: 'Name (Thai)', nameEn: 'Name (English)', purchasePrice: 'Purchase price', buyPack: 'Pack', buyWeight: 'By weight',
  packPrice: 'Pack price (฿)', packSize: 'Pack size', pricePerKg: 'Price per', computed: 'Computed', store: 'Store (optional)', priceHistory: 'Price history',
  nutritionPer100: 'Nutrition per 100 {u}', fromLabel: 'From label', searchUsda: 'Search USDA', source: 'Source', optionalNutrients: 'Sugar, fiber, sodium (optional)',
  advanced: 'Advanced: yield %, g/piece, density', yieldPct: 'Edible portion (yield %)', yieldHint: 'e.g. peeled banana is 65%', gramsPerPiece: 'Weight per piece (g)',
  density: 'Density (g/ml)', densityHint: 'Converts spoons/cups to grams, default 1.0', baseUnit: 'Base unit', autosaved: 'Saved automatically', usedIn: 'Used in {n} recipes',
  deleteIngredient: 'Delete ingredient', confirmDeleteIngredient: 'Delete "{name}"? Recipes using it ({n}) will show missing data', created: 'Created',
  labelTitle: 'Convert from a nutrition label', servingSize: 'Serving size (g)', labelValues: 'Label values per serving', applyValues: 'Use these values',
  usdaTitle: 'Search nutrition (USDA)', usdaHint: 'Search in English, e.g. chicken breast raw', usdaNeedKey: 'Add a USDA API key in Settings first',
  usdaBadKey: 'Invalid API key', usdaRate: 'Rate limit reached, try again in an hour', usdaNetwork: 'No internet connection', usdaNoResult: 'No results',
  includeBranded: 'Include branded', useThis: 'Use this', partialData: 'Incomplete data', usdaAttribution: 'Data: USDA FoodData Central',
  starterTitle: 'Starter ingredients', starterIntro: 'Looks up {n} items in USDA. Check each match and keep the ones you want. Prices are still yours to enter.',
  starterFetch: 'Look up in USDA', starterFetching: 'Looking up {i}/{n}', starterImport: 'Import {n} items', starterDone: 'Imported {n} items', alreadyHave: 'Already added', notFound: 'Not found', starterItemFailed: 'Lookup failed — tap "Look up in USDA" again to retry', starterSomeFailed: '{n} lookups failed. Tap "Look up in USDA" again to retry only those; the rest can be imported now.',
  synced: 'Synced', syncing: 'Syncing', pendingSync: '{n} to sync', offline: 'Offline', syncError: 'Sync failed', notConnected: 'Sheet not connected',
  conflictMsg: '{n} items were replaced by newer values from Google Sheet', pullToRefresh: 'Pull to sync', releaseToRefresh: 'Release to sync',
  language: 'Language', theme: 'Theme', themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark', defaultFoodCost: 'Default food cost (%)',
  kitchenUnits: 'Kitchen units (ml)', tsp: '1 tsp', tbsp: '1 tbsp', cup: '1 cup', sheetConn: 'Google Sheet connection', webAppUrl: 'Web app URL', token: 'TOKEN',
  testConn: 'Test connection', syncNow: 'Sync now', disconnect: 'Disconnect', connOk: 'Connected', lastSync: 'Last sync {t}', pendingN: '{n} waiting to send',
  sheetGuide: 'Not set up yet? See the Google Sheet + Apps Script guide', usdaKey: 'USDA API key', usdaKeyHint: 'Free at fdc.nal.usda.gov/api-key-signup',
  previewNote: 'This is the claude.ai preview: data stays on this device. Google Sheet sync and USDA search work in the version installed from GitHub Pages.', dataSection: 'Data', exportJson: 'Export JSON', about: 'About', version: 'Version',
  err_unauthorized: 'Wrong TOKEN', err_not_setup: 'setup() has not been run in Apps Script', err_bad_url: 'URL must start with https://script.google.com/',
  err_not_json: 'Web app did not answer JSON — check Who has access = Anyone', err_network: 'No internet connection', err_timeout: 'Google took too long, try again',
  err_busy: 'Another write is in progress, try again', err_unknown: 'Something went wrong',
  v_required: 'Required', v_min0: 'Must not be negative', v_gt0: 'Must be greater than 0', v_min1: 'Must be at least 1', v_range1_100: 'Must be 1–100',
  v_required_for_piece: 'Weight per piece is required when bought by the piece', v_max900: 'kcal per 100 g should not exceed 900', v_sum_over_100: 'Protein+carbs+fat per 100 g add up to more than 100 g — typo?',
  v_atwater_mismatch: 'kcal differs from macros by more than 15% — check the numbers', v_sugar_over_carb: 'Sugar is higher than carbs', v_satfat_over_fat: 'Saturated fat is higher than total fat',
  issue_missing_price: 'No price', issue_missing_nutrition: 'No nutrition', issue_missing_grams_per_piece: 'No weight per piece', issue_missing_pack_size: 'No pack size',
  issue_missing_ref: 'Ingredient deleted', issue_cycle: 'Circular', issue_bad_quantity: 'Invalid quantity',
  categories: 'แป้ง|น้ำตาล/ไซรัป|นม/เนย|ไข่|ผัก/ผลไม้|เนื้อสัตว์|เครื่องปรุง|บรรจุภัณฑ์|อาหาร|ขนม|เครื่องดื่ม|อื่นๆ',
  recipeCats: 'ขนม|อาหาร|เครื่องดื่ม|อื่นๆ',
};

const CAT_EN: Record<string, string> = {
  'แป้ง': 'Flour & grains', 'น้ำตาล/ไซรัป': 'Sugar & syrup', 'นม/เนย': 'Dairy', 'ไข่': 'Eggs', 'ผัก/ผลไม้': 'Produce', 'เนื้อสัตว์': 'Meat & seafood',
  'เครื่องปรุง': 'Seasoning', 'บรรจุภัณฑ์': 'Packaging', 'อาหาร': 'Food', 'ขนม': 'Dessert', 'เครื่องดื่ม': 'Drinks', 'อื่นๆ': 'Other',
};

export type TKey = keyof Dict;
const dicts: Record<Lang, Dict> = { th, en };

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s = dicts[lang][key] ?? th[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT() {
  const lang = usePrefs((p) => p.lang);
  const t = (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  /** Category values are stored in Thai (Sheet dropdown); shown translated. */
  const cat = (c?: string) => (!c ? '' : lang === 'en' ? CAT_EN[c] ?? c : c);
  const unit = (u: string) => translate(lang, `u_${u}` as TKey);
  return { t, lang, cat, unit };
}
