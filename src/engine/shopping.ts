import { Calculator, costPerGram } from './calc';
import { fromGrams, toGrams } from './units';
import type { Catalog, Ingredient, LineIssue, PackUnit, RecipeItem, Unit } from './types';

export interface ScaledItem {
  item: RecipeItem;
  name: string;
  /** Quantity in the item's own unit after scaling. */
  quantity: number;
  unit: Unit;
}

/** BR-12: scale factor and scaled quantities; the original recipe is not changed. */
export function scaleRecipe(catalog: Catalog, recipeId: string, targetServings: number): { factor: number; items: ScaledItem[] } | null {
  const recipe = catalog.recipes.get(recipeId);
  if (!recipe || !(targetServings > 0)) return null;
  const factor = targetServings / (recipe.servings >= 1 ? recipe.servings : 1);
  const items = [...(catalog.itemsByRecipe.get(recipeId) ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((it) => {
      const name = it.refType === 'recipe' ? catalog.recipes.get(it.refId)?.name ?? '' : catalog.ingredients.get(it.refId)?.nameTh ?? '';
      return { item: it, name, quantity: it.quantity * factor, unit: it.unit };
    });
  return { factor, items };
}

export interface ShoppingLine {
  ingredientId: string;
  name: string;
  buyMode: Ingredient['buyMode'];
  netGrams: number;
  /** Grams to buy including the inedible part (BR-13). */
  buyGrams: number;
  packs: number | null;
  packSize: number | null;
  packUnit: PackUnit | null;
  packGrams: number | null;
  /** Money to pay at the shop, satang. */
  paySatang: number | null;
  leftoverGrams: number | null;
  /** Counts in pieces when the ingredient is bought by the piece. */
  netPieces: number | null;
  leftoverPieces: number | null;
  issues: LineIssue[];
}

export interface ShoppingList {
  lines: ShoppingLine[];
  /** Sum of what is paid at the shop (whole packs), satang. */
  totalPaySatang: number;
  /** Cost of what the recipes actually use, satang. */
  usedCostSatang: number;
  complete: boolean;
}

export interface ShoppingRequest {
  recipeId: string;
  targetServings: number;
}

/**
 * BR-13: shopping list for one or more recipes at target servings.
 * Sub-recipes are expanded into their raw ingredients; the same ingredient is summed before rounding up to packs.
 */
export function buildShoppingList(catalog: Catalog, requests: ShoppingRequest[]): ShoppingList {
  const calc = new Calculator(catalog);
  const need = new Map<string, { net: number; buy: number }>();
  let usedCost = 0;
  let complete = true;

  const expand = (recipeId: string, factor: number, visiting: Set<string>) => {
    if (visiting.has(recipeId)) { complete = false; return; }
    const res = calc.evaluate(recipeId);
    if (!res) { complete = false; return; }
    visiting.add(recipeId);
    for (const line of res.lines) {
      const it = line.item;
      if (it.refType === 'recipe') {
        const sub = calc.evaluate(it.refId);
        if (!sub || sub.batchWeightG <= 0) { complete = false; continue; }
        expand(it.refId, (line.netGrams * factor) / sub.batchWeightG, visiting);
        continue;
      }
      if (line.issues.includes('missing_ref') || line.issues.includes('bad_quantity') || line.issues.includes('missing_grams_per_piece')) { complete = false; continue; }
      const cur = need.get(it.refId) ?? { net: 0, buy: 0 };
      cur.net += line.netGrams * factor;
      cur.buy += line.purchasedGrams * factor;
      need.set(it.refId, cur);
      if (line.costSatang === null) complete = false; else usedCost += line.costSatang * factor;
    }
    visiting.delete(recipeId);
  };

  for (const r of requests) {
    const rec = catalog.recipes.get(r.recipeId);
    if (!rec || !(r.targetServings > 0)) continue;
    const res = calc.evaluate(r.recipeId);
    if (!res) continue;
    // per-batch extras scale with batches; per-serve extras with servings
    const factor = r.targetServings / res.servings;
    usedCost += (rec.batchExtraCost || 0) * factor + (rec.perServeExtraCost || 0) * r.targetServings;
    expand(r.recipeId, factor, new Set());
  }

  const lines: ShoppingLine[] = [];
  let totalPay = 0;
  for (const [id, n] of need) {
    const ing = catalog.ingredients.get(id)!;
    const ctx = { gramsPerPiece: ing.gramsPerPiece, densityGPerMl: ing.densityGPerMl, settings: catalog.settings };
    const issues: LineIssue[] = [];
    const cpg = costPerGram(ing, catalog);
    let packGrams: number | null = null;
    if (ing.packSize && ing.packUnit) {
      const g = toGrams(ing.packSize, ing.packUnit, ctx);
      if (g.ok && g.grams > 0) packGrams = g.grams;
    }
    let packs: number | null = null;
    let pay: number | null = null;
    let leftover: number | null = null;
    if (ing.buyMode === 'weight') {
      pay = cpg.value === null ? null : n.buy * cpg.value;
    } else if (packGrams !== null) {
      packs = Math.ceil(n.buy / packGrams - 1e-9);
      leftover = packs * packGrams - n.buy;
      pay = ing.packPrice === null ? null : packs * ing.packPrice;
    }
    if (pay === null) { issues.push(cpg.issue ?? 'missing_pack_size'); complete = false; } else totalPay += pay;
    const pieces = ing.gramsPerPiece && ing.gramsPerPiece > 0 && (ing.packUnit === 'piece');
    lines.push({
      ingredientId: id,
      name: ing.nameTh || ing.nameEn || '',
      buyMode: ing.buyMode,
      netGrams: n.net,
      buyGrams: n.buy,
      packs,
      packSize: ing.packSize,
      packUnit: ing.packUnit,
      packGrams,
      paySatang: pay,
      leftoverGrams: leftover,
      netPieces: pieces ? fromGrams(n.net, 'piece', ctx) : null,
      leftoverPieces: pieces && leftover !== null ? fromGrams(leftover, 'piece', ctx) : null,
      issues,
    });
  }
  lines.sort((a, b) => (b.paySatang ?? 0) - (a.paySatang ?? 0));
  return { lines, totalPaySatang: totalPay, usedCostSatang: usedCost, complete };
}
