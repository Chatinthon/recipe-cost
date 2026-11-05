import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { buildCatalog } from '../data/repo';
import { Calculator } from '../engine/calc';
import { DEFAULT_KITCHEN, type Catalog, type KitchenSettings } from '../engine/types';

/** Live catalog from IndexedDB; recalculates whenever any table changes (FR-16). */
export function useCatalog(): { catalog: Catalog | null; calc: Calculator | null } {
  const data = useLiveQuery(async () => {
    const [ingredients, recipes, items, settingRows] = await Promise.all([
      db.ingredients.toArray(), db.recipes.toArray(), db.recipeItems.toArray(), db.settings.toArray(),
    ]);
    const settings: KitchenSettings = { ...DEFAULT_KITCHEN };
    for (const r of settingRows) {
      const n = Number(r.value);
      if (r.key in settings && Number.isFinite(n) && n > 0) (settings as unknown as Record<string, number>)[r.key] = n;
    }
    return { ingredients, recipes, items, settings };
  }, []);
  return useMemo(() => {
    if (!data) return { catalog: null, calc: null };
    const catalog = buildCatalog(data.ingredients, data.recipes, data.items, data.settings);
    return { catalog, calc: new Calculator(catalog) };
  }, [data]);
}
