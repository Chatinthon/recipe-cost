// QA platform suite: Google Sheet sync through the UI, offline + install, accessibility, language, layout.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'module';
import { addIngredient, noHorizontalScroll, seedBananaBread, watchErrors } from './helpers';

const require = createRequire(import.meta.url);
const { createGasServer } = require('../backend/test/gas-env.cjs');
const URL_ = 'https://script.google.com/macros/s/AKfyTEST/exec';

async function connectSheet(page: Page, server: ReturnType<typeof createGasServer>, opts: { token?: string } = {}) {
  await page.route('https://script.google.com/**', async (route) => {
    const out = server.post(route.request().postData() ?? '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) });
  });
  await page.goto('/#/settings');
  await page.getByTestId('sheet-url').fill(URL_);
  await page.getByTestId('sheet-token').fill(opts.token ?? server.token);
  await page.getByTestId('sheet-test').click();
}

const sheetCell = (server: ReturnType<typeof createGasServer>, tab: string, key: string, value: string, col: string) => {
  const row = server.findRow(tab, key, value);
  if (row < 0) return undefined;
  const sh = server.sheets[tab];
  return sh._grid[row - 1][sh._grid[0].indexOf(col)];
};

test.describe('Google Sheet sync through the UI (US-15, AC-09..11)', () => {
  test('TC-20 connect, push recipe data, summary tab written', async ({ page }) => {
    const errors = watchErrors(page);
    const server = createGasServer();
    await connectSheet(page, server);
    await expect(page.getByRole('status').filter({ hasText: 'เชื่อมสำเร็จ' })).toBeVisible();
    await seedBananaBread(page);
    await page.goto('/');
    await expect(page.getByTestId('sync-pill')).toHaveText(/sync แล้ว/, { timeout: 15000 });
    expect(server.sheets.Ingredients.getLastRow()).toBe(6);
    expect(server.sheets.RecipeItems.getLastRow()).toBe(6);
    const butterRow = server.sheets.Ingredients._grid.findIndex((r: unknown[]) => r && r[1] === 'เนยจืด');
    expect(server.sheets.Ingredients._grid[butterRow][server.sheets.Ingredients._grid[0].indexOf('packPrice')]).toBe(95);
    const s = server.sheets.RecipeSummary;
    expect(s._grid[1][s._grid[0].indexOf('costPerServe')]).toBe(10.92);
    expect(s._grid[1][s._grid[0].indexOf('kcalPerServe')]).toBe(290);
    expect(errors).toEqual([]);
  });

  test('TC-21 wrong token shows a fixable message and saves nothing', async ({ page }) => {
    const server = createGasServer();
    await connectSheet(page, server, { token: 'wrong-token' });
    await expect(page.getByRole('status').filter({ hasText: 'TOKEN ไม่ถูกต้อง' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('sheet-url')).toHaveValue('');
  });

  test('TC-22 a non-Apps-Script URL is refused before any request', async ({ page }) => {
    let calls = 0;
    await page.route('**/*evil*', (r) => { calls++; return r.abort(); });
    await page.goto('/#/settings');
    await page.getByTestId('sheet-url').fill('https://evil.example.com/exec');
    await page.getByTestId('sheet-token').fill('x');
    await page.getByTestId('sheet-test').click();
    await expect(page.getByRole('status').filter({ hasText: 'https://script.google.com/' })).toBeVisible();
    expect(calls).toBe(0);
  });

  test('TC-23 AC-09 price edited in the Sheet shows in the app after Sync now', async ({ page }) => {
    const server = createGasServer();
    await connectSheet(page, server);
    await seedBananaBread(page);
    await page.goto('/');
    await expect(page.getByTestId('sync-pill')).toHaveText(/sync แล้ว/, { timeout: 15000 });
    await page.waitForTimeout(20);
    const row = server.findRow('Ingredients', 'nameTh', 'เนยจืด');
    server.edit('Ingredients', row, 'packPrice', 105);
    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'sync ตอนนี้' }).click();
    await page.getByRole('link', { name: 'สูตร', exact: true }).click();
    await expect(page.getByTestId('recipe-card')).toContainText('฿11.54', { timeout: 15000 });
    expect(server.sheets.PriceHistory.getLastRow()).toBe(7); // 5 from the app + 1 manual edit + header
  });

  test('TC-24 AC-11 newer edit in the Sheet wins over an older offline edit, with a message', async ({ page, context }) => {
    const server = createGasServer();
    await connectSheet(page, server);
    await addIngredient(page, { name: 'เนยจืด', price: '95', size: '200', unit: 'g', kcal: '717', p: '0.9', c: '0.1', f: '81.1' });
    await page.goto('/');
    await expect(page.getByTestId('sync-pill')).toHaveText(/sync แล้ว/, { timeout: 15000 });

    await context.setOffline(true);
    await page.goto('/#/ingredients');
    await page.getByTestId('ingredient-row').click();
    await page.getByTestId('ing-price').fill('99');
    await page.getByTestId('ing-price').blur();
    await page.waitForTimeout(1000);
    await page.waitForTimeout(20);
    server.edit('Ingredients', server.findRow('Ingredients', 'nameTh', 'เนยจืด'), 'packPrice', 120);
    await context.setOffline(false);
    await expect(page.getByRole('status').filter({ hasText: 'ถูกแทนที่ด้วยค่าที่ใหม่กว่า' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('ing-price')).toHaveValue('120');
  });

  test('TC-25 AC-10 offline edits queue and reach the Sheet when back online', async ({ page, context }) => {
    const server = createGasServer();
    await connectSheet(page, server);
    await expect(page.getByRole('status').filter({ hasText: 'เชื่อมสำเร็จ' })).toBeVisible();
    await context.setOffline(true);
    await addIngredient(page, { name: 'อกไก่', price: '90', size: '1', unit: 'kg', kcal: '120', p: '22.5', c: '0', f: '2.6' });
    await page.getByRole('link', { name: 'กลับ' }).click();
    await expect(page.getByTestId('sync-pill')).toHaveText(/รอ sync 2|ออฟไลน์/);
    expect(server.findRow('Ingredients', 'nameTh', 'อกไก่')).toBe(-1);
    await context.setOffline(false);
    await expect(page.getByTestId('sync-pill')).toHaveText(/sync แล้ว/, { timeout: 10000 });
    expect(sheetCell(server, 'Ingredients', 'nameTh', 'อกไก่', 'packPrice')).toBe(90);
  });
});

test.describe('Offline & install (NFR-01, NFR-11, AC-05)', () => {
  test('TC-26 manifest and icons are installable', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const m = await (await request.get(href!)).json();
    expect(m.display).toBe('standalone');
    expect(m.name).toBe('Recipe Cost & Nutrition');
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
  });

  test('TC-27 app opens and works with no network after first visit', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('ยังไม่มีสูตร')).toBeVisible();
    await addIngredient(page, { name: 'ออฟไลน์', price: '10', size: '1', unit: 'kg', kcal: '100', p: '1', c: '20', f: '1' });
    await page.reload();
    await page.goto('/#/ingredients');
    await expect(page.getByTestId('ingredient-row')).toContainText('ออฟไลน์');
  });
});

test.describe('Accessibility (NFR-08)', () => {
  const screens: [string, (p: Page) => Promise<void>][] = [
    ['home', async (p) => { await p.goto('/'); }],
    ['editor', async (p) => { await p.goto('/'); await p.getByTestId('recipe-card').click(); }],
    ['result-cost', async (p) => { await p.goto('/'); await p.getByTestId('recipe-card').click(); await p.getByTestId('view-result').click(); }],
    ['result-nutrition', async (p) => { await p.goto('/'); await p.getByTestId('recipe-card').click(); await p.getByTestId('view-result').click(); await p.getByTestId('tab-nutrition').click(); }],
    ['shopping', async (p) => { await p.goto('/'); await p.getByTestId('recipe-card').click(); await p.getByTestId('view-result').click(); await p.getByTestId('go-shopping').click(); }],
    ['ingredients', async (p) => { await p.goto('/#/ingredients'); }],
    ['ingredient', async (p) => { await p.goto('/#/ingredients'); await p.getByTestId('ingredient-row').first().click(); }],
    ['settings', async (p) => { await p.goto('/#/settings'); }],
  ];

  for (const theme of ['light', 'dark'] as const) {
    test(`TC-28 no serious/critical axe violations, ${theme}`, async ({ page }) => {
      test.setTimeout(180_000);
      await seedBananaBread(page);
      await page.goto('/#/settings');
      await page.getByRole('button', { name: theme === 'dark' ? 'มืด' : 'สว่าง' }).click();
      const found: string[] = [];
      for (const [name, go] of screens) {
        await go(page);
        await page.waitForTimeout(150);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        for (const v of r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
          found.push(`${name}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
        }
        await noHorizontalScroll(page);
      }
      expect(found, found.join('\n')).toEqual([]);
    });
  }

  test('TC-29 130% text size and 360 px width: no sideways scrolling', async ({ page }) => {
    await seedBananaBread(page);
    await page.setViewportSize({ width: 360, height: 780 });
    for (const go of screens.map((s) => s[1])) {
      await go(page);
      await page.evaluate(() => { document.documentElement.style.fontSize = '130%'; (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = '1.3'; });
      await page.waitForTimeout(100);
      await noHorizontalScroll(page);
    }
  });
});

test.describe('Language (FR-34, NFR-07)', () => {
  test('TC-30 switching to English translates the UI and keeps data', async ({ page }) => {
    await seedBananaBread(page);
    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByRole('link', { name: 'Recipes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My recipes' })).toBeVisible();
    await expect(page.getByTestId('recipe-card')).toContainText('฿10.92');
    await page.getByTestId('recipe-card').click();
    await expect(page.getByText('One batch makes')).toBeVisible();
    await page.getByTestId('view-result').click();
    await expect(page.getByText('Suggested price')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // no Thai UI strings left on these screens except user data
    const text = await page.locator('.screen').innerText();
    const leftovers = text.split('\n').filter((l) => /[ก-ฺเ-๛]/.test(l) && !/ขนมปังกล้วยหอม|แป้งสาลี|กล้วยหอม|เนยจืด|ไข่ไก่|น้ำตาลทราย|ชิ้น/.test(l));
    expect(leftovers).toEqual([]);
  });
});

test.describe('Performance (NFR-02)', () => {
  test('TC-31 cold start and recalculation time', async ({ page }) => {
    await seedBananaBread(page);
    const t0 = Date.now();
    await page.goto('/');
    await expect(page.getByTestId('recipe-card')).toBeVisible();
    const startMs = Date.now() - t0;
    await page.getByTestId('recipe-card').click();
    const ms = await page.evaluate(async () => {
      const input = document.querySelector('[data-testid="servings"]') as HTMLInputElement;
      const out = document.querySelector('[data-testid="cost-per-serve"]')!;
      const before = out.textContent;
      const t = performance.now();
      (document.querySelector('button[aria-label="เพิ่ม"]') as HTMLButtonElement).click();
      while (out.textContent === before) await new Promise((r) => requestAnimationFrame(r));
      void input;
      return performance.now() - t;
    });
    console.log(`cold start ${startMs} ms, recalculation ${ms.toFixed(0)} ms`);
    expect(startMs).toBeLessThan(2000);
    expect(ms).toBeLessThan(100);
  });
});
