// E2E on a phone-sized viewport: build the reference recipe through the UI and check every number from the doc.
import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/screens/${name}.png`, fullPage: false });

async function addIngredient(page: Page, o: { name: string; price: string; size: string; unit?: string; kcal: string; p: string; c: string; f: string; yieldPct?: string; weight?: boolean; gpp?: string }) {
  await page.goto('/#/ingredient/new');
  await page.getByTestId('ing-name').fill(o.name);
  if (o.weight) await page.getByRole('button', { name: /ชั่งน้ำหนัก/ }).click();
  await page.getByTestId('ing-price').fill(o.price);
  await page.getByTestId('ing-pack-size').fill(o.size);
  if (o.unit) await page.getByTestId('ing-pack-unit').selectOption(o.unit);
  if (o.gpp) await page.getByTestId('ing-gpp').fill(o.gpp);
  await page.getByTestId('ing-kcal').fill(o.kcal);
  await page.getByTestId('ing-protein').fill(o.p);
  await page.getByTestId('ing-carb').fill(o.c);
  await page.getByTestId('ing-fat').fill(o.f);
  if (o.yieldPct) {
    await page.getByText(/ขั้นสูง/).click();
    await page.getByTestId('ing-yield').fill(o.yieldPct);
  }
  await page.getByTestId('ing-save').click();
  await expect(page).toHaveURL(/#\/ingredient\/(?!new)/);
}

async function addLine(page: Page, name: string, qty: string, unit?: string) {
  await page.getByTestId('add-item').click();
  await page.getByTestId('add-search').fill(name);
  await page.getByTestId('pick-ingredient').filter({ hasText: name }).first().click();
  await page.getByTestId('qty').fill(qty);
  if (unit) await page.getByRole('group', { name: 'หน่วย' }).getByRole('button', { name: unit, exact: true }).click();
  await page.getByTestId('save-item').click();
  await expect(page.locator('.sheet')).toHaveCount(0);
}

test('reference recipe: banana bread 8 pieces', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|net::/.test(m.text())) errors.push(m.text()); });

  await page.goto('/');
  await expect(page.getByText('ยังไม่มีสูตร')).toBeVisible();
  await shot(page, '01-empty');

  await addIngredient(page, { name: 'แป้งสาลี', price: '45', size: '1', unit: 'kg', kcal: '364', p: '10.3', c: '76.3', f: '1' });
  await addIngredient(page, { name: 'กล้วยหอม', price: '40', size: '1', unit: 'kg', kcal: '89', p: '1.1', c: '22.8', f: '0.3', yieldPct: '65', weight: true });
  await addIngredient(page, { name: 'เนยจืด', price: '95', size: '200', unit: 'g', kcal: '717', p: '0.9', c: '0.1', f: '81.1' });
  await expect(page.getByTestId('ing-computed')).toHaveText('฿0.475 / g');
  await shot(page, '06-ingredient');
  await addIngredient(page, { name: 'ไข่ไก่', price: '135', size: '30', unit: 'piece', gpp: '50', kcal: '143', p: '12.6', c: '0.7', f: '9.5' });
  await expect(page.getByTestId('ing-computed')).toHaveText('฿4.50 / ชิ้น/ฟอง');
  await addIngredient(page, { name: 'น้ำตาลทราย', price: '28', size: '1', unit: 'kg', kcal: '387', p: '0', c: '100', f: '0' });

  await page.goto('/#/ingredients');
  await expect(page.getByTestId('ingredient-row')).toHaveCount(5);
  await shot(page, '05-ingredients');

  // recipe
  await page.goto('/');
  await page.getByRole('button', { name: 'สร้างสูตรแรก' }).click();
  await page.getByTestId('recipe-name').fill('ขนมปังกล้วยหอม');
  await page.getByTestId('recipe-name').blur();
  await page.getByTestId('serving-label').fill('ชิ้น');
  await page.getByTestId('serving-label').blur();
  await page.getByTestId('servings').fill('8');
  await page.getByTestId('servings').blur();
  await addLine(page, 'แป้งสาลี', '200');
  await addLine(page, 'กล้วยหอม', '300');
  await addLine(page, 'เนยจืด', '100');
  await addLine(page, 'ไข่ไก่', '2');
  await addLine(page, 'น้ำตาลทราย', '120');

  await expect(page.getByTestId('kcal-per-serve')).toHaveText(/^290/);
  await expect(page.getByTestId('cost-per-serve')).toHaveText('฿10.92');
  await expect(page.getByTestId('item-line')).toHaveCount(5);
  await shot(page, '02-editor');

  await page.getByTestId('view-result').click();
  await expect(page.getByTestId('result-cost')).toHaveText('฿10.92');
  await expect(page.getByTestId('suggested-price')).toHaveText('฿31.19');
  await page.getByTestId('result-sell').fill('35');
  await expect(page.getByTestId('profit')).toHaveText('฿24.08 · 68.8%');
  await expect(page.getByTestId('breakdown-row').first()).toContainText('เนยจืด');
  await shot(page, '04-result-cost');
  await page.getByTestId('tab-nutrition').click();
  await expect(page.getByTestId('nutrition-table')).toContainText('290 kcal');
  await shot(page, '04-result-nutrition');

  await page.getByTestId('go-shopping').click();
  await page.getByTestId('target-servings').fill('20');
  await page.getByTestId('target-servings').blur();
  await expect(page.getByTestId('pay-total')).toHaveText('฿444.15');
  await expect(page.getByTestId('used-cost')).toHaveText('฿218.30');
  await expect(page.getByTestId('shop-line')).toHaveCount(5);
  await shot(page, '08-shopping');

  // AC-02 price change propagates
  await page.goto('/#/ingredients');
  await page.getByTestId('ingredient-row').filter({ hasText: 'เนยจืด' }).click();
  await page.getByTestId('ing-price').fill('105');
  await page.getByTestId('ing-price').blur();
  await page.getByRole('link', { name: 'กลับ' }).click();
  await page.getByRole('link', { name: 'สูตร', exact: true }).click();
  await expect(page.getByTestId('recipe-card')).toContainText('฿11.54');
  await shot(page, '01-home');

  // dark theme
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'มืด' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/');
  await shot(page, '11-home-dark');
  await page.getByTestId('recipe-card').click();
  await shot(page, '12-editor-dark');

  // persistence after reload (AC-05 data part)
  await page.reload();
  await expect(page.getByTestId('cost-per-serve')).toHaveText('฿11.54');

  expect(errors).toEqual([]);
});
