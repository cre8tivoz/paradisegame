import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

type CanvasSample = {
  ok: boolean;
  reason: string;
  variance?: number;
  colorBuckets?: number;
};

async function sampleCanvas(page: import('@playwright/test').Page): Promise<CanvasSample> {
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box || box.width < 32 || box.height < 32) {
    return { ok: false, reason: 'canvas-too-small' };
  }

  const buffer = await canvas.screenshot();
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  let alphaPixels = 0;
  const buckets = new Set<string>();
  const stride = Math.max(1, Math.floor((png.width * png.height) / 4096));

  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const offset = pixel * 4;
    const r = png.data[offset];
    const g = png.data[offset + 1];
    const b = png.data[offset + 2];
    const a = png.data[offset + 3];
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    if (a > 0) alphaPixels += 1;
    buckets.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 6}`);
  }

  const variance = max - min;
  return {
    ok: alphaPixels > 256 && (variance > 8 || buckets.size > 3),
    reason: 'sampled',
    variance,
    colorBuckets: buckets.size,
  };
}

type WindowWithLodge = Window & {
  __lodge?: { project: (x: number, y: number, z: number) => { x: number; y: number } };
};

/** Click-to-move via the same floor pick the game uses (WASD is not wired). */
async function clickToMove(
  page: import('@playwright/test').Page,
  x: number,
  y: number,
  z: number,
): Promise<void> {
  await page.evaluate(
    ({ x, y, z }) => {
      const canvas = document.querySelector('#game-canvas');
      const win = window as WindowWithLodge;
      if (!canvas || !win.__lodge) return;
      const p = win.__lodge.project(x, y, z);
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: p.x, clientY: p.y, bubbles: true }),
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: p.x, clientY: p.y, bubbles: true }),
      );
      canvas.dispatchEvent(
        new MouseEvent('click', { clientX: p.x, clientY: p.y, bubbles: true }),
      );
    },
    { x, y, z },
  );
}

test('renders a nonblank interactive game canvas', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Browsers auto-request /favicon.ico; we ship favicon.svg instead.
    if (text.includes('favicon.ico')) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await page.waitForFunction(() => Boolean((window as WindowWithLodge).__lodge));

  const sample = await sampleCanvas(page);
  expect(sample, JSON.stringify(sample)).toMatchObject({ ok: true });

  const before = await page.evaluate(
    () => window.__THREE_GAME_DIAGNOSTICS__?.player.position ?? { x: 0, y: 0, z: 0 },
  );

  // Walk toward lodge interior (increasing z) — same path cutaway tests use.
  await clickToMove(page, before.x, 0, before.z + 2.5);

  await expect
    .poll(async () => {
      const pos = await page.evaluate(
        () => window.__THREE_GAME_DIAGNOSTICS__?.player.position ?? { x: 0, y: 0, z: 0 },
      );
      return Math.hypot(pos.x - before.x, pos.z - before.z);
    })
    .toBeGreaterThan(0.3);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-game`, {
    body: screenshot,
    contentType: 'image/png',
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
