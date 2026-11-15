import { expect, test, type Page } from '@playwright/test';
import type { ExportHarness } from '../harness/export';

declare const harness: ExportHarness;

async function open(page: Page): Promise<void> {
  await page.goto('/tests/harness/export.html');
  await page.waitForSelector('body[data-ready]');
}

// Removes what lottie-web cannot draw: it has no `add` blend mode.
const WITHOUT_ADD = `p.composition.layers.find((l) => l.id === 'add').blendMode = 'normal';`;

test('GIF matches the composition frame count, frame rate and duration, and decodes', async ({ page }) => {
  await open(page);
  const gif = await page.evaluate(() => harness.gif('golden'));
  expect(gif.frames).toBe(60);
  expect(gif.duration).toBeCloseTo(2, 5);
  expect(gif.frames / gif.duration).toBeCloseTo(30, 5);
  expect([gif.width, gif.height]).toEqual([400, 300]);
  expect(gif.loops).toBe(Infinity);

  const film = await page.evaluate(() => harness.gif('animator', 'p.composition.fps = 24; p.composition.duration = 1.5;'));
  expect(film.frames).toBe(36);
  expect(film.duration).toBeCloseTo(1.5, 5);
});

for (const format of ['mp4', 'webm'] as const) {
  test(`${format.toUpperCase()} has the right frame count and duration, and plays in Chrome`, async ({ page }) => {
    await open(page);
    const video = await page.evaluate((f) => harness.video('golden', f), format);
    expect(video.type).toContain(format === 'mp4' ? 'video/mp4' : 'video/webm');
    expect(video.frames).toBe(60);
    expect(video.duration).toBeCloseTo(2, 2);
    expect(video.width).toBe(400);
    expect(video.elementWidth).toBe(400);
    expect(video.elementDuration).toBeCloseTo(2, 1);
    expect(video.meanDiffFromRender).toBeLessThan(6);
  });
}

for (const [fixture, t, edit] of [
  ['golden', 0, WITHOUT_ADD],
  ['golden', 0.5, WITHOUT_ADD],
  ['golden', 1, WITHOUT_ADD],
  ['animator', 0.3, undefined],
  ['animator', 0.9, undefined],
  ['animator', 1.9, undefined],
] as const) {
  test(`Lottie export of ${fixture} at t=${t} matches our render in lottie-web`, async ({ page }) => {
    await open(page);
    const info = await page.evaluate(([f, time, e]) => harness.compare(f, time, e), [fixture, t, edit] as const);
    expect(info.fr).toBe(30);
    expect(info.frames).toBe(60);
    const ours = await page.locator('#ours').screenshot();
    const theirs = await page.locator('#lottie').screenshot();
    const result = await page.evaluate(([a, b]) => harness.diff(a!, b!), [ours.toString('base64'), theirs.toString('base64')]);
    console.log(`lottie vs render, ${fixture} t=${t}: ${(result.mismatch * 100).toFixed(2)}% pixels differ, mean ${result.mean.toFixed(2)}`);
    expect(result.width).toBe(result.otherWidth);
    // Glyph placement and edge antialiasing differ slightly between canvas and SVG.
    expect(result.mismatch, `visibly different pixels: ${(result.mismatch * 100).toFixed(2)}%`).toBeLessThan(0.01);
    expect(result.mean).toBeLessThan(1.5);
  });
}

test('a 1080x1080, 4 second composition exports in under 30 seconds per format', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  const gif = await page.evaluate(() => harness.gif('launch'));
  expect(gif.frames).toBe(120);
  expect(gif.duration).toBeCloseTo(4, 5);
  expect([gif.width, gif.height]).toEqual([1080, 1080]);
  const mp4 = await page.evaluate(() => harness.video('launch', 'mp4'));
  expect(mp4.frames).toBe(120);
  const webm = await page.evaluate(() => harness.video('launch', 'webm'));
  const lottie = await page.evaluate(() => harness.compare('launch', 2));
  console.log(
    `export timings (1080x1080, 4s, 30fps): gif ${(gif.ms / 1000).toFixed(1)}s, mp4/${mp4.codec} ${(mp4.ms / 1000).toFixed(1)}s, ` +
      `webm/${webm.codec} ${(webm.ms / 1000).toFixed(1)}s, lottie ${lottie.ms.toFixed(0)}ms`,
  );
  for (const run of [gif, mp4, webm, lottie]) expect(run.ms).toBeLessThan(30_000);
});

test('blank project to exported GIF through the UI', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="timeline"]');
  await page.getByTestId('add-text').click();
  await page.getByTestId('text-content').fill('holdframe');
  await page.getByTestId('preset-fly-in-up').click();

  const ruler = (await page.getByTestId('ruler').boundingBox())!;
  await page.mouse.move(ruler.x + 10, ruler.y + ruler.height / 2);
  await page.mouse.down();
  await page.mouse.move(ruler.x + ruler.width / 2, ruler.y + ruler.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('timecode')).toContainText('2.00s');

  await page.getByTestId('comp-width').or(page.getByTestId('layer-name')).first().waitFor();
  await page.keyboard.press('Escape');
  for (const [id, value] of [
    ['comp-width', '320'],
    ['comp-height', '180'],
    ['comp-duration', '1'],
  ] as const) {
    await page.getByTestId(id).fill(value);
    await page.getByTestId(id).blur();
  }

  const download = page.waitForEvent('download');
  await page.getByTestId('export-gif').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('holdframe.gif');
  expect(await file.failure()).toBeNull();
  await expect(page.getByTestId('export-status')).toContainText('Exported GIF');

  const lottieDownload = page.waitForEvent('download');
  await page.getByTestId('export-lottie').click();
  expect((await lottieDownload).suggestedFilename()).toBe('holdframe.json');
});
