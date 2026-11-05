// USDA FoodData Central (public domain, CC0 1.0). https://fdc.nal.usda.gov/api-guide/
// Values in foodNutrients of search results are per 100 g.
import type { Nutrition } from '../engine/types';

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  nutrition: Nutrition;
  /** true when one of kcal/protein/fat/carb was missing in the source */
  partial: boolean;
}

interface RawNutrient { nutrientId?: number; nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number }
interface RawFood { fdcId: number; description: string; dataType: string; brandOwner?: string; foodNutrients?: RawNutrient[] }

const ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// nutrient numbers (legacy "nutrientNumber") are stable across data types
const N = { kcal: ['208'], kcalAtwaterGeneral: ['957'], kcalAtwaterSpecific: ['958'], protein: ['203'], fat: ['204'], carb: ['205'], sugar: ['269', '269.3'], fiber: ['291'], satFat: ['606'], sodiumMg: ['307'] };

function pick(list: RawNutrient[], numbers: string[], unit?: string): number | null {
  for (const nn of numbers) {
    const f = list.find((x) => x.nutrientNumber === nn && (!unit || (x.unitName ?? '').toUpperCase() === unit));
    if (f && typeof f.value === 'number') return f.value;
  }
  return null;
}

export function normalizeFood(f: RawFood): UsdaFood {
  const list = f.foodNutrients ?? [];
  const kcal = pick(list, N.kcal, 'KCAL') ?? pick(list, N.kcalAtwaterSpecific, 'KCAL') ?? pick(list, N.kcalAtwaterGeneral, 'KCAL');
  const protein = pick(list, N.protein);
  const fat = pick(list, N.fat);
  const carb = pick(list, N.carb);
  return {
    fdcId: f.fdcId,
    description: f.description,
    dataType: f.dataType,
    brandOwner: f.brandOwner,
    partial: kcal === null || protein === null || fat === null || carb === null,
    nutrition: {
      kcal: kcal ?? 0, protein: protein ?? 0, fat: fat ?? 0, carb: carb ?? 0,
      sugar: pick(list, N.sugar), fiber: pick(list, N.fiber), satFat: pick(list, N.satFat), sodiumMg: pick(list, N.sodiumMg, 'MG'),
    },
  };
}

/**
 * D-05: the API gateway rejects some characters in the query (an encoded "/" or "%", e.g. "85% lean meat / 15% fat"),
 * which the browser reports as a network error. Search is word-based, so these characters can be dropped safely.
 */
export function searchText(query: string): string {
  return query.replace(/[/%\\?#&=+]/g, ' ').replace(/\s+/g, ' ').trim();
}

export class UsdaError extends Error {
  code: 'no_key' | 'bad_key' | 'rate_limited' | 'network' | 'http';
  constructor(code: UsdaError['code'], message: string = code) {
    super(message);
    this.code = code;
  }
}

export async function searchUsda(query: string, apiKey: string, opts: { pageSize?: number; branded?: boolean; signal?: AbortSignal } = {}): Promise<UsdaFood[]> {
  if (!apiKey) throw new UsdaError('no_key');
  const dataTypes = opts.branded ? ['Foundation', 'SR Legacy', 'Branded'] : ['Foundation', 'SR Legacy'];
  const params = new URLSearchParams({ query: searchText(query), pageSize: String(opts.pageSize ?? 15), api_key: apiKey });
  dataTypes.forEach((d) => params.append('dataType', d));
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?${params}`, { signal: opts.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new UsdaError('network');
  }
  if (res.status === 403 || res.status === 401) throw new UsdaError('bad_key');
  if (res.status === 429) throw new UsdaError('rate_limited');
  if (!res.ok) throw new UsdaError('http', `HTTP ${res.status}`);
  const body = (await res.json()) as { foods?: RawFood[] };
  return (body.foods ?? []).map(normalizeFood);
}

/** Pick the best match for a starter item: exact description in SR Legacy/Foundation first, then the first complete result. */
export function bestMatch(query: string, foods: UsdaFood[]): UsdaFood | null {
  const q = query.trim().toLowerCase();
  const generic = foods.filter((f) => f.dataType !== 'Branded');
  return (
    generic.find((f) => f.description.toLowerCase() === q && !f.partial) ??
    generic.find((f) => !f.partial) ??
    null
  );
}

export function usdaSourceLabel(f: UsdaFood) {
  return `USDA FDC #${f.fdcId}: ${f.description}`;
}
