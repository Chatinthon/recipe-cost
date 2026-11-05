// Domain types shared by the calculation engine, storage and UI.
// Money is always in satang (1 baht = 100 satang). Weights are in grams.

export type Unit = 'g' | 'kg' | 'mg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'piece';
export type PackUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece';
export type BaseUnit = 'g' | 'ml';
export type BuyMode = 'pack' | 'weight';
export type QuantityBasis = 'net' | 'purchased';
export type RefType = 'ingredient' | 'recipe';

export interface Nutrition {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  sugar?: number | null;
  fiber?: number | null;
  satFat?: number | null;
  sodiumMg?: number | null;
}

/** Nutrient keys that are summed across a recipe. */
export const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carb', 'sugar', 'fiber', 'satFat', 'sodiumMg'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type NutrientTotals = Record<NutrientKey, number>;

export interface Ingredient {
  id: string;
  nameTh: string;
  nameEn?: string;
  category?: string;
  baseUnit: BaseUnit;
  /** Price of one pack in satang. null = unknown price. */
  packPrice: number | null;
  packSize: number | null;
  packUnit: PackUnit | null;
  buyMode: BuyMode;
  /** Edible portion, 1–100. */
  yieldPct: number;
  gramsPerPiece?: number | null;
  densityGPerMl?: number | null;
  /** Per 100 g (or 100 ml). null = unknown nutrition. */
  nutrition: Nutrition | null;
  nutritionSource?: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  refType: RefType;
  refId: string;
  quantity: number;
  unit: Unit;
  quantityBasis: QuantityBasis;
  sortOrder: number;
  updatedAt: string;
  deleted?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  category?: string;
  /** Servings produced by cooking the recipe once (user-defined). */
  servings: number;
  servingLabel: string;
  cookedWeightG?: number | null;
  /** Extra cost per batch (gas, electricity), satang. */
  batchExtraCost: number;
  /** Extra cost per serving (box, sticker), satang. */
  perServeExtraCost: number;
  targetFoodCostPct?: number | null;
  /** Actual selling price per serving, satang. */
  sellPrice?: number | null;
  notes?: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface KitchenSettings {
  tspMl: number;
  tbspMl: number;
  cupMl: number;
  defaultFoodCostPct: number;
}

export const DEFAULT_KITCHEN: KitchenSettings = { tspMl: 5, tbspMl: 15, cupMl: 240, defaultFoodCostPct: 35 };

/** Everything the engine needs to evaluate recipes. */
export interface Catalog {
  ingredients: Map<string, Ingredient>;
  recipes: Map<string, Recipe>;
  /** Items grouped by recipe id, already filtered to non-deleted. */
  itemsByRecipe: Map<string, RecipeItem[]>;
  settings: KitchenSettings;
}

export type LineIssue =
  | 'missing_ref'
  | 'missing_price'
  | 'missing_nutrition'
  | 'missing_grams_per_piece'
  | 'missing_pack_size'
  | 'cycle'
  | 'bad_quantity';
