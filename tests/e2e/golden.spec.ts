import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, t: number): Promise<void> {
  await page.goto(`/tests/harness/golden.html?t=${t}`);
  await page.waitForSelector('body[data-ready]');
}

function pixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(
    ([px, py]) => {
      const ctx = document.querySelector('canvas')!.getContext('2d')!;
      return Array.from(ctx.getImageData(px!, py!, 1, 1).data);
    },
    [x, y],
  );
}

for (const t of [0, 0.5, 1]) {
  test(`golden frame at t=${t}`, async ({ page }) => {
    await open(page, t);
    await expect(page.locator('canvas')).toHaveScreenshot(`golden-t${t}.png`);
  });
}

test('canvas takes the composition size and background', async ({ page }) => {
  await open(page, 0);
  const size = await page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    return [c.width, c.height];
  });
  expect(size).toEqual([400, 300]);
  expect(await pixel(page, 395, 150)).toEqual([0x1b, 0x1f, 0x2a, 255]);
});

test('scale keeps the anchored corner fixed', async ({ page }) => {
  // Card anchor is its top-left corner at (30, 30): 80x50 at t=0, 240x120 at t=1.
  await open(page, 0);
  expect(await pixel(page, 70, 55)).toEqual([0x2d, 0x7f, 0xf9, 255]);
  expect(await pixel(page, 60, 100)).toEqual([0x1b, 0x1f, 0x2a, 255]);
  await open(page, 1);
  expect(await pixel(page, 60, 100)).toEqual([0x2d, 0x7f, 0xf9, 255]);
  expect(await pixel(page, 262, 90)).toEqual([0x2d, 0x7f, 0xf9, 255]);
  expect(await pixel(page, 280, 90)).toEqual([0x1b, 0x1f, 0x2a, 255]);
});

test('add blend sums channels and layers outside their range are not drawn', async ({ page }) => {
  await open(page, 0);
  // #333399 added to the #1b1f2a background.
  expect(await pixel(page, 132, 252)).toEqual([0x4e, 0x52, 0xc3, 255]);
  expect(await pixel(page, 370, 30)).toEqual([0x1b, 0x1f, 0x2a, 255]);
  await open(page, 1);
  expect(await pixel(page, 370, 30)).toEqual([255, 255, 255, 255]);
});
