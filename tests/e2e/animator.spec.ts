import { expect, test, type Page } from '@playwright/test';
import { editorState } from './helpers';

const L = 's.project.composition.layers[0]';
const PRESETS = ['fly-in-up', 'fade-in', 'scale-in', 'typewriter', 'blur-in'];

const setTime = (page: Page, t: number) => page.evaluate((v) => (window as any).__holdframe.getState().setTime(v), t);

// Count of canvas pixels that differ from the background colour.
function inkedPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="viewport-canvas"]')!;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i]! - data[0]!) + Math.abs(data[i + 1]! - data[1]!) + Math.abs(data[i + 2]! - data[2]!) > 24) count++;
    }
    return count;
  });
}

async function blankWithText(page: Page, text: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('[data-testid="timeline"]');
  await page.getByTestId('add-text').click();
  await page.getByTestId('text-content').fill(text);
}

for (const [fixtureTime, name] of [
  [0.3, 'animator-t0-3.png'],
  [0.9, 'animator-t0-9.png'],
] as const) {
  test(`golden animated text at t=${fixtureTime}`, async ({ page }) => {
    await page.goto(`/tests/harness/golden.html?fixture=animator&t=${fixtureTime}`);
    await page.waitForSelector('body[data-ready]');
    await expect(page.locator('canvas')).toHaveScreenshot(name);
  });
}

test('a 4-second text animation is authorable from a blank project in under a minute', async ({ page }) => {
  const started = Date.now();
  await blankWithText(page, 'Motion that moves');
  await page.getByTestId('preset-fly-in-up').click();
  await page.getByTestId('play-toggle').click();
  expect(await editorState(page, 's.playing')).toBe(true);
  await page.getByTestId('play-toggle').click();

  expect(await editorState(page, 's.project.composition.duration')).toBe(4);
  expect(await editorState(page, `${L}.animator.unit`)).toBe('character');

  await setTime(page, 0);
  const atStart = await inkedPixels(page);
  await setTime(page, 0.4);
  const midway = await inkedPixels(page);
  await setTime(page, 3.9);
  const settled = await inkedPixels(page);
  expect(atStart).toBe(0);
  expect(midway).toBeGreaterThan(0);
  expect(settled).toBeGreaterThan(midway);
  expect(Date.now() - started).toBeLessThan(60_000);
});

test('every preset applies, animates in and is undoable', async ({ page }) => {
  await blankWithText(page, 'Preset');
  await setTime(page, 3.9);
  const plain = await inkedPixels(page);
  for (const id of PRESETS) {
    await page.getByTestId(`preset-${id}`).click();
    expect(await editorState(page, `${L}.animator !== null`), id).toBe(true);
    await setTime(page, 0);
    // Only the typewriter shows its first character on frame zero.
    const first = await inkedPixels(page);
    if (id === 'typewriter') expect(first).toBeLessThan(plain / 2);
    else expect(first, id).toBe(0);
    await setTime(page, 3.9);
    expect(Math.abs((await inkedPixels(page)) - plain), id).toBeLessThan(plain * 0.05);
  }
  await page.getByTestId('undo').click();
  expect(await editorState(page, `[${L}.animator.duration, ${L}.animator.stagger]`)).toEqual([0, 0.06]);
  await page.getByTestId('animator-remove').click();
  expect(await editorState(page, `${L}.animator`)).toBeNull();
  await page.getByTestId('undo').click();
  expect(await editorState(page, `${L}.animator !== null`)).toBe(true);
});

test('unit, order and timing controls change the stagger', async ({ page }) => {
  await blankWithText(page, 'one two\nthree four');
  await page.getByTestId('preset-fade-in').click();
  const fill = async (id: string, value: number): Promise<void> => {
    const field = page.getByTestId(id);
    await field.fill(String(value));
    await field.blur();
  };
  await fill('animator-stagger', 0.5);
  await fill('animator-duration', 0);

  // With a zero duration each unit pops in, so ink grows in steps of one unit.
  const steps = async (): Promise<number> => {
    const seen = new Set<number>();
    for (let t = 0; t < 3.99; t += 0.25) {
      await setTime(page, t);
      seen.add(await inkedPixels(page));
    }
    return seen.size;
  };

  await page.getByTestId('animator-unit').selectOption('line');
  expect(await steps()).toBe(2);
  await page.getByTestId('animator-unit').selectOption('word');
  expect(await steps()).toBe(4);

  await setTime(page, 0);
  const firstForward = await page.getByTestId('viewport-canvas').screenshot();
  await page.getByTestId('animator-order').selectOption('reverse');
  expect(await editorState(page, `${L}.animator.order`)).toBe('reverse');
  const firstReverse = await page.getByTestId('viewport-canvas').screenshot();
  expect(firstReverse.equals(firstForward)).toBe(false);
  await page.getByTestId('animator-order').selectOption('random');
  expect(await steps()).toBe(4);

  await fill('animator-from-y', 40);
  await fill('animator-from-blur', 6);
  expect(await editorState(page, `${L}.animator.from`)).toEqual({ position: { x: 0, y: 40 }, opacity: 0, blur: 6 });
  await fill('animator-from-opacity', 1);
  expect(await editorState(page, `${L}.animator.from`)).toEqual({ position: { x: 0, y: 40 }, blur: 6 });
  await page.getByTestId('undo').click();
  expect(await editorState(page, `${L}.animator.from.opacity`)).toBe(0);
});
