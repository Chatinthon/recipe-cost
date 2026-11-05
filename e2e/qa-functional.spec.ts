// QA functional suite: validation, editing, sub-recipes, nutrition sources, shopping, recipe management.
import { expect, test } from '@playwright/test';
import { addIngredient, addLine, fillIngredient, newRecipe, seedBananaBread, watchErrors } from './helpers';

test.describe('Ingredient validation (BR-10, FR-21)', () => {
  test('TC-01 yield 0 / macros > 100 g / piece without weight are blocked with a message', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/#/ingredient/new');
    await fillIngredient(page, { name: 'ทดสอบ', price: '10', size: '1', unit: 'kg', kcal: '717', p: '0.9', c: '0.1', f: '810', yieldPct: '0' });
    await page.getByTestId('ing-save').click();
    await expect(page).toHaveURL(/ingredient\/new/);
    await expect(page.getByText('ต้องอยู่ระหว่าง 1–100')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('รวมเกิน 100 g');
    await page.getByTestId('ing-fat').fill('81.1');
    await page.getByTestId('ing-yield').fill('100');
    await page.getByTestId('ing-pack-unit').selectOption('piece');
    await page.getByTestId('ing-save').click();
    await expect(page.getByText('ต้องใส่น้ำหนักต่อชิ้น')).toBeVisible();
    await page.getByTestId('ing-gpp').fill('50');
    await page.getByTestId('ing-save').click();
    await expect(page).toHaveURL(/#\/ingredient\/(?!new)/);
    expect(errors).toEqual([]);
  });

  test('TC-02 kcal that does not match macros shows a warning but can still be saved', async ({ page }) => {
    await page.goto('/#/ingredient/new');
    await fillIngredient(page, { name: 'แปลก', price: '10', size: '1', unit: 'kg', kcal: '100', p: '10', c: '10', f: '10' });
    await expect(page.getByText(/ต่างจากที่คำนวณจาก macro เกิน 15%/)).toBeVisible();
    await page.getByTestId('ing-save').click();
    await expect(page).toHaveURL(/#\/ingredient\/(?!new)/);
  });

  test('TC-03 money input accepts ฿ and commas', async ({ page }) => {
    await page.goto('/#/ingredient/new');
    await fillIngredient(page, { name: 'แพ็กใหญ่', price: '฿1,250', size: '5', unit: 'kg', kcal: '364', p: '10', c: '76', f: '1' });
    await expect(page.getByTestId('ing-computed')).toHaveText('฿0.25 / g');
  });
});

test.describe('Recipe editing (AC-03, AC-04, FR-22)', () => {
  test('TC-04 servings cannot go below 1', async ({ page }) => {
    await newRecipe(page, 'ทดสอบ serve', '1');
    await expect(page.getByRole('button', { name: 'ลด' })).toBeDisabled();
    await page.getByTestId('servings').fill('0');
    await page.getByTestId('servings').blur();
    await expect(page.getByTestId('servings')).toHaveValue('1');
    await page.getByTestId('servings').fill('-3');
    await page.getByTestId('servings').blur();
    await expect(page.getByTestId('servings')).toHaveValue('1');
  });

  test('TC-05 ingredient without price → line warning, "ผลยังไม่ครบ", card badge', async ({ page }) => {
    await addIngredient(page, { name: 'ไม่มีราคา', kcal: '100', p: '1', c: '20', f: '1' });
    await newRecipe(page, 'สูตรขาดราคา', '2');
    await addLine(page, 'ไม่มีราคา', '100');
    await expect(page.getByTestId('item-line')).toContainText('ไม่มีราคา');
    await expect(page.getByTestId('summary')).toContainText('ผลยังไม่ครบ');
    await page.getByRole('link', { name: 'กลับ' }).click();
    await expect(page.getByTestId('recipe-card')).toContainText('ขาดราคา 1 รายการ');
  });

  test('TC-06 edit quantity, remove line, undo', async ({ page }) => {
    await seedBananaBread(page);
    await page.getByTestId('item-line').filter({ hasText: 'เนยจืด' }).click();
    await page.getByTestId('qty').fill('200');
    await page.getByTestId('save-item').click();
    await expect(page.getByTestId('cost-per-serve')).toHaveText('฿16.85'); // (8732.15 + 4750) / 8
    await page.getByTestId('item-line').filter({ hasText: 'เนยจืด' }).click();
    await page.getByRole('button', { name: 'เอาออกจากสูตร' }).click();
    await expect(page.getByTestId('item-line')).toHaveCount(4);
    await page.getByRole('status').getByRole('button', { name: 'เลิกทำ' }).click();
    await expect(page.getByTestId('item-line')).toHaveCount(5);
    await expect(page.getByTestId('cost-per-serve')).toHaveText('฿16.85');
  });

  test('TC-07 swipe left removes a line', async ({ page }) => {
    await seedBananaBread(page);
    const line = page.getByTestId('item-line').first();
    const box = (await line.boundingBox())!;
    const y = box.y + box.height / 2;
    await line.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: box.x + box.width - 20, clientY: y }] });
    for (let dx = 20; dx <= 200; dx += 30) {
      await line.dispatchEvent('touchmove', { touches: [{ identifier: 1, clientX: box.x + box.width - 20 - dx, clientY: y }] });
    }
    await line.dispatchEvent('touchend', { touches: [] });
    await expect(page.getByTestId('item-line')).toHaveCount(4);
  });

  test('TC-08 extras, target food cost, cooked weight update results', async ({ page }) => {
    await seedBananaBread(page);
    await page.locator('summary').filter({ hasText: 'ต้นทุนเพิ่มเติม' }).click();
    await page.getByLabel('ต้นทุนแฝงต่อการทำ 1 ครั้ง (฿)').fill('8');
    await page.getByLabel('ต้นทุนแฝงต่อ serve (฿)').fill('3');
    await page.getByLabel('food cost เป้าหมาย (%)').fill('40');
    await page.getByLabel('น้ำหนักหลังปรุง (g)').fill('700');
    await page.getByLabel('น้ำหนักหลังปรุง (g)').blur();
    await expect(page.getByTestId('cost-per-serve')).toHaveText('฿14.92');
    await page.getByTestId('view-result').click();
    await expect(page.getByTestId('suggested-price')).toHaveText('฿37.29'); // 1491.52 / 0.40
    await page.getByTestId('tab-nutrition').click();
    await page.getByRole('button', { name: 'ต่อ 100 g' }).click();
    await expect(page.getByTestId('nutrition-table')).toContainText('331 kcal');
    await expect(page.getByText('คิดจากน้ำหนัก 700 g')).toBeVisible();
  });
});

test.describe('Sub-recipe (US-13, BR-11, AC-12)', () => {
  test('TC-09 use a syrup recipe inside banana bread; cycle is refused', async ({ page }) => {
    await seedBananaBread(page);
    await addIngredient(page, { name: 'น้ำผึ้ง', price: '200', size: '1000', unit: 'g', kcal: '304', p: '0.3', c: '82.4', f: '0' });
    await newRecipe(page, 'ไซรัป', '10', 'ช้อน');
    await addLine(page, 'น้ำผึ้ง', '300');
    await page.locator('summary').filter({ hasText: 'ต้นทุนเพิ่มเติม' }).click();
    await page.getByLabel('น้ำหนักหลังปรุง (g)').fill('400');
    await page.getByLabel('น้ำหนักหลังปรุง (g)').blur();
    await page.getByRole('link', { name: 'กลับ' }).click();

    await page.getByTestId('recipe-card').filter({ hasText: 'ขนมปังกล้วยหอม' }).click();
    await addLine(page, 'ไซรัป', '40', { recipe: true });
    await expect(page.getByTestId('cost-per-serve')).toHaveText('฿11.67'); // (8732.15 + 600) / 8

    await page.goto('/');
    await page.getByTestId('recipe-card').filter({ hasText: 'ไซรัป' }).click();
    await page.getByTestId('add-item').click();
    await page.getByTestId('pick-recipe').filter({ hasText: 'ขนมปังกล้วยหอม' }).click();
    await expect(page.getByText('อ้างวนกลับมาที่สูตรเดิม')).toBeVisible();
    await page.getByTestId('qty').fill('10');
    await expect(page.getByTestId('save-item')).toBeDisabled();
  });
});

test.describe('Nutrition sources (Q3)', () => {
  test('TC-10 label converter: per 30 g serving → per 100 g', async ({ page }) => {
    await addIngredient(page, { name: 'ซีเรียล', price: '120', size: '300', unit: 'g' });
    await page.getByTestId('open-label').click();
    await page.getByTestId('label-serving').fill('30');
    await page.getByTestId('label-kcal').fill('120');
    await page.getByTestId('label-protein').fill('3');
    await page.getByTestId('label-carb').fill('24');
    await page.getByTestId('label-fat').fill('1.5');
    await page.getByTestId('label-apply').click();
    await expect(page.getByTestId('ing-kcal')).toHaveValue('400');
    await expect(page.getByTestId('ing-protein')).toHaveValue('10');
    await expect(page.getByTestId('ing-carb')).toHaveValue('80');
    await expect(page.getByTestId('ing-fat')).toHaveValue('5');
    await expect(page.getByText('ฉลากสินค้า').first()).toBeVisible();
  });

  test('TC-11 USDA search without a key explains what to do', async ({ page }) => {
    await addIngredient(page, { name: 'อกไก่', price: '90', size: '1', unit: 'kg' });
    await page.getByTestId('open-usda').click();
    await expect(page.getByText('ต้องใส่ USDA API key ในหน้าตั้งค่าก่อน')).toBeVisible();
  });

  test('TC-12 USDA search fills values and source (API mocked)', async ({ page }) => {
    let sawKey = '';
    await page.route('https://api.nal.usda.gov/**', async (route) => {
      const u = new URL(route.request().url());
      sawKey = u.searchParams.get('api_key') ?? '';
      await route.fulfill({ json: { foods: [{ fdcId: 171477, description: 'Chicken, broilers or fryers, breast, meat only, raw', dataType: 'SR Legacy', foodNutrients: [
        { nutrientNumber: '208', unitName: 'KCAL', value: 120 }, { nutrientNumber: '203', unitName: 'G', value: 22.5 },
        { nutrientNumber: '204', unitName: 'G', value: 2.62 }, { nutrientNumber: '205', unitName: 'G', value: 0 },
        { nutrientNumber: '307', unitName: 'MG', value: 45 }, { nutrientNumber: '268', unitName: 'kJ', value: 502 },
      ] }] }, headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto('/#/settings');
    await page.getByTestId('usda-key').fill('TESTKEY');
    await page.getByTestId('usda-key').blur();
    await addIngredient(page, { name: 'อกไก่', price: '90', size: '1', unit: 'kg' });
    await page.getByTestId('open-usda').click();
    await page.getByTestId('usda-query').fill('chicken breast raw');
    await page.getByRole('button', { name: 'ค้นหา USDA' }).last().click();
    await expect(page.getByTestId('usda-result')).toContainText('120 kcal');
    await page.getByTestId('usda-result').click();
    await expect(page.getByTestId('ing-kcal')).toHaveValue('120');
    await expect(page.getByTestId('ing-protein')).toHaveValue('22.5');
    await expect(page.getByTestId('ing-fat')).toHaveValue('2.62');
    expect(sawKey).toBe('TESTKEY');
    await expect(page.getByText(/USDA FDC #171477/).first()).toBeVisible();
  });

  test('TC-13 starter import looks up USDA, then imports the reviewed items', async ({ page }) => {
    let calls = 0;
    let beefDown = true;
    const raw: string[] = [];
    await page.route('https://api.nal.usda.gov/**', async (route) => {
      calls++;
      raw.push(new URL(route.request().url()).search);
      const q = new URL(route.request().url()).searchParams.get('query') ?? '';
      // D-05: one item fails (like the real gateway did) — the rest must still be looked up
      if (q.startsWith('Beef') && beefDown) return route.abort('failed');
      const foods = q === 'Honey' ? [] : [{ fdcId: 1000 + calls, description: q, dataType: 'SR Legacy', foodNutrients: [
        { nutrientNumber: '208', unitName: 'KCAL', value: 100 }, { nutrientNumber: '203', unitName: 'G', value: 1 },
        { nutrientNumber: '204', unitName: 'G', value: 1 }, { nutrientNumber: '205', unitName: 'G', value: 20 },
      ] }];
      await route.fulfill({ json: { foods } });
    });
    await page.goto('/#/settings');
    await page.getByTestId('usda-key').fill('TESTKEY');
    await page.getByTestId('usda-key').blur();
    await page.goto('/#/starter');
    await page.getByTestId('starter-fetch').click();
    await expect(page.getByTestId('starter-import')).toHaveText('นำเข้า 57 รายการ', { timeout: 60000 });
    await expect(page.getByText('ไม่พบ', { exact: true })).toBeVisible();
    await expect(page.getByText('ค้นไม่สำเร็จ 1 รายการ')).toBeVisible();
    expect(raw.some((s) => /%2F|%25/i.test(s))).toBe(false);
    // retry only the failed one
    beefDown = false;
    const before = calls;
    await page.getByTestId('starter-fetch').click();
    await expect(page.getByTestId('starter-import')).toHaveText('นำเข้า 58 รายการ', { timeout: 30000 });
    expect(calls - before).toBe(1); // only the failed item is looked up again
    await page.getByRole('checkbox', { name: 'เกลือ' }).uncheck();
    await expect(page.getByTestId('starter-import')).toHaveText('นำเข้า 57 รายการ');
    await page.getByTestId('starter-import').click();
    await expect(page).toHaveURL(/#\/ingredients$/);
    await expect(page.getByTestId('ingredient-row')).toHaveCount(57);
    // imported items have no price yet and say so
    await expect(page.getByTestId('ingredient-row').first()).toContainText('ไม่มีราคา');
  });
});

test.describe('Shopping (FR-23–25)', () => {
  test('TC-14 two recipes share butter before rounding packs; save as new recipe', async ({ page }) => {
    await seedBananaBread(page);
    await newRecipe(page, 'คุกกี้', '10');
    await addLine(page, 'เนยจืด', '150');
    await page.goto('/');
    await page.getByTestId('recipe-card').filter({ hasText: 'ขนมปังกล้วยหอม' }).click();
    await page.getByTestId('view-result').click();
    await page.getByTestId('go-shopping').click();
    await page.getByRole('button', { name: 'เพิ่มสูตรอื่นในรายการซื้อ' }).click();
    await page.locator('.sheet .pick').filter({ hasText: 'คุกกี้' }).click();
    const butter = page.getByTestId('shop-line').filter({ hasText: 'เนยจืด' });
    await expect(butter).toContainText('ใช้ 250 g');
    await expect(butter).toContainText('2 × 200 g');
    await expect(page.getByTestId('save-as-new')).toBeDisabled();
    await page.getByRole('button', { name: 'เอาออก' }).click();
    await page.getByTestId('target-servings').fill('16');
    await page.getByTestId('target-servings').blur();
    await page.getByTestId('save-as-new').click();
    await expect(page.getByTestId('recipe-name')).toHaveValue('ขนมปังกล้วยหอม (16 ชิ้น)');
    await expect(page.getByTestId('servings')).toHaveValue('16');
    await expect(page.getByTestId('item-line').filter({ hasText: 'เนยจืด' })).toContainText('200 g');
    await expect(page.getByTestId('cost-per-serve')).toHaveText('฿10.92');
  });

  test('TC-15 tick items as bought', async ({ page }) => {
    await seedBananaBread(page);
    await page.getByTestId('view-result').click();
    await page.getByTestId('go-shopping').click();
    await page.getByRole('checkbox', { name: 'ซื้อเนยจืดแล้ว' }).check();
    await expect(page.getByTestId('shop-line').filter({ hasText: 'เนยจืด' })).toHaveClass(/struck/);
  });
});

test.describe('Recipe management', () => {
  test('TC-16 duplicate and delete (in-page confirmation)', async ({ page }) => {
    await seedBananaBread(page);
    await page.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }).click();
    await page.getByRole('button', { name: 'คัดลอกสูตร' }).click();
    await expect(page.getByTestId('recipe-name')).toHaveValue('ขนมปังกล้วยหอม (สำเนา)');
    await expect(page.getByTestId('item-line')).toHaveCount(5);
    await page.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }).click();
    await page.getByTestId('delete-recipe').click();
    await page.getByRole('button', { name: 'ยกเลิก' }).click();
    await expect(page.getByTestId('recipe-name')).toBeVisible();
    await page.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }).click();
    await page.getByTestId('delete-recipe').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId('recipe-card')).toHaveCount(1);
  });

  test('TC-17 search recipes by ingredient name', async ({ page }) => {
    await seedBananaBread(page);
    await newRecipe(page, 'ชาเย็น', '1', 'แก้ว');
    await page.goto('/');
    await page.getByPlaceholder('ค้นหาสูตร หรือวัตถุดิบ').fill('เนย');
    await expect(page.getByTestId('recipe-card')).toHaveCount(1);
    await expect(page.getByTestId('recipe-card')).toContainText('ขนมปังกล้วยหอม');
  });

  test('TC-18 export JSON downloads all data', async ({ page }) => {
    await seedBananaBread(page);
    await page.goto('/#/settings');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export JSON' }).click()]);
    const body = JSON.parse(await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
    expect(body.ingredients).toHaveLength(5);
    expect(body.recipes).toHaveLength(1);
    expect(body.recipeItems).toHaveLength(5);
    expect(body.priceHistory.length).toBeGreaterThanOrEqual(5);
  });
});
