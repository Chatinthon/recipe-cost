// Starter ingredients (Q3 option 1). Nutrition values are NOT stored here: they are looked up from USDA FoodData Central
// at import time with the user's own API key, and the matched USDA description is shown before anything is saved.
import type { BuyMode, PackUnit } from '../engine/types';

export interface StarterItem {
  key: string;
  nameTh: string;
  nameEn: string;
  /** Search text; usually the exact SR Legacy description. */
  query: string;
  category: string;
  buyMode: BuyMode;
  packUnit?: PackUnit;
  gramsPerPiece?: number;
  densityGPerMl?: number;
  baseUnit?: 'g' | 'ml';
}

const M = 'เนื้อสัตว์', V = 'ผัก/ผลไม้', F = 'แป้ง', S = 'น้ำตาล/ไซรัป', D = 'นม/เนย', E = 'ไข่', C = 'เครื่องปรุง', O = 'อื่นๆ';

export const STARTER: StarterItem[] = [
  // meat & seafood
  { key: 'chicken-breast', nameTh: 'อกไก่ (ดิบ)', nameEn: 'Chicken breast, raw', query: 'Chicken, broilers or fryers, breast, meat only, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'chicken-thigh', nameTh: 'สะโพกไก่ไม่มีหนัง (ดิบ)', nameEn: 'Chicken thigh, raw', query: 'Chicken, broilers or fryers, thigh, meat only, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'pork-ground', nameTh: 'หมูสับ (ดิบ)', nameEn: 'Ground pork, raw', query: 'Pork, fresh, ground, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'pork-belly', nameTh: 'หมูสามชั้น (ดิบ)', nameEn: 'Pork belly, raw', query: 'Pork, fresh, belly, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'beef-ground', nameTh: 'เนื้อวัวบด 85/15 (ดิบ)', nameEn: 'Ground beef 85% lean, raw', query: 'Beef, ground, 85% lean meat / 15% fat, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'shrimp', nameTh: 'กุ้ง (ดิบ แกะเปลือก)', nameEn: 'Shrimp, raw', query: 'Crustaceans, shrimp, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'squid', nameTh: 'ปลาหมึก (ดิบ)', nameEn: 'Squid, raw', query: 'Mollusks, squid, mixed species, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'tilapia', nameTh: 'ปลานิล (ดิบ)', nameEn: 'Tilapia, raw', query: 'Fish, tilapia, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  { key: 'salmon', nameTh: 'แซลมอน (ดิบ)', nameEn: 'Salmon, Atlantic farmed, raw', query: 'Fish, salmon, Atlantic, farmed, raw', category: M, buyMode: 'weight', packUnit: 'kg' },
  // eggs, dairy, soy
  { key: 'egg', nameTh: 'ไข่ไก่', nameEn: 'Egg, whole, raw', query: 'Egg, whole, raw, fresh', category: E, buyMode: 'pack', packUnit: 'piece', gramsPerPiece: 50 },
  { key: 'tofu-firm', nameTh: 'เต้าหู้แข็ง', nameEn: 'Tofu, firm', query: 'Tofu, raw, firm, prepared with calcium sulfate', category: O, buyMode: 'pack', packUnit: 'g' },
  { key: 'butter', nameTh: 'เนยจืด', nameEn: 'Butter, unsalted', query: 'Butter, without salt', category: D, buyMode: 'pack', packUnit: 'g' },
  { key: 'milk', nameTh: 'นมสด', nameEn: 'Milk, whole', query: 'Milk, whole, 3.25% milkfat, with added vitamin D', category: D, buyMode: 'pack', packUnit: 'ml', densityGPerMl: 1.03, baseUnit: 'ml' },
  { key: 'condensed-milk', nameTh: 'นมข้นหวาน', nameEn: 'Sweetened condensed milk', query: 'Milk, canned, condensed, sweetened', category: D, buyMode: 'pack', packUnit: 'g' },
  { key: 'evaporated-milk', nameTh: 'นมข้นจืด', nameEn: 'Evaporated milk', query: 'Milk, canned, evaporated, without added vitamin A', category: D, buyMode: 'pack', packUnit: 'g' },
  { key: 'whipping-cream', nameTh: 'วิปปิ้งครีม', nameEn: 'Heavy whipping cream', query: 'Cream, fluid, heavy whipping', category: D, buyMode: 'pack', packUnit: 'ml', baseUnit: 'ml' },
  { key: 'cream-cheese', nameTh: 'ครีมชีส', nameEn: 'Cream cheese', query: 'Cheese, cream', category: D, buyMode: 'pack', packUnit: 'g' },
  { key: 'coconut-milk', nameTh: 'กะทิ (กล่อง)', nameEn: 'Coconut milk, canned', query: 'Nuts, coconut milk, canned (liquid expressed from grated meat and water)', category: D, buyMode: 'pack', packUnit: 'ml', baseUnit: 'ml' },
  // flours, grains, starches
  { key: 'ap-flour', nameTh: 'แป้งสาลีอเนกประสงค์', nameEn: 'All-purpose flour', query: 'Wheat flour, white, all-purpose, enriched, bleached', category: F, buyMode: 'pack', packUnit: 'kg' },
  { key: 'rice-flour', nameTh: 'แป้งข้าวเจ้า', nameEn: 'Rice flour', query: 'Rice flour, white, unenriched', category: F, buyMode: 'pack', packUnit: 'g' },
  { key: 'glutinous-flour', nameTh: 'แป้งข้าวเหนียว', nameEn: 'Glutinous rice flour', query: 'Rice flour, white, glutinous', category: F, buyMode: 'pack', packUnit: 'g' },
  { key: 'tapioca', nameTh: 'แป้งมันสำปะหลัง', nameEn: 'Tapioca starch', query: 'Tapioca, pearl, dry', category: F, buyMode: 'pack', packUnit: 'g' },
  { key: 'cornstarch', nameTh: 'แป้งข้าวโพด', nameEn: 'Cornstarch', query: 'Cornstarch', category: F, buyMode: 'pack', packUnit: 'g' },
  { key: 'jasmine-rice', nameTh: 'ข้าวสาร (ดิบ)', nameEn: 'White rice, raw', query: 'Rice, white, long-grain, regular, raw, unenriched', category: F, buyMode: 'pack', packUnit: 'kg' },
  { key: 'sticky-rice', nameTh: 'ข้าวเหนียว (ดิบ)', nameEn: 'Glutinous rice, raw', query: 'Rice, white, glutinous, unenriched, uncooked', category: F, buyMode: 'pack', packUnit: 'kg' },
  { key: 'oats', nameTh: 'ข้าวโอ๊ต', nameEn: 'Rolled oats', query: 'Cereals, oats, regular and quick, not fortified, dry', category: F, buyMode: 'pack', packUnit: 'g' },
  { key: 'rice-noodle', nameTh: 'เส้นก๋วยเตี๋ยวแห้ง', nameEn: 'Rice noodles, dry', query: 'Rice noodles, dry', category: F, buyMode: 'pack', packUnit: 'g' },
  { key: 'spaghetti', nameTh: 'สปาเก็ตตี้ (แห้ง)', nameEn: 'Pasta, dry', query: 'Pasta, dry, enriched', category: F, buyMode: 'pack', packUnit: 'g' },
  // sugars
  { key: 'sugar', nameTh: 'น้ำตาลทราย', nameEn: 'Granulated sugar', query: 'Sugars, granulated', category: S, buyMode: 'pack', packUnit: 'kg' },
  { key: 'brown-sugar', nameTh: 'น้ำตาลทรายแดง', nameEn: 'Brown sugar', query: 'Sugars, brown', category: S, buyMode: 'pack', packUnit: 'g' },
  { key: 'honey', nameTh: 'น้ำผึ้ง', nameEn: 'Honey', query: 'Honey', category: S, buyMode: 'pack', packUnit: 'g' },
  // oils & seasonings
  { key: 'veg-oil', nameTh: 'น้ำมันถั่วเหลือง', nameEn: 'Soybean oil', query: 'Oil, soybean, salad or cooking', category: C, buyMode: 'pack', packUnit: 'ml', densityGPerMl: 0.92, baseUnit: 'ml' },
  { key: 'palm-oil', nameTh: 'น้ำมันปาล์ม', nameEn: 'Palm oil', query: 'Oil, palm', category: C, buyMode: 'pack', packUnit: 'ml', densityGPerMl: 0.91, baseUnit: 'ml' },
  { key: 'fish-sauce', nameTh: 'น้ำปลา', nameEn: 'Fish sauce', query: 'Sauce, fish, ready-to-serve', category: C, buyMode: 'pack', packUnit: 'ml', densityGPerMl: 1.2, baseUnit: 'ml' },
  { key: 'soy-sauce', nameTh: 'ซีอิ๊วขาว', nameEn: 'Soy sauce', query: 'Soy sauce made from soy and wheat (shoyu)', category: C, buyMode: 'pack', packUnit: 'ml', densityGPerMl: 1.15, baseUnit: 'ml' },
  { key: 'oyster-sauce', nameTh: 'ซอสหอยนางรม', nameEn: 'Oyster sauce', query: 'Sauce, oyster, ready-to-serve', category: C, buyMode: 'pack', packUnit: 'ml', densityGPerMl: 1.2, baseUnit: 'ml' },
  { key: 'salt', nameTh: 'เกลือ', nameEn: 'Table salt', query: 'Salt, table', category: C, buyMode: 'pack', packUnit: 'g' },
  { key: 'cocoa', nameTh: 'ผงโกโก้', nameEn: 'Cocoa powder', query: 'Cocoa, dry powder, unsweetened', category: O, buyMode: 'pack', packUnit: 'g' },
  // vegetables & herbs
  { key: 'garlic', nameTh: 'กระเทียม', nameEn: 'Garlic', query: 'Garlic, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'shallot', nameTh: 'หอมแดง', nameEn: 'Shallots', query: 'Shallots, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'onion', nameTh: 'หอมใหญ่', nameEn: 'Onion', query: 'Onions, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'chili', nameTh: 'พริกขี้หนู/พริกแดง', nameEn: 'Hot chili pepper', query: 'Peppers, hot chili, red, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'basil', nameTh: 'ใบกะเพรา/โหระพา', nameEn: 'Basil, fresh', query: 'Basil, fresh', category: V, buyMode: 'weight', packUnit: 'g' },
  { key: 'lemongrass', nameTh: 'ตะไคร้', nameEn: 'Lemongrass', query: 'Lemon grass (citronella), raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'lime-juice', nameTh: 'น้ำมะนาว', nameEn: 'Lime juice', query: 'Lime juice, raw', category: V, buyMode: 'pack', packUnit: 'ml', baseUnit: 'ml' },
  { key: 'morning-glory', nameTh: 'ผักบุ้ง', nameEn: 'Water spinach', query: 'Water convolvulus, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'cabbage', nameTh: 'กะหล่ำปลี', nameEn: 'Cabbage', query: 'Cabbage, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'carrot', nameTh: 'แครอท', nameEn: 'Carrot', query: 'Carrots, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'tomato', nameTh: 'มะเขือเทศ', nameEn: 'Tomato', query: 'Tomatoes, red, ripe, raw, year round average', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'cucumber', nameTh: 'แตงกวา', nameEn: 'Cucumber', query: 'Cucumber, with peel, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'potato', nameTh: 'มันฝรั่ง', nameEn: 'Potato', query: 'Potatoes, flesh and skin, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'sweet-potato', nameTh: 'มันเทศ', nameEn: 'Sweet potato', query: 'Sweet potato, raw, unprepared', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'pumpkin', nameTh: 'ฟักทอง', nameEn: 'Pumpkin', query: 'Pumpkin, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  // fruit, nuts
  { key: 'banana', nameTh: 'กล้วยหอม', nameEn: 'Banana', query: 'Bananas, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'mango', nameTh: 'มะม่วงสุก', nameEn: 'Mango', query: 'Mangos, raw', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'pineapple', nameTh: 'สับปะรด', nameEn: 'Pineapple', query: 'Pineapple, raw, all varieties', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'lemon', nameTh: 'เลมอน', nameEn: 'Lemon', query: 'Lemons, raw, without peel', category: V, buyMode: 'weight', packUnit: 'kg' },
  { key: 'peanut', nameTh: 'ถั่วลิสง', nameEn: 'Peanuts, raw', query: 'Peanuts, all types, raw', category: O, buyMode: 'pack', packUnit: 'g' },
  { key: 'sesame', nameTh: 'งาขาว', nameEn: 'Sesame seeds', query: 'Seeds, sesame seeds, whole, dried', category: O, buyMode: 'pack', packUnit: 'g' },
];
