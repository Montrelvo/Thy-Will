import { test, expect } from '@playwright/test';
const KEY = 'thy-will.character.v1';
const canvas = page => page.locator('#game');
const position = page => canvas(page).evaluate(c => ({ x: c.dataset.positionX, z: c.dataset.positionZ }));
async function ready(page) { await page.goto('/'); await expect(canvas(page)).toHaveAttribute('data-ready', 'true'); }
function panelPoint(width, height, x, y) {
  const left = height < 520 ? width - 342 : (width - 330) / 2;
  const top = height < 520 ? height - 232 : height - 238;
  return { x: left + x, y: top + y };
}

test('desktop inspection shares character choices with arena and survives reload', async ({ page }) => {
  await ready(page); await expect(canvas(page)).toHaveAttribute('data-mode', 'arena');
  const id = await canvas(page).getAttribute('data-character-id');
  await page.keyboard.down('w'); await page.waitForTimeout(300); await page.keyboard.up('w');
  const before = await position(page);
  await page.mouse.click(63, 69); await expect(canvas(page)).toHaveAttribute('data-mode', 'inspection');
  const color = panelPoint(1280, 800, 59, 115); await page.mouse.click(color.x, color.y);
  await expect(canvas(page)).toHaveAttribute('data-palette', 'crimson');
  const sword = panelPoint(1280, 800, 165, 115); await page.mouse.click(sword.x, sword.y);
  await expect(canvas(page)).toHaveAttribute('data-weapon', 'none');
  const run = panelPoint(1280, 800, 165, 162); await page.mouse.click(run.x, run.y);
  await expect(canvas(page)).toHaveAttribute('data-demonstration', 'run');
  await page.keyboard.down('w'); await page.waitForTimeout(150); await page.keyboard.up('w');
  expect(await position(page)).toEqual(before);
  await page.mouse.click(279, 69); await expect(canvas(page)).toHaveAttribute('data-mode', 'inspection'); // Story disabled.
  await page.screenshot({ path: 'test-results/character-desktop.png' });
  await page.mouse.click(171, 69); await expect(canvas(page)).toHaveAttribute('data-mode', 'arena');
  expect(await position(page)).toEqual(before); await expect(canvas(page)).toHaveAttribute('data-palette', 'crimson');
  await page.reload(); await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(canvas(page)).toHaveAttribute('data-character-id', id);
  await expect(canvas(page)).toHaveAttribute('data-weapon', 'none');
  await expect(canvas(page)).toHaveAttribute('data-palette', 'crimson');
});

test('corrupt saves are preserved and denied storage still permits a playable session', async ({ browser }) => {
  for (const denied of [false, true]) {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.addInitScript(({ denied, key }) => {
      if (denied) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } });
      else window.localStorage.setItem(key, '{broken');
    }, { denied, key: KEY });
    await ready(page); await expect(canvas(page)).toHaveAttribute('data-storage', denied ? 'session' : 'recovery');
    if (!denied) expect(await page.evaluate(key => window.localStorage.getItem(key), KEY)).toBe('{broken');
    await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w');
    expect(Number((await position(page)).z)).toBeGreaterThan(0);
    await context.close();
  }
});

test('phone inspection, previews, gestures and arena touch movement work in both orientations', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page); await expect(canvas(page)).toHaveAttribute('data-mode', 'inspection');
  const id = await canvas(page).getAttribute('data-character-id');
  const swing = panelPoint(390, 844, 271, 162); await page.touchscreen.tap(swing.x, swing.y);
  await expect(canvas(page)).toHaveAttribute('data-demonstration', 'swing');
  await page.waitForTimeout(250); expect(await position(page)).toEqual({ x: '0.000', z: '0.000' });
  await page.screenshot({ path: 'test-results/character-phone.png' });
  const cdp = await context.newCDPSession(page);
  const dispatch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const alpha = await canvas(page).getAttribute('data-camera-alpha');
  await dispatch('touchStart', [{ x: 150, y: 300, id: 1 }]);
  await dispatch('touchMove', [{ x: 195, y: 310, id: 1 }]); await dispatch('touchEnd', []);
  await expect.poll(() => canvas(page).getAttribute('data-camera-alpha')).not.toBe(alpha);
  const radius = Number(await canvas(page).getAttribute('data-camera-radius'));
  await dispatch('touchStart', [{ x: 120, y: 300, id: 1 }]);
  await dispatch('touchStart', [{ x: 120, y: 300, id: 1 }, { x: 230, y: 300, id: 2 }]);
  await dispatch('touchMove', [{ x: 90, y: 300, id: 1 }, { x: 260, y: 300, id: 2 }]);
  await dispatch('touchEnd', []);
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-camera-radius'))).toBeLessThan(radius);
  await page.touchscreen.tap(171, 69); await expect(canvas(page)).toHaveAttribute('data-mode', 'arena');
  await dispatch('touchStart', [{ x: 90, y: 704, id: 1 }]);
  await dispatch('touchStart', [{ x: 90, y: 704, id: 1 }, { x: 330, y: 744, id: 2 }]);
  await expect(canvas(page)).toHaveAttribute('data-sprinting', 'true');
  await page.waitForTimeout(350); await dispatch('touchEnd', []); await page.waitForTimeout(60);
  const moved = await position(page); expect(Math.hypot(Number(moved.x), Number(moved.z))).toBeGreaterThan(0.5);
  await page.waitForTimeout(150); expect(await position(page)).toEqual(moved);
  await dispatch('touchStart', [{ x: 90, y: 704, id: 1 }]); await page.waitForTimeout(100);
  await dispatch('touchCancel', []); await page.waitForTimeout(60);
  const cancelled = await position(page); await page.waitForTimeout(100); expect(await position(page)).toEqual(cancelled);
  await page.touchscreen.tap(330, 798); await expect.poll(() => position(page)).toEqual({ x: '0.000', z: '0.000' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.touchscreen.tap(63, 69); await expect(canvas(page)).toHaveAttribute('data-mode', 'inspection');
  const color = panelPoint(844, 390, 59, 115); await page.touchscreen.tap(color.x, color.y);
  await expect(canvas(page)).toHaveAttribute('data-palette', 'crimson');
  await page.screenshot({ path: 'test-results/character-landscape.png' });
  await page.reload(); await expect(canvas(page)).toHaveAttribute('data-ready', 'true');
  await expect(canvas(page)).toHaveAttribute('data-character-id', id);
  await expect(canvas(page)).toHaveAttribute('data-palette', 'crimson');
  expect(errors).toEqual([]); await context.close();
});
