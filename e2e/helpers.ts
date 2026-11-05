import { expect, type Page } from '@playwright/test';

export interface Ing { name: string; price?: string; size?: string; unit?: string; kcal?: string; p?: string; c?: string; f?: string; yieldPct?: string; weight?: boolean; gpp?: string }

export const BANANA_BREAD: Ing[] = [
  { name: 'แป้งสาลี', price: '45', size: '1', unit: 'kg', kcal: '364', p: '10.3', c: '76.3', f: '1' },
  { name: 'กล้วยหอม', price: '40', size: '1', unit: 'kg', kcal: '89', p: '1.1', c: '22.8', f: '0.3', yieldPct: '65', weight: true },
  { name: 'เนยจืด', price: '95', size: '200', unit: 'g', kcal: '717', p: '0.9', c: '0.1', f: '81.1' },
  { name: 'ไข่ไก่', price: '135', size: '30', unit: 'piece', gpp: '50', kcal: '143', p: '12.6', c: '0.7', f: '9.5' },
  { name: 'น้ำตาลทราย', price: '28', size: '1', unit: 'kg', kcal: '387', p: '0', c: '100', f: '0' },
];

export async function fillIngredient(page: Page, o: Ing) {
  await page.getByTestId('ing-name').fill(o.name);
  if (o.weight) await page.getByRole('button', { name: /ชั่งน้ำหนัก|By weight/ }).click();
  if (o.price !== undefined) await page.getByTestId('ing-price').fill(o.price);
  if (o.size !== undefined) await page.getByTestId('ing-pack-size').fill(o.size);
  if (o.unit) await page.getByTestId('ing-pack-unit').selectOption(o.unit);
  if (o.gpp) await page.getByTestId('ing-gpp').fill(o.gpp);
  if (o.kcal !== undefined) await page.getByTestId('ing-kcal').fill(o.kcal);
  if (o.p !== undefined) await page.getByTestId('ing-protein').fill(o.p);
  if (o.c !== undefined) await page.getByTestId('ing-carb').fill(o.c);
  if (o.f !== undefined) await page.getByTestId('ing-fat').fill(o.f);
  if (o.yieldPct) {
    await page.locator('summary').filter({ hasText: /ขั้นสูง|Advanced/ }).click();
    await page.getByTestId('ing-yield').fill(o.yieldPct);
  }
}

export async function addIngredient(page: Page, o: Ing) {
  await page.goto('/#/ingredient/new');
  await fillIngredient(page, o);
  await page.getByTestId('ing-save').click();
  await expect(page).toHaveURL(/#\/ingredient\/(?!new)/);
}

export async function addLine(page: Page, name: string, qty: string, opts: { recipe?: boolean } = {}) {
  await page.getByTestId('add-item').click();
  await page.getByTestId('add-search').fill(name);
  await page.getByTestId(opts.recipe ? 'pick-recipe' : 'pick-ingredient').filter({ hasText: name }).first().click();
  await page.getByTestId('qty').fill(qty);
  await page.getByTestId('save-item').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
}

export async function newRecipe(page: Page, name: string, servings: string, label = 'ชิ้น') {
  await page.goto('/');
  const first = page.getByRole('button', { name: /สร้างสูตรแรก|Create first recipe/ });
  await expect(first.or(page.getByTestId('fab-new-recipe'))).toBeVisible();
  if (await first.isVisible()) await first.click();
  else await page.getByTestId('fab-new-recipe').click();
  await page.getByTestId('recipe-name').fill(name);
  await page.getByTestId('recipe-name').blur();
  await page.getByTestId('serving-label').fill(label);
  await page.getByTestId('serving-label').blur();
  await page.getByTestId('servings').fill(servings);
  await page.getByTestId('servings').blur();
  await expect(page.getByTestId('servings')).toHaveValue(servings);
}

/** Banana bread through the UI; ends on the recipe editor. */
export async function seedBananaBread(page: Page) {
  for (const i of BANANA_BREAD) await addIngredient(page, i);
  await newRecipe(page, 'ขนมปังกล้วยหอม', '8');
  await addLine(page, 'แป้งสาลี', '200');
  await addLine(page, 'กล้วยหอม', '300');
  await addLine(page, 'เนยจืด', '100');
  await addLine(page, 'ไข่ไก่', '2');
  await addLine(page, 'น้ำตาลทราย', '120');
  try {
    await expect(page.getByTestId('cost-per-serve')).toHaveText('฿10.92');
  } catch (e) {
    console.log('SEED-DUMP', JSON.stringify(await dumpStore(page, 'ingredients')));
    throw e;
  }
}

export function dumpStore(page: Page, store: string) {
  return page.evaluate((st) => new Promise((res) => {
    const r = indexedDB.open('recipe-cost');
    r.onsuccess = () => { const q = r.result.transaction(st).objectStore(st).getAll(); q.onsuccess = () => res(q.result); };
  }), store);
}

/** Fail the test on uncaught page errors (fonts and blocked network are expected in the sandbox). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}

export async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'page scrolls sideways').toBeLessThanOrEqual(0);
}
