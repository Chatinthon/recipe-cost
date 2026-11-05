import type { KitchenSettings, Unit } from './types';

export const WEIGHT_UNITS: Unit[] = ['g', 'kg', 'mg'];
export const VOLUME_UNITS: Unit[] = ['ml', 'l', 'tsp', 'tbsp', 'cup'];
export const ALL_UNITS: Unit[] = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece'];

export interface UnitContext {
  gramsPerPiece?: number | null;
  densityGPerMl?: number | null;
  settings: KitchenSettings;
}

export type GramsResult = { ok: true; grams: number } | { ok: false; error: 'missing_grams_per_piece' | 'bad_quantity' };

/** BR-01: convert a quantity in any kitchen unit to grams. */
export function toGrams(quantity: number, unit: Unit | string, ctx: UnitContext): GramsResult {
  if (!Number.isFinite(quantity) || quantity < 0) return { ok: false, error: 'bad_quantity' };
  const density = ctx.densityGPerMl && ctx.densityGPerMl > 0 ? ctx.densityGPerMl : 1;
  switch (unit) {
    case 'g': return { ok: true, grams: quantity };
    case 'kg': return { ok: true, grams: quantity * 1000 };
    case 'mg': return { ok: true, grams: quantity / 1000 };
    case 'ml': return { ok: true, grams: quantity * density };
    case 'l': return { ok: true, grams: quantity * 1000 * density };
    case 'tsp': return { ok: true, grams: quantity * ctx.settings.tspMl * density };
    case 'tbsp': return { ok: true, grams: quantity * ctx.settings.tbspMl * density };
    case 'cup': return { ok: true, grams: quantity * ctx.settings.cupMl * density };
    case 'piece':
      if (!ctx.gramsPerPiece || ctx.gramsPerPiece <= 0) return { ok: false, error: 'missing_grams_per_piece' };
      return { ok: true, grams: quantity * ctx.gramsPerPiece };
    default:
      return { ok: false, error: 'bad_quantity' };
  }
}

/** Inverse of toGrams, used to show scaled quantities in the unit the user picked. */
export function fromGrams(grams: number, unit: Unit, ctx: UnitContext): number | null {
  const one = toGrams(1, unit, ctx);
  if (!one.ok || one.grams === 0) return null;
  return grams / one.grams;
}
