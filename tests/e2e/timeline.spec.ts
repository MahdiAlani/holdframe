import { expect, test, type Page } from '@playwright/test';
import { canvasPixel, editorState, loadFixture } from './helpers';

const WHITE = [255, 255, 255, 255];
const BACKGROUND = [0x1b, 0x1f, 0x2a, 255];

const diamonds = (page: Page, layerId: string) =>
  page.locator(`[data-testid="track"][data-layer-id="${layerId}"] [data-testid="keyframe"]`);

const times = (page: Page, layerId: string) =>
  diamonds(page, layerId).evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.time)));

// Screen x of a composition time on the ruler.
async function xAt(page: Page, t: number, duration = 2): Promise<{ x: number; y: number }> {
  const box = (await page.getByTestId('ruler').boundingBox())!;
  return { x: box.x + (t / duration) * box.width, y: box.y + box.height / 2 };
}

test('layer rows show keyframes as diamonds', async ({ page }) => {
  await loadFixture(page);
  await expect(page.getByTestId('track')).toHaveCount(8);
  expect(await times(page, 'title')).toEqual([0, 1]);
  expect(await times(page, 'card')).toEqual([0, 0.5, 1]);
  expect(await times(page, 'image')).toEqual([]);
});

test('scrubbing the ruler moves the playhead and repaints the viewport', async ({ page }) => {
  await loadFixture(page);
  expect(await canvasPixel(page, 370, 30)).toEqual(BACKGROUND);

  const start = await xAt(page, 0.25);
  const end = await xAt(page, 1);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  expect(await editorState<number>(page, 's.time')).toBeCloseTo(0.25, 1);
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  expect(await editorState<number>(page, 's.time')).toBeCloseTo(1, 5);
  expect(await canvasPixel(page, 370, 30)).toEqual(WHITE);
  await expect(page.getByTestId('timecode')).toContainText('frame 30');
});

test('a time change repaints synchronously, inside the same frame', async ({ page }) => {
  await loadFixture(page);
  const [before, after] = await page.evaluate(() => {
    const ctx = document.querySelector<HTMLCanvasElement>('[data-testid="viewport-canvas"]')!.getContext('2d')!;
    const read = () => Array.from(ctx.getImageData(370, 30, 1, 1).data);
    const first = read();
    (window as any).__holdframe.getState().setTime(1);
    return [first, read()];
  });
  expect(before).toEqual(BACKGROUND);
  expect(after).toEqual(WHITE);
});

test('dragging a diamond moves the keyframe as one undoable step', async ({ page }) => {
  await loadFixture(page);
  const box = (await diamonds(page, 'title').nth(1).boundingBox())!;
  const target = await xAt(page, 1.5);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  expect(await times(page, 'title')).toEqual([0, 1.5]);
  expect(await editorState<number>(page, 's.undoStack.length')).toBe(1);
  expect(await editorState<number>(page, 's.project.composition.layers[1].transform.opacity.keyframes[1].t')).toBe(1.5);

  await page.keyboard.press('Control+z');
  expect(await times(page, 'title')).toEqual([0, 1]);
  await page.keyboard.press('Control+Shift+z');
  expect(await times(page, 'title')).toEqual([0, 1.5]);
  await page.getByTestId('undo').click();
  expect(await times(page, 'title')).toEqual([0, 1]);
});

test('playback holds the composition frame rate with no drift over 10 seconds', async ({ page }) => {
  test.setTimeout(30_000);
  await loadFixture(page, { duration: 12 });
  const started = await page.evaluate(() => {
    (window as any).__holdframe.getState().play();
    return performance.now();
  });
  await page.waitForTimeout(10_000);
  const { time, now, playing } = await page.evaluate(
    () =>
      new Promise<{ time: number; now: number; playing: boolean }>((resolve) => {
        requestAnimationFrame((ts) => {
          const s = (window as any).__holdframe.getState();
          resolve({ time: s.time, now: ts, playing: s.playing });
        });
      }),
  );
  const elapsed = (now - started) / 1000;
  expect(playing).toBe(true);
  expect(elapsed).toBeGreaterThan(9.9);
  // Within two frames of the wall clock after ten seconds, and always on a frame boundary.
  expect(Math.abs(time - elapsed)).toBeLessThan(2 / 30);
  expect(Math.abs(time * 30 - Math.round(time * 30))).toBeLessThan(1e-6);

  await page.getByTestId('play-toggle').click();
  const paused = await editorState<number>(page, 's.time');
  await page.waitForTimeout(300);
  expect(await editorState<number>(page, 's.time')).toBe(paused);
  await expect(page.getByTestId('play-toggle')).toHaveText('Play');
});

test('space toggles playback', async ({ page }) => {
  await loadFixture(page);
  await page.keyboard.press('Space');
  expect(await editorState<boolean>(page, 's.playing')).toBe(true);
  await page.keyboard.press('Space');
  expect(await editorState<boolean>(page, 's.playing')).toBe(false);
});
