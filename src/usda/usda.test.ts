import { afterEach, describe, expect, it, vi } from 'vitest';
import { bestMatch, normalizeFood, searchText, searchUsda, UsdaError } from './usda';
import { STARTER } from './starter';

afterEach(() => vi.unstubAllGlobals());

describe('D-05 USDA query text', () => {
  it('drops characters the API gateway rejects', () => {
    expect(searchText('Beef, ground, 85% lean meat / 15% fat, raw')).toBe('Beef, ground, 85 lean meat 15 fat, raw');
    expect(searchText('Milk, whole, 3.25% milkfat')).toBe('Milk, whole, 3.25 milkfat');
  });

  it('no starter query sends an encoded "/" or "%"', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => { urls.push(u); return new Response(JSON.stringify({ foods: [] }), { status: 200 }); });
    for (const s of STARTER) await searchUsda(s.query, 'KEY', { pageSize: 5 });
    expect(urls).toHaveLength(STARTER.length);
    for (const u of urls) {
      const q = new URL(u).search;
      expect(q).not.toMatch(/%2F|%25/i);
    }
  });

  it('exact match still works against the original description', () => {
    const q = 'Beef, ground, 85% lean meat / 15% fat, raw';
    const foods = [
      normalizeFood({ fdcId: 1, description: 'Beef, ground, 80% lean meat / 20% fat, raw', dataType: 'SR Legacy', foodNutrients: [{ nutrientNumber: '208', unitName: 'KCAL', value: 254 }, { nutrientNumber: '203', value: 17 }, { nutrientNumber: '204', value: 20 }, { nutrientNumber: '205', value: 0 }] }),
      normalizeFood({ fdcId: 2, description: q, dataType: 'SR Legacy', foodNutrients: [{ nutrientNumber: '208', unitName: 'KCAL', value: 215 }, { nutrientNumber: '203', value: 18.6 }, { nutrientNumber: '204', value: 15 }, { nutrientNumber: '205', value: 0 }] }),
    ];
    expect(bestMatch(q, foods)!.fdcId).toBe(2);
  });

  it('maps HTTP errors to codes', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 403 }));
    await expect(searchUsda('x', 'K')).rejects.toMatchObject({ code: 'bad_key' });
    vi.stubGlobal('fetch', async () => new Response('', { status: 429 }));
    await expect(searchUsda('x', 'K')).rejects.toMatchObject({ code: 'rate_limited' });
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    await expect(searchUsda('x', 'K')).rejects.toBeInstanceOf(UsdaError);
  });

  it('kcal comes from KCAL, not kJ; Foundation foods fall back to Atwater energy', () => {
    const f = normalizeFood({ fdcId: 3, description: 'x', dataType: 'Foundation', foodNutrients: [
      { nutrientNumber: '268', unitName: 'kJ', value: 500 }, { nutrientNumber: '958', unitName: 'KCAL', value: 120 },
      { nutrientNumber: '203', value: 22 }, { nutrientNumber: '204', value: 2 }, { nutrientNumber: '205', value: 0 },
    ] });
    expect(f.nutrition.kcal).toBe(120);
    expect(f.partial).toBe(false);
  });
});
