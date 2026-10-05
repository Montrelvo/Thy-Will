import { test, expect } from '@playwright/test';

test('imported KayKit rig plays preview and arena movement clips, with both palette variants', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); const canvas = page.locator('#game');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-character-asset', 'kaykit');
  await expect(canvas).toHaveAttribute('data-character-animation', 'Idle');
  await page.keyboard.down('w'); await expect(canvas).toHaveAttribute('data-character-animation', 'Running_A'); await page.keyboard.up('w');
  await page.mouse.click(63, 69); // Inspection.
  await expect(canvas).toHaveAttribute('data-mode', 'inspection');
  await page.mouse.click(640, 728); // Run preview.
  await expect(canvas).toHaveAttribute('data-character-animation', 'Running_A');
  await page.mouse.click(746, 728); // Swing preview.
  await expect(canvas).toHaveAttribute('data-character-animation', '1H_Melee_Attack_Chop');
  await page.mouse.click(534, 681); // Palette.
  await expect(canvas).toHaveAttribute('data-palette', 'crimson');
  await expect(canvas).toHaveAttribute('data-character-asset', 'kaykit');
  await page.screenshot({ path: 'test-results/kaykit-knight-crimson.png' });
  expect(errors).toEqual([]);
});

test('missing knight asset leaves the procedural character and arena usable', async ({ page }) => {
  await page.route('**/assets/kaykit/knight-*.glb', route => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/'); const canvas = page.locator('#game');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-character-asset', 'fallback');
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await canvas.getAttribute('data-position-z'))).toBeGreaterThan(0.5);
  await page.keyboard.up('w');
});
