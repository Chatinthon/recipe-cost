// Test fixture: "ขนมปังกล้วยหอม 8 ชิ้น" from the requirement doc, section 9.
import { DEFAULT_KITCHEN } from './types';
import type { Catalog, Ingredient, Recipe, RecipeItem } from './types';

const T = '2026-11-05T00:00:00.000Z';

export function ing(p: Partial<Ingredient> & Pick<Ingredient, 'id' | 'nameTh'>): Ingredient {
  return {
    baseUnit: 'g', packPrice: null, packSize: null, packUnit: null, buyMode: 'pack', yieldPct: 100,
    nutrition: null, updatedAt: T, ...p,
  };
}

export function item(recipeId: string, refId: string, quantity: number, unit: RecipeItem['unit'], sortOrder: number, extra: Partial<RecipeItem> = {}): RecipeItem {
  return { id: `${recipeId}-${sortOrder}`, recipeId, refType: 'ingredient', refId, quantity, unit, quantityBasis: 'net', sortOrder, updatedAt: T, ...extra };
}

export function recipe(p: Partial<Recipe> & Pick<Recipe, 'id' | 'name' | 'servings'>): Recipe {
  return { servingLabel: 'ชิ้น', batchExtraCost: 0, perServeExtraCost: 0, updatedAt: T, ...p };
}

export function bananaBreadCatalog(): Catalog {
  const ingredients = [
    ing({ id: 'flour', nameTh: 'แป้งสาลี', packPrice: 4500, packSize: 1, packUnit: 'kg', nutrition: { kcal: 364, protein: 10.3, fat: 1.0, carb: 76.3 } }),
    ing({ id: 'banana', nameTh: 'กล้วยหอม', packPrice: 4000, packSize: 1, packUnit: 'kg', buyMode: 'weight', yieldPct: 65, nutrition: { kcal: 89, protein: 1.1, fat: 0.3, carb: 22.8 } }),
    ing({ id: 'butter', nameTh: 'เนยจืด', packPrice: 9500, packSize: 200, packUnit: 'g', nutrition: { kcal: 717, protein: 0.9, fat: 81.1, carb: 0.1 } }),
    ing({ id: 'egg', nameTh: 'ไข่ไก่', packPrice: 13500, packSize: 30, packUnit: 'piece', gramsPerPiece: 50, nutrition: { kcal: 143, protein: 12.6, fat: 9.5, carb: 0.7 } }),
    ing({ id: 'sugar', nameTh: 'น้ำตาลทราย', packPrice: 2800, packSize: 1, packUnit: 'kg', nutrition: { kcal: 387, protein: 0, fat: 0, carb: 100 } }),
  ];
  const r = recipe({ id: 'bb', name: 'ขนมปังกล้วยหอม', servings: 8 });
  const items = [
    item('bb', 'flour', 200, 'g', 1),
    item('bb', 'banana', 300, 'g', 2),
    item('bb', 'butter', 100, 'g', 3),
    item('bb', 'egg', 2, 'piece', 4),
    item('bb', 'sugar', 120, 'g', 5),
  ];
  return {
    ingredients: new Map(ingredients.map((i) => [i.id, i])),
    recipes: new Map([[r.id, r]]),
    itemsByRecipe: new Map([['bb', items]]),
    settings: { ...DEFAULT_KITCHEN },
  };
}
