import { expect, test } from '@playwright/test';
const canvas = page => page.locator('#game');
async function ready(page) { await page.goto('/'); await expect(canvas(page)).toHaveAttribute('data-ready', 'true'); }
async function finish(page, attack, pickup) {
  for (const health of [40, 20, 0]) {
    await attack(); await expect(canvas(page)).toHaveAttribute('data-enemy-health', String(health));
    await page.waitForTimeout(500);
  }
  await expect(canvas(page)).toHaveAttribute('data-loot-count', '1');
  await page.screenshot({ path: 'test-results/combat-drop.png' });
  await pickup(); await expect(canvas(page)).toHaveAttribute('data-inventory-count', '1');
  await expect(canvas(page)).toHaveAttribute('data-loot-count', '0');
  await pickup(); await expect(canvas(page)).toHaveAttribute('data-combat-message', 'No loot available.');
  await expect(canvas(page)).toHaveAttribute('data-inventory-count', '1');
}

test('desktop fight, kill, drop, pickup and inspection isolation', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await ready(page);
  await page.keyboard.press('e'); await expect(canvas(page)).toHaveAttribute('data-combat-message', 'No loot available.');
  await page.keyboard.press('t'); await page.keyboard.press('Space');
  await expect(canvas(page)).toHaveAttribute('data-combat-message', 'Move closer to your target or drop.');
  await expect(canvas(page)).toHaveAttribute('data-enemy-health', '60');
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-position-z')), { intervals: [20] }).toBeGreaterThan(2.1);
  await page.keyboard.up('w');
  await page.screenshot({ path: 'test-results/combat-target-desktop.png' });
  await finish(page, () => page.keyboard.press('Space'), () => page.keyboard.press('e'));
  await page.mouse.click(63, 69); await expect(canvas(page)).toHaveAttribute('data-mode', 'inspection');
  const tick = await canvas(page).getAttribute('data-simulation-tick');
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await expect(canvas(page)).toHaveAttribute('data-simulation-tick', tick);
  await expect(canvas(page)).toHaveAttribute('data-enemy-health', '0');
  await page.mouse.click(171, 69); await expect(canvas(page)).toHaveAttribute('data-inventory-count', '1');
  expect(errors).toEqual([]);
});

test('phone cosmetic preview and touch controls complete the same fight loop', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page); await page.touchscreen.tap(301, 768); // Swing preview.
  await expect(canvas(page)).toHaveAttribute('data-demonstration', 'swing');
  await page.waitForTimeout(200); await expect(canvas(page)).toHaveAttribute('data-enemy-health', '60');
  await page.touchscreen.tap(171, 69); await page.touchscreen.tap(63, 235);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 704, id: 1 }] });
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-position-z')), { intervals: [20] }).toBeGreaterThan(2.1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.screenshot({ path: 'test-results/combat-target-phone.png' });
  await finish(page, () => page.touchscreen.tap(171, 235), () => page.touchscreen.tap(279, 235));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload(); await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await page.touchscreen.tap(171, 69); await page.touchscreen.tap(63, 113); await page.touchscreen.tap(171, 113);
  await expect(canvas(page)).toHaveAttribute('data-combat-message', 'Move closer to your target or drop.');
  await page.screenshot({ path: 'test-results/combat-landscape.png' });
  expect(errors).toEqual([]); await context.close();
});


test('controller target, attack and pickup buttons are edge-triggered', async ({ page }) => {
  await page.addInitScript(() => {
    window.testPad = { id: 'Test standard controller', index: 0, timestamp: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testPad] });
  });
  await ready(page);
  await page.evaluate(() => { window.testPad.buttons[2].pressed = true; });
  await expect(canvas(page)).toHaveAttribute('data-combat-message', 'Target selected · Approach within melee range.');
  await page.evaluate(() => { window.testPad.buttons[2].pressed = false; window.testPad.axes[1] = -1; });
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-position-z')), { intervals: [20] }).toBeGreaterThan(2.1);
  await page.evaluate(() => { window.testPad.axes[1] = 0; });
  const attack = async () => {
    await page.evaluate(() => { window.testPad.buttons[0].pressed = true; });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.testPad.buttons[0].pressed = false; });
  };
  await page.evaluate(() => { window.testPad.buttons[0].pressed = true; });
  await expect(canvas(page)).toHaveAttribute('data-enemy-health', '40'); await page.waitForTimeout(600);
  await expect(canvas(page)).toHaveAttribute('data-enemy-health', '40');
  await page.evaluate(() => { window.testPad.buttons[0].pressed = false; }); await page.waitForTimeout(100);
  await attack(); await expect(canvas(page)).toHaveAttribute('data-enemy-health', '20'); await page.waitForTimeout(500);
  await attack(); await expect(canvas(page)).toHaveAttribute('data-enemy-health', '0');
  await page.evaluate(() => { window.testPad.buttons[1].pressed = true; });
  await expect(canvas(page)).toHaveAttribute('data-inventory-count', '1'); await page.waitForTimeout(300);
  await expect(canvas(page)).toHaveAttribute('data-inventory-count', '1');
});
