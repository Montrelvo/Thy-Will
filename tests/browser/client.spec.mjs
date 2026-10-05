import { expect, test } from '@playwright/test';

async function position(page) {
  return page.locator('#game').evaluate((canvas) => ({ x: Number(canvas.dataset.positionX), z: Number(canvas.dataset.positionZ) }));
}

async function move(page, key) {
  const start = await position(page);
  await page.keyboard.down(key);
  await expect.poll(async () => {
    const current = await position(page);
    return Math.hypot(current.x - start.x, current.z - start.z);
  }, { timeout: 10000 }).toBeGreaterThan(0.7);
  await page.keyboard.up(key);
  return position(page);
}

test('production scene renders, moves, sprints, resets, resizes, and releases keys on blur', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const canvas = page.locator('#game');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-asset', 'ready');
  await expect(page.locator('#status')).toBeHidden();
  const walking = await move(page, 'w');
  expect(walking.z).toBeGreaterThan(0.5);
  await page.keyboard.press('r');
  await expect.poll(async () => (await position(page)).z).toBe(0);
  await page.keyboard.down('Shift');
  await expect(canvas).toHaveAttribute('data-sprinting', 'true');
  const sprinting = await move(page, 'w'); await page.keyboard.up('Shift');
  expect(sprinting.z).toBeGreaterThan(0.5);
  await page.keyboard.press('F3'); await expect(canvas).toHaveAttribute('data-debug', 'true');
  await page.keyboard.down('d'); await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const stopped = await position(page); await page.waitForTimeout(150);
  expect(await position(page)).toEqual(stopped); await page.keyboard.up('d');
  await page.setViewportSize({ width: 960, height: 640 });
  await page.waitForTimeout(200);
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  expect(await canvas.evaluate((node) => node.width)).toBe(960);
  await page.screenshot({ path: 'test-results/training-grounds.png' });
  expect(errors).toEqual([]);
});

test('standard controller input moves the player and reset is edge-triggered', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { id: 'Test standard controller', index: 0, timestamp: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    window.testPad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
  await page.goto('/'); await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => { window.testPad.axes[0] = 0.7; });
  await expect.poll(async () => (await position(page)).x, { timeout: 10000 }).toBeGreaterThan(0.4);
  await expect(page.locator('#game')).toHaveAttribute('data-input', 'controller');
  await page.evaluate(() => { window.testPad.axes[0] = 0; window.testPad.buttons[3].pressed = true; });
  await expect.poll(async () => (await position(page)).x).toBe(0);
  await page.evaluate(() => { window.testPad.axes[0] = 0.7; });
  await expect.poll(async () => (await position(page)).x, { timeout: 10000 }).toBeGreaterThan(0.3);
});


test('a missing optional asset leaves the arena controllable', async ({ page }) => {
  await page.route('**/assets/beacon.gltf', (route) => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#game')).toHaveAttribute('data-asset', 'unavailable');
  expect((await move(page, 'w')).z).toBeGreaterThan(0.5);
});
