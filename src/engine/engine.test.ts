import { describe, expect, it } from 'vitest';
import { atwaterCheck, Calculator } from './calc';
import { buildShoppingList, scaleRecipe } from './shopping';
import { toGrams } from './units';
import { labelToPer100, validateIngredient, validateRecipe } from './validate';
import { formatBaht, formatKcal, parseBahtToSatang, roundTo } from './format';
import { bananaBreadCatalog, ing, item, recipe } from './fixtures';
import { DEFAULT_KITCHEN } from './types';

const baht = (s: number) => formatBaht(s, false);

describe('BR-01 unit conversion', () => {
  const ctx = { settings: DEFAULT_KITCHEN };
  it.each([
    [1, 'kg', 1000], [500, 'mg', 0.5], [2, 'tbsp', 30], [1, 'cup', 240], [3, 'tsp', 15], [0.5, 'l', 500],
  ])('%s %s = %s g', (q, u, g) => {
    const r = toGrams(q, u, ctx);
    expect(r.ok && r.grams).toBeCloseTo(g, 9);
  });
  it('uses density for volume', () => {
    const r = toGrams(1, 'cup', { settings: DEFAULT_KITCHEN, densityGPerMl: 0.53 });
    expect(r.ok && r.grams).toBeCloseTo(127.2, 9);
  });
  it('piece needs grams per piece', () => {
    expect(toGrams(2, 'piece', ctx)).toEqual({ ok: false, error: 'missing_grams_per_piece' });
    const r = toGrams(2, 'piece', { ...ctx, gramsPerPiece: 50 });
    expect(r.ok && r.grams).toBe(100);
  });
  it('rejects negative and NaN quantities', () => {
    expect(toGrams(-1, 'g', ctx).ok).toBe(false);
    expect(toGrams(Number.NaN, 'g', ctx).ok).toBe(false);
  });
});

describe('Reference case: banana bread 8 pieces (doc section 9)', () => {
  const cat = bananaBreadCatalog();
  const r = new Calculator(cat).evaluate('bb')!;

  it('line costs match the doc', () => {
    expect(r.lines.map((l) => baht(l.costSatang!))).toEqual(['9.00', '18.46', '47.50', '9.00', '3.36']);
  });
  it('banana purchased weight uses 65% yield', () => {
    expect(r.lines[1].purchasedGrams).toBeCloseTo(461.538, 2);
    expect(r.lines[1].netGrams).toBe(300);
  });
  it('total 87.32 and 10.92 per piece', () => {
    expect(baht(r.ingredientCostSatang)).toBe('87.32');
    expect(baht(r.perServe.costSatang)).toBe('10.92');
  });
  it('energy 2,319 total and 290 per piece', () => {
    expect(formatKcal(r.nutrients.kcal)).toBe('2,319');
    expect(formatKcal(r.perServe.nutrients.kcal)).toBe('290');
  });
  it('macros total and per piece', () => {
    expect(roundTo(r.nutrients.protein, 1)).toBe(37.4);
    expect(roundTo(r.nutrients.fat, 1)).toBe(93.5);
    expect(roundTo(r.nutrients.carb, 1)).toBe(341.8);
    expect(roundTo(r.perServe.nutrients.protein, 1)).toBe(4.7);
    expect(roundTo(r.perServe.nutrients.fat, 1)).toBe(11.7);
    expect(roundTo(r.perServe.nutrients.carb, 1)).toBe(42.7);
  });
  it('macro totals may exceed 100 g (only per-ingredient values are bounded)', () => {
    expect(r.nutrients.carb).toBeGreaterThan(100);
  });
  it('suggested price at 35% food cost is 31.19', () => {
    expect(baht(r.suggestedPriceSatang)).toBe('31.19');
  });
  it('per 100 g uses 820 g raw weight when cooked weight is missing', () => {
    expect(r.batchWeightG).toBe(820);
    expect(formatKcal(r.per100g!.kcal)).toBe('283');
  });
  it('recipe-level Atwater check differs 1.7% → no warning', () => {
    const a = atwaterCheck(r.nutrients);
    expect(Math.round(a.kcalFromMacros)).toBe(2358);
    expect(roundTo(a.diffPct, 1)).toBe(1.7);
    expect(a.warn).toBe(false);
  });
  it('breakdown sorted by cost, butter first at 54.4%', () => {
    expect(r.breakdown[0].name).toBe('เนยจืด');
    expect(roundTo(r.breakdown[0].pct, 1)).toBe(54.4);
    expect(r.breakdown.map((b) => b.name)).toEqual(['เนยจืด', 'กล้วยหอม', 'แป้งสาลี', 'ไข่ไก่', 'น้ำตาลทราย']);
  });
  it('energy split sums to 100', () => {
    const s = r.energySplit;
    expect(s.protein + s.carb + s.fat).toBeCloseTo(100, 9);
    expect(Math.round(s.carb)).toBe(58);
  });
  it('is complete', () => {
    expect(r.costComplete && r.nutritionComplete).toBe(true);
    expect(r.issues).toEqual([]);
  });
});

describe('AC-02 price update recalculates', () => {
  it('butter 105/200 g → 92.32 total, 11.54 per piece', () => {
    const cat = bananaBreadCatalog();
    cat.ingredients.get('butter')!.packPrice = 10500;
    const r = new Calculator(cat).evaluate('bb')!;
    expect(baht(r.ingredientCostSatang)).toBe('92.32');
    expect(baht(r.perServe.costSatang)).toBe('11.54');
  });
});

describe('BR-08 selling price, profit and margin', () => {
  it('sell at 35 baht → profit 24.08, margin 68.8%', () => {
    const cat = bananaBreadCatalog();
    cat.recipes.get('bb')!.sellPrice = 3500;
    const r = new Calculator(cat).evaluate('bb')!;
    expect(baht(r.profitSatang!)).toBe('24.08');
    expect(roundTo(r.marginPct!, 1)).toBe(68.8);
  });
  it('recipe target food cost overrides the default', () => {
    const cat = bananaBreadCatalog();
    cat.recipes.get('bb')!.targetFoodCostPct = 40;
    const r = new Calculator(cat).evaluate('bb')!;
    expect(r.foodCostPct).toBe(40);
    expect(baht(r.suggestedPriceSatang)).toBe('27.29');
  });
  it('extras: batch extra spread over servings, per-serve extra added', () => {
    const cat = bananaBreadCatalog();
    Object.assign(cat.recipes.get('bb')!, { batchExtraCost: 800, perServeExtraCost: 300 });
    const r = new Calculator(cat).evaluate('bb')!;
    // (8732.15 + 800) / 8 + 300 = 1491.52
    expect(baht(r.perServe.costSatang)).toBe('14.92');
  });
});

describe('Ad-hoc example from the user: ผัดกะเพรา 4 จาน = total / 4', () => {
  it('per serve is total divided by servings', () => {
    const cat = bananaBreadCatalog();
    cat.recipes.set('kp', recipe({ id: 'kp', name: 'ผัดกะเพรา', servings: 4, servingLabel: 'จาน' }));
    cat.ingredients.set('chicken', ing({ id: 'chicken', nameTh: 'อกไก่', packPrice: 9000, packSize: 1, packUnit: 'kg', buyMode: 'weight', nutrition: { kcal: 120, protein: 22.5, fat: 2.6, carb: 0 } }));
    cat.itemsByRecipe.set('kp', [item('kp', 'chicken', 400, 'g', 1)]);
    const r = new Calculator(cat).evaluate('kp')!;
    expect(r.nutrients.kcal).toBeCloseTo(480, 9);
    expect(r.perServe.nutrients.kcal).toBeCloseTo(120, 9);
    expect(baht(r.perServe.costSatang)).toBe('9.00');
  });
});

describe('Quantity basis and cooked weight', () => {
  it('purchased basis: nutrition from net = purchased × yield', () => {
    const cat = bananaBreadCatalog();
    cat.itemsByRecipe.set('bb', [item('bb', 'banana', 461.5384615, 'g', 1, { quantityBasis: 'purchased' })]);
    const r = new Calculator(cat).evaluate('bb')!;
    expect(r.lines[0].netGrams).toBeCloseTo(300, 4);
    expect(baht(r.lines[0].costSatang!)).toBe('18.46');
  });
  it('cooked weight drives per 100 g', () => {
    const cat = bananaBreadCatalog();
    cat.recipes.get('bb')!.cookedWeightG = 700;
    const r = new Calculator(cat).evaluate('bb')!;
    expect(formatKcal(r.per100g!.kcal)).toBe('331');
    expect(formatKcal(r.perServe.nutrients.kcal)).toBe('290');
  });
});

describe('FR-22 incomplete data is flagged', () => {
  it('missing price and nutrition', () => {
    const cat = bananaBreadCatalog();
    cat.ingredients.get('sugar')!.packPrice = null;
    cat.ingredients.get('flour')!.nutrition = null;
    const r = new Calculator(cat).evaluate('bb')!;
    expect(r.costComplete).toBe(false);
    expect(r.nutritionComplete).toBe(false);
    expect(r.issues).toEqual(expect.arrayContaining(['missing_price', 'missing_nutrition']));
  });
  it('AC-04 egg in pieces without grams per piece', () => {
    const cat = bananaBreadCatalog();
    cat.ingredients.get('egg')!.gramsPerPiece = null;
    cat.ingredients.get('egg')!.packUnit = 'kg';
    cat.ingredients.get('egg')!.packSize = 1.5;
    const r = new Calculator(cat).evaluate('bb')!;
    expect(r.lines[3].issues).toContain('missing_grams_per_piece');
  });
  it('deleted ingredient → missing_ref', () => {
    const cat = bananaBreadCatalog();
    cat.ingredients.get('egg')!.deleted = true;
    expect(new Calculator(cat).evaluate('bb')!.lines[3].issues).toEqual(['missing_ref']);
  });
});

describe('BR-11 sub-recipe', () => {
  function withSyrup() {
    const cat = bananaBreadCatalog();
    cat.ingredients.set('honey', ing({ id: 'honey', nameTh: 'น้ำผึ้ง', packPrice: 20000, packSize: 1000, packUnit: 'g', nutrition: { kcal: 304, protein: 0.3, fat: 0, carb: 82.4 } }));
    cat.ingredients.set('water', ing({ id: 'water', nameTh: 'น้ำ', packPrice: 0, packSize: 1000, packUnit: 'ml', nutrition: { kcal: 0, protein: 0, fat: 0, carb: 0 } }));
    cat.recipes.set('syrup', recipe({ id: 'syrup', name: 'ไซรัป', servings: 10, cookedWeightG: 400 }));
    cat.itemsByRecipe.set('syrup', [item('syrup', 'honey', 300, 'g', 1), item('syrup', 'water', 200, 'ml', 2)]);
    return cat;
  }
  it('cost and nutrition per gram come from the cooked weight', () => {
    const cat = withSyrup();
    cat.itemsByRecipe.get('bb')!.push(item('bb', 'syrup', 40, 'g', 6, { refType: 'recipe' }));
    const calc = new Calculator(cat);
    const r = calc.evaluate('bb')!;
    const l = r.lines[5];
    // syrup: 300 g honey = 6000 satang, 912 kcal over 400 g → 40 g = 600 satang, 91.2 kcal
    expect(l.costSatang).toBeCloseTo(600, 9);
    expect(l.nutrients!.kcal).toBeCloseTo(91.2, 9);
    expect(baht(r.ingredientCostSatang)).toBe('93.32');
  });
  it('piece unit of a sub-recipe = one of its servings', () => {
    const cat = withSyrup();
    cat.itemsByRecipe.get('bb')!.push(item('bb', 'syrup', 1, 'piece', 6, { refType: 'recipe' }));
    const l = new Calculator(cat).evaluate('bb')!.lines[5];
    expect(l.netGrams).toBe(40);
  });
  it('cycle is detected before adding and flagged if present', () => {
    const cat = withSyrup();
    cat.itemsByRecipe.get('bb')!.push(item('bb', 'syrup', 40, 'g', 6, { refType: 'recipe' }));
    const calc = new Calculator(cat);
    expect(calc.wouldCycle('syrup', 'bb')).toBe(true);
    expect(calc.wouldCycle('bb', 'syrup')).toBe(false);
    expect(calc.wouldCycle('syrup', 'syrup')).toBe(true);
    cat.itemsByRecipe.get('syrup')!.push(item('syrup', 'bb', 10, 'g', 3, { refType: 'recipe' }));
    const r = new Calculator(cat).evaluate('bb')!;
    expect(r.issues).toContain('cycle');
  });
});

describe('BR-12 scale and BR-13 shopping list (AC-07, AC-08)', () => {
  it('scale 8 → 16 doubles quantities, per piece unchanged', () => {
    const cat = bananaBreadCatalog();
    const s = scaleRecipe(cat, 'bb', 16)!;
    expect(s.factor).toBe(2);
    expect(s.items.map((i) => i.quantity)).toEqual([400, 600, 200, 4, 240]);
    expect(cat.itemsByRecipe.get('bb')![0].quantity).toBe(200);
  });

  it('AC-08 shopping list for 20 pieces matches the doc', () => {
    const cat = bananaBreadCatalog();
    const list = buildShoppingList(cat, [{ recipeId: 'bb', targetServings: 20 }]);
    const by = Object.fromEntries(list.lines.map((l) => [l.ingredientId, l]));
    expect(by.butter.packs).toBe(2);
    expect(baht(by.butter.paySatang!)).toBe('190.00');
    expect(by.butter.leftoverGrams).toBeCloseTo(150, 9);
    expect(by.egg.packs).toBe(1);
    expect(by.egg.netPieces).toBeCloseTo(5, 9);
    expect(by.egg.leftoverPieces).toBeCloseTo(25, 9);
    expect(baht(by.egg.paySatang!)).toBe('135.00');
    expect(by.banana.packs).toBeNull();
    expect(by.banana.buyGrams).toBeCloseTo(1153.846, 2);
    expect(baht(by.banana.paySatang!)).toBe('46.15');
    expect(baht(by.flour.paySatang!)).toBe('45.00');
    expect(by.flour.leftoverGrams).toBeCloseTo(500, 9);
    expect(baht(by.sugar.paySatang!)).toBe('28.00');
    expect(baht(list.totalPaySatang)).toBe('444.15');
    expect(baht(list.usedCostSatang)).toBe('218.30');
    expect(list.complete).toBe(true);
  });

  it('exact pack multiple does not buy an extra pack', () => {
    const cat = bananaBreadCatalog();
    const list = buildShoppingList(cat, [{ recipeId: 'bb', targetServings: 16 }]); // butter 200 g
    expect(list.lines.find((l) => l.ingredientId === 'butter')!.packs).toBe(1);
  });

  it('FR-24 combines the same ingredient across recipes before rounding packs', () => {
    const cat = bananaBreadCatalog();
    cat.recipes.set('cookie', recipe({ id: 'cookie', name: 'คุกกี้', servings: 10 }));
    cat.itemsByRecipe.set('cookie', [item('cookie', 'butter', 150, 'g', 1)]);
    const list = buildShoppingList(cat, [{ recipeId: 'bb', targetServings: 8 }, { recipeId: 'cookie', targetServings: 10 }]);
    const b = list.lines.find((l) => l.ingredientId === 'butter')!;
    expect(b.buyGrams).toBe(250);
    expect(b.packs).toBe(2);
  });

  it('sub-recipes are expanded into raw ingredients', () => {
    const cat = bananaBreadCatalog();
    cat.ingredients.set('honey', ing({ id: 'honey', nameTh: 'น้ำผึ้ง', packPrice: 20000, packSize: 1000, packUnit: 'g', nutrition: { kcal: 304, protein: 0.3, fat: 0, carb: 82.4 } }));
    cat.recipes.set('syrup', recipe({ id: 'syrup', name: 'ไซรัป', servings: 10, cookedWeightG: 400 }));
    cat.itemsByRecipe.set('syrup', [item('syrup', 'honey', 300, 'g', 1)]);
    cat.itemsByRecipe.get('bb')!.push(item('bb', 'syrup', 40, 'g', 6, { refType: 'recipe' }));
    const list = buildShoppingList(cat, [{ recipeId: 'bb', targetServings: 8 }]);
    const h = list.lines.find((l) => l.ingredientId === 'honey')!;
    expect(h.buyGrams).toBeCloseTo(30, 9); // 40 g of a 400 g batch = 10% of 300 g honey
    expect(list.lines.some((l) => l.ingredientId === 'syrup')).toBe(false);
  });

  it('missing price → incomplete', () => {
    const cat = bananaBreadCatalog();
    cat.ingredients.get('sugar')!.packPrice = null;
    const list = buildShoppingList(cat, [{ recipeId: 'bb', targetServings: 8 }]);
    expect(list.complete).toBe(false);
    expect(list.lines.find((l) => l.ingredientId === 'sugar')!.paySatang).toBeNull();
  });
});

describe('BR-10 validation', () => {
  it('rejects macros over 100 g per 100 g of one ingredient', () => {
    const v = validateIngredient({ nameTh: 'x', nutrition: { kcal: 717, protein: 0.9, fat: 810, carb: 0.1 } });
    expect(v.errors.map((e) => e.code)).toContain('sum_over_100');
  });
  it('accepts butter', () => {
    const v = validateIngredient(bananaBreadCatalog().ingredients.get('butter')!);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
  });
  it('yield range 1–100', () => {
    expect(validateIngredient({ nameTh: 'x', yieldPct: 0 }).errors[0].code).toBe('range1_100');
    expect(validateIngredient({ nameTh: 'x', yieldPct: 101 }).errors[0].code).toBe('range1_100');
    expect(validateIngredient({ nameTh: 'x', yieldPct: 1 }).errors).toEqual([]);
  });
  it('piece pack requires grams per piece', () => {
    expect(validateIngredient({ nameTh: 'ไข่', packUnit: 'piece', packSize: 30 }).errors.map((e) => e.code)).toContain('required_for_piece');
  });
  it('FR-21 warns on kcal vs macros > 15%', () => {
    const v = validateIngredient({ nameTh: 'x', nutrition: { kcal: 100, protein: 10, fat: 10, carb: 10 } });
    expect(v.warnings.map((w) => w.code)).toContain('atwater_mismatch');
  });
  it('AC-03 servings must be at least 1', () => {
    expect(validateRecipe({ name: 'x', servings: 0 }).map((e) => e.code)).toContain('min1');
    expect(validateRecipe({ name: 'x', servings: 1 })).toEqual([]);
  });
});

describe('Label conversion and money parsing', () => {
  it('per 30 g serving → per 100 g', () => {
    const r = labelToPer100({ kcal: 150, protein: 3, fat: 9 }, 30);
    expect(r.kcal).toBeCloseTo(500, 9);
    expect(r.protein).toBeCloseTo(10, 9);
  });
  it('parses baht input', () => {
    expect(parseBahtToSatang('฿95')).toBe(9500);
    expect(parseBahtToSatang('1,250.50')).toBe(125050);
    expect(parseBahtToSatang('12.5 บาท')).toBe(1250);
    expect(parseBahtToSatang('abc')).toBeNull();
    expect(parseBahtToSatang('')).toBeNull();
  });
  it('rounds half up', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(formatBaht(1091.5)).toBe('฿10.92');
  });
});

describe('Optional nutrients are not shown as 0 when unknown', () => {
  it('sugar unknown on any line → not known; known on all → known', () => {
    const cat = bananaBreadCatalog();
    let r = new Calculator(cat).evaluate('bb')!;
    expect(r.nutrientKnown.sugar).toBe(false);
    expect(r.nutrientKnown.kcal).toBe(true);
    for (const i of cat.ingredients.values()) i.nutrition!.sugar = 1;
    r = new Calculator(cat).evaluate('bb')!;
    expect(r.nutrientKnown.sugar).toBe(true);
  });
});

describe('NFR-02 performance', () => {
  it('50-line recipe evaluates in well under 100 ms', () => {
    const cat = bananaBreadCatalog();
    const items = Array.from({ length: 50 }, (_, i) => item('bb', ['flour', 'banana', 'butter', 'egg', 'sugar'][i % 5], 10 + i, i % 5 === 3 ? 'piece' : 'g', i));
    cat.itemsByRecipe.set('bb', items);
    const t = performance.now();
    for (let k = 0; k < 10; k++) new Calculator(cat).evaluate('bb');
    expect((performance.now() - t) / 10).toBeLessThan(100);
  });
});
