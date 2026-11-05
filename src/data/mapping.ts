// Convert between app models and Google Sheet rows.
// The Sheet keeps money in baht (easy to edit on a computer); the app keeps satang.
import type { Ingredient, Recipe, RecipeItem, Unit, PackUnit } from '../engine/types';
import type { PriceHistoryRow, SettingRow, SyncTable } from './db';

export type SheetRow = Record<string, string | number | boolean | null>;

const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown): boolean => v === true || v === 'TRUE' || v === 'true';
const bahtToSatang = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n * 100);
};
const satangToBaht = (v: number | null | undefined): number | '' => (v === null || v === undefined ? '' : Math.round(v) / 100);
const blank = (v: number | null | undefined): number | '' => (v === null || v === undefined ? '' : v);

const UNITS: Unit[] = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece'];
const PACK_UNITS: PackUnit[] = ['g', 'kg', 'ml', 'l', 'piece'];

export function ingredientToRow(i: Ingredient): SheetRow {
  const n = i.nutrition;
  return {
    id: i.id, nameTh: i.nameTh, nameEn: i.nameEn ?? '', category: i.category ?? '', baseUnit: i.baseUnit,
    packPrice: satangToBaht(i.packPrice), packSize: blank(i.packSize), packUnit: i.packUnit ?? '', buyMode: i.buyMode,
    yieldPct: i.yieldPct, gramsPerPiece: blank(i.gramsPerPiece), densityGPerMl: blank(i.densityGPerMl),
    kcal: n ? n.kcal : '', protein: n ? n.protein : '', fat: n ? n.fat : '', carb: n ? n.carb : '',
    sugar: blank(n?.sugar), fiber: blank(n?.fiber), satFat: blank(n?.satFat), sodiumMg: blank(n?.sodiumMg),
    nutritionSource: i.nutritionSource ?? '', updatedAt: i.updatedAt, deleted: !!i.deleted,
  };
}

export function rowToIngredient(r: SheetRow): Ingredient {
  const kcal = num(r.kcal), protein = num(r.protein), fat = num(r.fat), carb = num(r.carb);
  const hasNutrition = kcal !== null && protein !== null && fat !== null && carb !== null;
  const packUnit = PACK_UNITS.includes(r.packUnit as PackUnit) ? (r.packUnit as PackUnit) : null;
  return {
    id: str(r.id), nameTh: str(r.nameTh), nameEn: str(r.nameEn) || undefined, category: str(r.category) || undefined,
    baseUnit: r.baseUnit === 'ml' ? 'ml' : 'g',
    packPrice: bahtToSatang(r.packPrice), packSize: num(r.packSize), packUnit,
    buyMode: r.buyMode === 'weight' ? 'weight' : 'pack',
    yieldPct: num(r.yieldPct) ?? 100, gramsPerPiece: num(r.gramsPerPiece), densityGPerMl: num(r.densityGPerMl),
    nutrition: hasNutrition
      ? { kcal: kcal!, protein: protein!, fat: fat!, carb: carb!, sugar: num(r.sugar), fiber: num(r.fiber), satFat: num(r.satFat), sodiumMg: num(r.sodiumMg) }
      : null,
    nutritionSource: str(r.nutritionSource) || undefined,
    updatedAt: str(r.updatedAt), deleted: bool(r.deleted),
  };
}

export function recipeToRow(r: Recipe): SheetRow {
  return {
    id: r.id, name: r.name, category: r.category ?? '', servings: r.servings, servingLabel: r.servingLabel,
    cookedWeightG: blank(r.cookedWeightG), batchExtraCost: satangToBaht(r.batchExtraCost), perServeExtraCost: satangToBaht(r.perServeExtraCost),
    targetFoodCostPct: blank(r.targetFoodCostPct), sellPrice: satangToBaht(r.sellPrice), notes: r.notes ?? '',
    updatedAt: r.updatedAt, deleted: !!r.deleted,
  };
}

export function rowToRecipe(r: SheetRow): Recipe {
  return {
    id: str(r.id), name: str(r.name), category: str(r.category) || undefined,
    servings: Math.max(1, num(r.servings) ?? 1), servingLabel: str(r.servingLabel) || 'serve',
    cookedWeightG: num(r.cookedWeightG), batchExtraCost: bahtToSatang(r.batchExtraCost) ?? 0, perServeExtraCost: bahtToSatang(r.perServeExtraCost) ?? 0,
    targetFoodCostPct: num(r.targetFoodCostPct), sellPrice: bahtToSatang(r.sellPrice), notes: str(r.notes) || undefined,
    updatedAt: str(r.updatedAt), deleted: bool(r.deleted),
  };
}

export function itemToRow(i: RecipeItem): SheetRow {
  return {
    id: i.id, recipeId: i.recipeId, refType: i.refType, refId: i.refId, quantity: i.quantity, unit: i.unit,
    quantityBasis: i.quantityBasis, sortOrder: i.sortOrder, updatedAt: i.updatedAt, deleted: !!i.deleted,
  };
}

export function rowToItem(r: SheetRow): RecipeItem {
  return {
    id: str(r.id), recipeId: str(r.recipeId), refType: r.refType === 'recipe' ? 'recipe' : 'ingredient', refId: str(r.refId),
    quantity: num(r.quantity) ?? 0, unit: UNITS.includes(r.unit as Unit) ? (r.unit as Unit) : 'g',
    quantityBasis: r.quantityBasis === 'purchased' ? 'purchased' : 'net', sortOrder: num(r.sortOrder) ?? 0,
    updatedAt: str(r.updatedAt), deleted: bool(r.deleted),
  };
}

export function priceToRow(p: PriceHistoryRow): SheetRow {
  return {
    id: p.id, ingredientId: p.ingredientId, packPrice: satangToBaht(p.packPrice), packSize: blank(p.packSize), packUnit: p.packUnit ?? '',
    store: p.store ?? '', recordedAt: p.recordedAt, updatedAt: p.updatedAt, deleted: !!p.deleted,
  };
}

export function rowToPrice(r: SheetRow): PriceHistoryRow {
  return {
    id: str(r.id), ingredientId: str(r.ingredientId), packPrice: bahtToSatang(r.packPrice) ?? 0, packSize: num(r.packSize),
    packUnit: str(r.packUnit) || null, store: str(r.store) || undefined, recordedAt: str(r.recordedAt).slice(0, 10),
    updatedAt: str(r.updatedAt), deleted: bool(r.deleted),
  };
}

export function settingToRow(s: SettingRow): SheetRow {
  return { key: s.key, value: s.value, updatedAt: s.updatedAt };
}

export function rowToSetting(r: SheetRow): SettingRow {
  return { key: str(r.key), value: str(r.value), updatedAt: str(r.updatedAt) };
}

export const keyOf = (t: SyncTable) => (t === 'Settings' ? 'key' : 'id');
