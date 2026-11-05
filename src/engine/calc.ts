import { toGrams } from './units';
import { NUTRIENT_KEYS } from './types';
import type { Catalog, Ingredient, LineIssue, NutrientKey, NutrientTotals, Nutrition, Recipe, RecipeItem } from './types';

export function zeroNutrients(): NutrientTotals {
  return { kcal: 0, protein: 0, fat: 0, carb: 0, sugar: 0, fiber: 0, satFat: 0, sodiumMg: 0 };
}

function addScaled(acc: NutrientTotals, per: Partial<Record<string, number | null | undefined>>, factor: number) {
  for (const k of NUTRIENT_KEYS) {
    const v = per[k];
    if (typeof v === 'number' && Number.isFinite(v)) acc[k] += v * factor;
  }
}

function divide(n: NutrientTotals, d: number): NutrientTotals {
  const out = zeroNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = d > 0 ? n[k] / d : 0;
  return out;
}

/** What a recipe line draws on: a raw ingredient or another recipe. */
interface Source {
  name: string;
  yieldPct: number;
  gramsPerPiece: number | null;
  densityGPerMl: number | null;
  /** satang per purchased gram, null if unknown */
  costPerGram: number | null;
  /** nutrients per net gram, null if unknown */
  nutrientsPerGram: NutrientTotals | null;
  /** Nutrients with a real value (optional ones may be blank on a label). */
  known: Set<NutrientKey>;
  issues: LineIssue[];
}

export interface LineResult {
  item: RecipeItem;
  name: string;
  netGrams: number;
  purchasedGrams: number;
  costSatang: number | null;
  nutrients: NutrientTotals | null;
  known: Set<NutrientKey>;
  issues: LineIssue[];
}

export interface CostShare {
  itemId: string;
  name: string;
  costSatang: number;
  pct: number;
}

export interface RecipeResult {
  recipeId: string;
  servings: number;
  lines: LineResult[];
  totalNetGrams: number;
  /** Cooked weight when given, else the sum of net grams. */
  batchWeightG: number;
  /** Ingredient cost of the whole batch, satang (lines with a known cost only). */
  ingredientCostSatang: number;
  /** Ingredient cost + batch extra cost. */
  batchCostSatang: number;
  nutrients: NutrientTotals;
  /** false when at least one line has no value for that nutrient (show "—", not a partial sum). */
  nutrientKnown: Record<NutrientKey, boolean>;
  perServe: { costSatang: number; nutrients: NutrientTotals };
  per100g: NutrientTotals | null;
  /** Share of energy from protein / carb / fat, 0–100 each (Atwater 4/4/9). */
  energySplit: { protein: number; carb: number; fat: number };
  breakdown: CostShare[];
  foodCostPct: number;
  suggestedPriceSatang: number;
  profitSatang: number | null;
  marginPct: number | null;
  costComplete: boolean;
  nutritionComplete: boolean;
  issues: LineIssue[];
}

/** BR-02: satang per gram of the pack as purchased. */
export function costPerGram(ing: Ingredient, catalog: Catalog): { value: number | null; issue?: LineIssue } {
  if (ing.packPrice === null || ing.packPrice === undefined || !Number.isFinite(ing.packPrice)) return { value: null, issue: 'missing_price' };
  if (!ing.packSize || !ing.packUnit) return { value: null, issue: 'missing_pack_size' };
  const g = toGrams(ing.packSize, ing.packUnit, { gramsPerPiece: ing.gramsPerPiece, densityGPerMl: ing.densityGPerMl, settings: catalog.settings });
  if (!g.ok) return { value: null, issue: g.error === 'missing_grams_per_piece' ? 'missing_grams_per_piece' : 'missing_pack_size' };
  if (g.grams <= 0) return { value: null, issue: 'missing_pack_size' };
  return { value: ing.packPrice / g.grams };
}

function nutritionPerGram(n: Nutrition | null): NutrientTotals | null {
  if (!n) return null;
  const out = zeroNutrients();
  addScaled(out, n as unknown as Record<string, number>, 1 / 100);
  return out;
}

function ingredientSource(ing: Ingredient, catalog: Catalog): Source {
  const issues: LineIssue[] = [];
  const c = costPerGram(ing, catalog);
  if (c.issue) issues.push(c.issue);
  const n = nutritionPerGram(ing.nutrition);
  if (!n) issues.push('missing_nutrition');
  return {
    name: ing.nameTh || ing.nameEn || '',
    yieldPct: ing.yieldPct > 0 && ing.yieldPct <= 100 ? ing.yieldPct : 100,
    gramsPerPiece: ing.gramsPerPiece ?? null,
    densityGPerMl: ing.densityGPerMl ?? null,
    costPerGram: c.value,
    nutrientsPerGram: n,
    known: new Set(NUTRIENT_KEYS.filter((k) => typeof ing.nutrition?.[k] === 'number')),
    issues,
  };
}

export class Calculator {
  private memo = new Map<string, RecipeResult>();
  private readonly catalog: Catalog;
  constructor(catalog: Catalog) {
    this.catalog = catalog;
  }

  /** Detect whether adding `childId` as an item of `parentId` would create a cycle (BR-11). */
  wouldCycle(parentId: string, childId: string): boolean {
    if (parentId === childId) return true;
    const seen = new Set<string>();
    const stack = [childId];
    while (stack.length) {
      const id = stack.pop()!;
      if (id === parentId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const it of this.catalog.itemsByRecipe.get(id) ?? []) if (it.refType === 'recipe') stack.push(it.refId);
    }
    return false;
  }

  private recipeSource(recipe: Recipe, visiting: Set<string>): Source {
    if (visiting.has(recipe.id)) {
      return { name: recipe.name, yieldPct: 100, gramsPerPiece: null, densityGPerMl: null, costPerGram: null, nutrientsPerGram: null, known: new Set(), issues: ['cycle'] };
    }
    const r = this.evaluateInner(recipe, visiting);
    const w = r.batchWeightG;
    const issues: LineIssue[] = [];
    if (!r.costComplete) issues.push('missing_price');
    if (!r.nutritionComplete) issues.push('missing_nutrition');
    if (r.issues.includes('cycle')) issues.push('cycle');
    return {
      name: recipe.name,
      yieldPct: 100,
      gramsPerPiece: recipe.servings > 0 && w > 0 ? w / recipe.servings : null,
      densityGPerMl: null,
      costPerGram: w > 0 ? r.batchCostSatang / w : null,
      nutrientsPerGram: w > 0 ? divide(r.nutrients, w) : null,
      known: new Set(NUTRIENT_KEYS.filter((k) => r.nutrientKnown[k])),
      issues,
    };
  }

  private source(item: RecipeItem, visiting: Set<string>): Source | null {
    if (item.refType === 'recipe') {
      const rec = this.catalog.recipes.get(item.refId);
      return rec && !rec.deleted ? this.recipeSource(rec, visiting) : null;
    }
    const ing = this.catalog.ingredients.get(item.refId);
    return ing && !ing.deleted ? ingredientSource(ing, this.catalog) : null;
  }

  private line(item: RecipeItem, visiting: Set<string>): LineResult {
    const src = this.source(item, visiting);
    if (!src) return { item, name: '', netGrams: 0, purchasedGrams: 0, costSatang: null, nutrients: null, known: new Set(), issues: ['missing_ref'] };
    const issues = [...src.issues];
    const g = toGrams(item.quantity, item.unit, { gramsPerPiece: src.gramsPerPiece, densityGPerMl: src.densityGPerMl, settings: this.catalog.settings });
    if (!g.ok) {
      issues.push(g.error === 'missing_grams_per_piece' ? 'missing_grams_per_piece' : 'bad_quantity');
      return { item, name: src.name, netGrams: 0, purchasedGrams: 0, costSatang: null, nutrients: null, known: src.known, issues };
    }
    const y = src.yieldPct / 100;
    // BR-03: quantities are net (edible) by default; purchased weight = net / yield.
    const netGrams = item.quantityBasis === 'purchased' ? g.grams * y : g.grams;
    const purchasedGrams = item.quantityBasis === 'purchased' ? g.grams : g.grams / y;
    // BR-04 cost from purchased weight; BR-05 nutrition from net weight.
    const costSatang = src.costPerGram === null ? null : purchasedGrams * src.costPerGram;
    let nutrients: NutrientTotals | null = null;
    if (src.nutrientsPerGram) {
      nutrients = zeroNutrients();
      addScaled(nutrients, src.nutrientsPerGram, netGrams);
    }
    return { item, name: src.name, netGrams, purchasedGrams, costSatang, nutrients, known: src.known, issues };
  }

  evaluate(recipeId: string): RecipeResult | null {
    const recipe = this.catalog.recipes.get(recipeId);
    if (!recipe) return null;
    return this.evaluateInner(recipe, new Set());
  }

  private evaluateInner(recipe: Recipe, visiting: Set<string>): RecipeResult {
    const cached = this.memo.get(recipe.id);
    if (cached) return cached;
    visiting.add(recipe.id);
    const items = [...(this.catalog.itemsByRecipe.get(recipe.id) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const lines = items.map((it) => this.line(it, visiting));
    visiting.delete(recipe.id);

    const nutrients = zeroNutrients();
    let ingredientCost = 0;
    let totalNet = 0;
    let costComplete = true;
    let nutritionComplete = true;
    const issues = new Set<LineIssue>();
    for (const l of lines) {
      totalNet += l.netGrams;
      if (l.costSatang === null) costComplete = false; else ingredientCost += l.costSatang;
      if (l.nutrients === null) nutritionComplete = false; else addScaled(nutrients, l.nutrients, 1);
      l.issues.forEach((i) => issues.add(i));
    }
    const nutrientKnown = Object.fromEntries(
      NUTRIENT_KEYS.map((k) => [k, lines.length > 0 && lines.every((l) => l.nutrients === null || l.known.has(k))]),
    ) as Record<NutrientKey, boolean>;
    const servings = recipe.servings >= 1 ? recipe.servings : 1;
    const batchCost = ingredientCost + (recipe.batchExtraCost || 0);
    const perServeCost = batchCost / servings + (recipe.perServeExtraCost || 0);
    const batchWeight = recipe.cookedWeightG && recipe.cookedWeightG > 0 ? recipe.cookedWeightG : totalNet;

    const pE = nutrients.protein * 4, cE = nutrients.carb * 4, fE = nutrients.fat * 9;
    const eSum = pE + cE + fE;
    const energySplit = eSum > 0
      ? { protein: (pE / eSum) * 100, carb: (cE / eSum) * 100, fat: (fE / eSum) * 100 }
      : { protein: 0, carb: 0, fat: 0 };

    const breakdown: CostShare[] = lines
      .filter((l) => l.costSatang !== null)
      .map((l) => ({ itemId: l.item.id, name: l.name, costSatang: l.costSatang!, pct: ingredientCost > 0 ? (l.costSatang! / ingredientCost) * 100 : 0 }))
      .sort((a, b) => b.costSatang - a.costSatang);

    const foodCostPct = recipe.targetFoodCostPct && recipe.targetFoodCostPct > 0 && recipe.targetFoodCostPct <= 100
      ? recipe.targetFoodCostPct
      : this.catalog.settings.defaultFoodCostPct;
    const suggested = perServeCost / (foodCostPct / 100);
    const sell = recipe.sellPrice ?? null;
    const profit = sell !== null && sell > 0 ? sell - perServeCost : null;
    const margin = profit !== null && sell ? (profit / sell) * 100 : null;

    const result: RecipeResult = {
      recipeId: recipe.id,
      servings,
      lines,
      totalNetGrams: totalNet,
      batchWeightG: batchWeight,
      ingredientCostSatang: ingredientCost,
      batchCostSatang: batchCost,
      nutrients,
      nutrientKnown,
      perServe: { costSatang: perServeCost, nutrients: divide(nutrients, servings) },
      per100g: batchWeight > 0 ? divide(nutrients, batchWeight / 100) : null,
      energySplit,
      breakdown,
      foodCostPct,
      suggestedPriceSatang: suggested,
      profitSatang: profit,
      marginPct: margin,
      costComplete,
      nutritionComplete,
      issues: [...issues],
    };
    // Only cache top-level-safe results (a result computed while a parent was visiting may contain a cycle marker).
    if (!result.issues.includes('cycle')) this.memo.set(recipe.id, result);
    return result;
  }
}

/** BR-07: energy from macros (Atwater 4/4/9) and its deviation from the stated kcal, in %. */
export function atwaterCheck(n: Pick<Nutrition, 'kcal' | 'protein' | 'carb' | 'fat'>): { kcalFromMacros: number; diffPct: number; warn: boolean } {
  const fromMacros = 4 * (n.protein || 0) + 4 * (n.carb || 0) + 9 * (n.fat || 0);
  const base = n.kcal || 0;
  const diffPct = base > 0 ? (Math.abs(fromMacros - base) / base) * 100 : fromMacros > 0 ? 100 : 0;
  return { kcalFromMacros: fromMacros, diffPct, warn: diffPct > 15 };
}
