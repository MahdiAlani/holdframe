import { expect, test } from '@playwright/test';
import type { GifHarness } from '../harness/gif';

declare const gifHarness: GifHarness;

// Records the editor itself, frame by frame, playing demo/demo.holdframe.
// Run with `npm run demo:record`; writes docs/demo.gif.
test('record the demo GIF from the real UI', async ({ page, context }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.waitForSelector('html[data-restored]');
  await page.getByTestId('file-open').setInputFiles('demo/demo.holdframe');
  await expect(page.getByTestId('layer-row')).toHaveCount(3);
  await page.getByTestId('layer-row').first().click();
  await page.getByTestId('preset-fly-in-up').scrollIntoViewIfNeeded();
  await page.mouse.move(540, 300);

  const encoder = await context.newPage();
  await encoder.goto('/tests/harness/gif.html');
  await encoder.waitForSelector('body[data-ready]', { state: 'attached' });

  const { fps, duration } = await page.evaluate(() => (window as any).__holdframe.getState().project.composition);
  const frames = Math.round(fps * duration);
  const capture = async (i: number): Promise<string> => {
    await page.evaluate((t) => (window as any).__holdframe.getState().setTime(t), i / fps);
    return (await page.screenshot({ type: 'png' })).toString('base64');
  };

  for (let i = 0; i < frames; i += 6) {
    const shot = await capture(i);
    await encoder.evaluate((png) => gifHarness.addSample(png), shot);
  }
  await encoder.evaluate(() => gifHarness.buildPalette());

  for (let i = 0; i < frames; i++) {
    const shot = await capture(i);
    const delay = Math.round(((i + 1) * 100) / fps) - Math.round((i * 100) / fps);
    await encoder.evaluate(([png, cs]) => gifHarness.addFrame(png as string, cs as number), [shot, delay]);
  }

  const download = encoder.waitForEvent('download');
  const bytes = await encoder.evaluate(() => gifHarness.finish('demo.gif'));
  await (await download).saveAs('docs/demo.gif');
  console.log(`docs/demo.gif: ${frames} frames, ${(bytes / 1048576).toFixed(2)} MB`);
});
