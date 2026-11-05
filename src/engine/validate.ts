import { atwaterCheck } from './calc';
import type { Ingredient, Nutrition, Recipe } from './types';

export type FieldError = { field: string; code: string };

const NUM = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** BR-10 for an ingredient. Errors block saving; warnings are shown only. */
export function validateIngredient(ing: Partial<Ingredient>): { errors: FieldError[]; warnings: FieldError[] } {
  const errors: FieldError[] = [];
  const warnings: FieldError[] = [];
  if (!ing.nameTh?.trim() && !ing.nameEn?.trim()) errors.push({ field: 'nameTh', code: 'required' });
  if (ing.packPrice !== null && ing.packPrice !== undefined && (!NUM(ing.packPrice) || ing.packPrice < 0)) errors.push({ field: 'packPrice', code: 'min0' });
  if (ing.packSize !== null && ing.packSize !== undefined && (!NUM(ing.packSize) || ing.packSize <= 0)) errors.push({ field: 'packSize', code: 'gt0' });
  if (ing.yieldPct !== undefined && (!NUM(ing.yieldPct) || ing.yieldPct < 1 || ing.yieldPct > 100)) errors.push({ field: 'yieldPct', code: 'range1_100' });
  if (ing.gramsPerPiece !== null && ing.gramsPerPiece !== undefined && (!NUM(ing.gramsPerPiece) || ing.gramsPerPiece <= 0)) errors.push({ field: 'gramsPerPiece', code: 'gt0' });
  if (ing.packUnit === 'piece' && !(ing.gramsPerPiece && ing.gramsPerPiece > 0)) errors.push({ field: 'gramsPerPiece', code: 'required_for_piece' });
  if (ing.densityGPerMl !== null && ing.densityGPerMl !== undefined && (!NUM(ing.densityGPerMl) || ing.densityGPerMl <= 0)) errors.push({ field: 'densityGPerMl', code: 'gt0' });
  if (ing.nutrition) {
    const n = ing.nutrition;
    for (const k of ['kcal', 'protein', 'fat', 'carb', 'sugar', 'fiber', 'satFat', 'sodiumMg'] as (keyof Nutrition)[]) {
      const v = n[k];
      if (v !== null && v !== undefined && (!NUM(v) || (v as number) < 0)) errors.push({ field: k, code: 'min0' });
    }
    if (NUM(n.kcal) && n.kcal > 900) errors.push({ field: 'kcal', code: 'max900' });
    // macros of ONE ingredient per 100 g cannot exceed 100 g (typo guard); recipe totals are never checked
    const sum = (n.protein || 0) + (n.fat || 0) + (n.carb || 0);
    if (sum > 100.5) errors.push({ field: 'macros', code: 'sum_over_100' });
    if ((n.sugar || 0) > (n.carb || 0) + 0.5) warnings.push({ field: 'sugar', code: 'sugar_over_carb' });
    if ((n.satFat || 0) > (n.fat || 0) + 0.5) warnings.push({ field: 'satFat', code: 'satfat_over_fat' });
    if (NUM(n.kcal) && n.kcal > 0 && atwaterCheck(n).warn) warnings.push({ field: 'kcal', code: 'atwater_mismatch' });
  }
  return { errors, warnings };
}

export function validateRecipe(r: Partial<Recipe>): FieldError[] {
  const errors: FieldError[] = [];
  if (!r.name?.trim()) errors.push({ field: 'name', code: 'required' });
  if (!NUM(r.servings) || (r.servings as number) < 1) errors.push({ field: 'servings', code: 'min1' });
  if (r.cookedWeightG !== null && r.cookedWeightG !== undefined && (!NUM(r.cookedWeightG) || r.cookedWeightG <= 0)) errors.push({ field: 'cookedWeightG', code: 'gt0' });
  if (r.targetFoodCostPct !== null && r.targetFoodCostPct !== undefined && (!NUM(r.targetFoodCostPct) || r.targetFoodCostPct < 1 || r.targetFoodCostPct > 100)) errors.push({ field: 'targetFoodCostPct', code: 'range1_100' });
  for (const k of ['batchExtraCost', 'perServeExtraCost', 'sellPrice'] as const) {
    const v = r[k];
    if (v !== null && v !== undefined && (!NUM(v) || (v as number) < 0)) errors.push({ field: k, code: 'min0' });
  }
  return errors;
}

/** Q3 option 3: label values "per serving of X g" → per 100 g. */
export function labelToPer100(values: Partial<Nutrition>, servingGrams: number): Partial<Nutrition> {
  if (!(servingGrams > 0)) throw new Error('servingGrams must be > 0');
  const f = 100 / servingGrams;
  const out: Partial<Nutrition> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'number' && Number.isFinite(v)) (out as Record<string, number>)[k] = v * f;
  }
  return out;
}
