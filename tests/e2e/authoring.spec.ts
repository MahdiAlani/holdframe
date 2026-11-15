import { expect, test, type Page } from '@playwright/test';
import { editorState } from './helpers';

const L = 's.project.composition.layers[0]';
const C = 's.project.composition';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('[data-testid="timeline"]');
}

const names = (page: Page) => editorState<string[]>(page, `${C}.layers.map((l) => l.name)`);
const undo = (page: Page) => page.getByTestId('undo').click();
const redo = (page: Page) => page.getByTestId('redo').click();

type Edit =
  | { id: string; fill: string | number; expr: string; expected: unknown }
  | { id: string; select: string; expr: string; expected: unknown }
  | { id: string; check: boolean; expr: string; expected: unknown };

// Applies one panel edit, then checks it lands in the project and survives undo and redo.
async function checkEdit(page: Page, edit: Edit): Promise<void> {
  const field = page.getByTestId(edit.id);
  const before = await editorState<unknown>(page, edit.expr);
  if ('fill' in edit) {
    await field.fill(String(edit.fill));
    await field.blur();
  } else if ('select' in edit) {
    await field.selectOption(edit.select);
  } else {
    await field.setChecked(edit.check);
  }
  expect(await editorState<unknown>(page, edit.expr), `${edit.id} applies`).toEqual(edit.expected);
  await undo(page);
  expect(await editorState<unknown>(page, edit.expr), `${edit.id} undoes`).toEqual(before);
  await redo(page);
  expect(await editorState<unknown>(page, edit.expr), `${edit.id} redoes`).toEqual(edit.expected);
}

test('creates every layer kind, with undo and redo', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-text').click();
  await page.getByTestId('add-rect').click();
  await page.getByTestId('add-ellipse').click();
  await page.getByTestId('add-image').setInputFiles('tests/fixtures/tile.png');
  await expect(page.getByTestId('layer-row')).toHaveCount(4);
  expect(await names(page)).toEqual(['Image', 'Ellipse', 'Rectangle', 'Text']);
  expect(await editorState(page, `${L}.size.static`)).toEqual({ x: 8, y: 8 });
  expect(await editorState(page, 's.selectedLayerId === s.project.composition.layers[0].id')).toBe(true);

  for (let i = 0; i < 4; i++) await undo(page);
  await expect(page.getByTestId('layer-row')).toHaveCount(0);
  for (let i = 0; i < 4; i++) await redo(page);
  expect(await names(page)).toEqual(['Image', 'Ellipse', 'Rectangle', 'Text']);
});

test('deletes, reorders and renames layers, with undo and redo', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-text').click();
  await page.getByTestId('add-rect').click();
  await page.getByTestId('add-ellipse').click();
  const row = (i: number) => page.getByTestId('layer-row').nth(i);

  await row(0).getByTestId('layer-down').click();
  expect(await names(page)).toEqual(['Rectangle', 'Ellipse', 'Text']);
  await row(2).getByTestId('layer-up').click();
  expect(await names(page)).toEqual(['Rectangle', 'Text', 'Ellipse']);
  await undo(page);
  await undo(page);
  expect(await names(page)).toEqual(['Ellipse', 'Rectangle', 'Text']);
  await redo(page);
  expect(await names(page)).toEqual(['Rectangle', 'Ellipse', 'Text']);

  await row(1).locator('.layer-name').dblclick();
  await page.getByTestId('layer-rename').fill('Dot');
  await page.keyboard.press('Enter');
  expect(await names(page)).toEqual(['Rectangle', 'Dot', 'Text']);
  await undo(page);
  expect(await names(page)).toEqual(['Rectangle', 'Ellipse', 'Text']);
  await redo(page);

  await row(0).getByTestId('layer-delete').click();
  expect(await names(page)).toEqual(['Dot', 'Text']);
  await row(1).click();
  await page.keyboard.press('Delete');
  expect(await names(page)).toEqual(['Dot']);
  await undo(page);
  await undo(page);
  expect(await names(page)).toEqual(['Rectangle', 'Dot', 'Text']);
  await redo(page);
  expect(await names(page)).toEqual(['Dot', 'Text']);

  await row(0).getByTestId('layer-toggle-visible').click();
  expect(await editorState(page, `${L}.visible`)).toBe(false);
  await row(0).getByTestId('layer-toggle-locked').click();
  expect(await editorState(page, `${L}.locked`)).toBe(true);
  await undo(page);
  await undo(page);
  expect(await editorState(page, `[${L}.visible, ${L}.locked]`)).toEqual([true, false]);
});

test('edits every shape layer property in the panel', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-rect').click();
  const edits: Edit[] = [
    { id: 'layer-name', fill: 'Box', expr: `${L}.name`, expected: 'Box' },
    { id: 'layer-in', fill: 0.5, expr: `${L}.inPoint`, expected: 0.5 },
    { id: 'layer-out', fill: 3, expr: `${L}.outPoint`, expected: 3 },
    { id: 'layer-blend', select: 'screen', expr: `${L}.blendMode`, expected: 'screen' },
    { id: 'layer-visible', check: false, expr: `${L}.visible`, expected: false },
    { id: 'prop-transform.position-x', fill: 123, expr: `${L}.transform.position.static.x`, expected: 123 },
    { id: 'prop-transform.position-y', fill: 45, expr: `${L}.transform.position.static.y`, expected: 45 },
    { id: 'prop-transform.scale-x', fill: 2, expr: `${L}.transform.scale.static.x`, expected: 2 },
    { id: 'prop-transform.scale-y', fill: 0.5, expr: `${L}.transform.scale.static.y`, expected: 0.5 },
    { id: 'prop-transform.rotation', fill: 30, expr: `${L}.transform.rotation.static`, expected: 30 },
    { id: 'prop-transform.opacity', fill: 0.4, expr: `${L}.transform.opacity.static`, expected: 0.4 },
    { id: 'prop-transform.anchor-x', fill: 10, expr: `${L}.transform.anchor.static.x`, expected: 10 },
    { id: 'prop-transform.anchor-y', fill: -20, expr: `${L}.transform.anchor.static.y`, expected: -20 },
    { id: 'shape-fill', fill: '#ff0000', expr: `${L}.fill`, expected: '#ff0000' },
    { id: 'shape-stroke-on', check: true, expr: `${L}.stroke`, expected: { colour: '#ffffff', width: 4 } },
    { id: 'shape-stroke-colour', fill: '#00ff00', expr: `${L}.stroke.colour`, expected: '#00ff00' },
    { id: 'shape-stroke-width', fill: 9, expr: `${L}.stroke.width`, expected: 9 },
    { id: 'prop-size-x', fill: 200, expr: `${L}.size.static.x`, expected: 200 },
    { id: 'prop-size-y', fill: 100, expr: `${L}.size.static.y`, expected: 100 },
    { id: 'prop-cornerRadius', fill: 12, expr: `${L}.cornerRadius.static`, expected: 12 },
    { id: 'shape-kind', select: 'ellipse', expr: `${L}.shape`, expected: 'ellipse' },
    { id: 'shape-fill-none', check: true, expr: `${L}.fill`, expected: null },
    { id: 'layer-locked', check: true, expr: `${L}.locked`, expected: true },
  ];
  for (const edit of edits) await checkEdit(page, edit);
  await expect(page.getByTestId('prop-transform.rotation')).toBeDisabled();
});

test('edits every text layer property in the panel', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-text').click();
  const edits: Edit[] = [
    { id: 'text-content', fill: 'Hello\nworld', expr: `${L}.text`, expected: 'Hello\nworld' },
    { id: 'text-font', fill: 'Georgia, serif', expr: `${L}.fontFamily`, expected: 'Georgia, serif' },
    { id: 'text-size', fill: 120, expr: `${L}.fontSize`, expected: 120 },
    { id: 'text-weight', select: '400', expr: `${L}.fontWeight`, expected: 400 },
    { id: 'text-fill', fill: '#ffcc00', expr: `${L}.fill`, expected: '#ffcc00' },
    { id: 'text-align', select: 'left', expr: `${L}.align`, expected: 'left' },
    { id: 'text-line-height', fill: 1.5, expr: `${L}.lineHeight`, expected: 1.5 },
  ];
  for (const edit of edits) await checkEdit(page, edit);
});

test('edits image size and replaces the source', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-image').setInputFiles('tests/fixtures/tile.png');
  await expect(page.getByTestId('layer-row')).toHaveCount(1);
  await checkEdit(page, { id: 'prop-size-x', fill: 64, expr: `${L}.size.static.x`, expected: 64 });
  const before = await editorState<string>(page, `${L}.assetId`);
  await page.getByTestId('image-replace').setInputFiles('tests/fixtures/tile.png');
  await expect.poll(() => editorState<string>(page, `${L}.assetId`)).not.toBe(before);
  await undo(page);
  expect(await editorState<string>(page, `${L}.assetId`)).toBe(before);
});

test('edits composition settings', async ({ page }) => {
  await open(page);
  const edits: Edit[] = [
    { id: 'comp-width', fill: 1920, expr: `${C}.width`, expected: 1920 },
    { id: 'comp-height', fill: 720, expr: `${C}.height`, expected: 720 },
    { id: 'comp-fps', fill: 24, expr: `${C}.fps`, expected: 24 },
    { id: 'comp-duration', fill: 6, expr: `${C}.duration`, expected: 6 },
    { id: 'comp-background', fill: '#223344', expr: `${C}.background`, expected: '#223344' },
    { id: 'comp-transparent', check: true, expr: `${C}.background`, expected: null },
  ];
  for (const edit of edits) await checkEdit(page, edit);
  const size = await page.getByTestId('viewport-canvas').evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height]);
  expect(size).toEqual([1920, 720]);
});

test('typing in a field is a single undo step', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-text').click();
  const field = page.getByTestId('text-content');
  await field.click();
  await field.press('Control+a');
  await field.pressSequentially('holdframe');
  await field.blur();
  expect(await editorState(page, `${L}.text`)).toBe('holdframe');
  expect(await editorState(page, 's.undoStack.length')).toBe(2);
  await undo(page);
  expect(await editorState(page, `${L}.text`)).toBe('Text');
});

test('adds and removes keyframes, with undo and redo', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-rect').click();
  const position = `${L}.transform.position`;
  const diamonds = page.getByTestId('keyframe');

  await page.getByTestId('stopwatch-transform.position').click();
  expect(await editorState(page, `${position}.keyframes.map((k) => k.t)`)).toEqual([0]);
  await expect(diamonds).toHaveCount(1);

  await page.evaluate(() => (window as any).__holdframe.getState().setTime(1));
  const x = page.getByTestId('prop-transform.position-x');
  await x.fill('900');
  await x.blur();
  expect(await editorState(page, `${position}.keyframes.map((k) => [k.t, k.value.x])`)).toEqual([
    [0, 540],
    [1, 900],
  ]);
  await expect(diamonds).toHaveCount(2);

  await page.evaluate(() => (window as any).__holdframe.getState().setTime(0.5));
  await expect(x).toHaveValue('720');
  await page.getByTestId('key-toggle-transform.position').click();
  expect(await editorState(page, `${position}.keyframes.length`)).toBe(3);
  await page.getByTestId('key-toggle-transform.position').click();
  expect(await editorState(page, `${position}.keyframes.length`)).toBe(2);

  await page.getByTestId('key-prev-transform.position').click();
  expect(await editorState(page, 's.time')).toBe(0);
  await page.getByTestId('key-next-transform.position').click();
  expect(await editorState(page, 's.time')).toBe(1);

  await page.getByTestId('key-toggle-transform.position').click();
  expect(await editorState(page, `${position}.keyframes.map((k) => k.t)`)).toEqual([0]);
  await undo(page);
  expect(await editorState(page, `${position}.keyframes.map((k) => k.t)`)).toEqual([0, 1]);
  await redo(page);
  await expect(diamonds).toHaveCount(1);
  await undo(page);

  await page.getByTestId('stopwatch-transform.position').click();
  expect(await editorState(page, position)).toEqual({ static: { x: 900, y: 540 } });
  await undo(page);
  expect(await editorState(page, `${position}.keyframes.length`)).toBe(2);
});

test('picks an easing curve from the bezier editor, with undo and redo', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-rect').click();
  const easing = `${L}.transform.rotation.keyframes[0].easing`;
  await page.getByTestId('stopwatch-transform.rotation').click();
  await page.getByTestId('easing-toggle-transform.rotation').click();
  await expect(page.getByTestId('easing-editor')).toBeVisible();

  await page.getByTestId('easing-kind').selectOption('bezier');
  expect(await editorState(page, easing)).toEqual({ kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 });

  await page.getByTestId('easing-preset-Ease').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('bezier-h1').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 30, cy - 40, { steps: 6 });
  await page.mouse.up();
  const dragged = await editorState<{ x1: number; y1: number; x2: number }>(page, easing);
  expect(dragged.x1).toBeLessThan(0.42);
  expect(dragged.y1).toBeGreaterThan(0.2);
  expect(dragged.x2).toBe(0.58);
  expect(await editorState(page, 's.undoStack.length')).toBe(4);

  await undo(page);
  expect(await editorState(page, easing)).toEqual({ kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 });
  await undo(page);
  expect(await editorState(page, easing)).toEqual({ kind: 'linear' });
  await redo(page);
  await redo(page);
  expect(await editorState(page, easing)).toEqual(dragged);

  await page.getByTestId('easing-preset-Overshoot').click();
  expect(await editorState(page, easing)).toEqual({ kind: 'bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 });
  await page.getByTestId('easing-kind').selectOption('hold');
  expect(await editorState(page, easing)).toEqual({ kind: 'hold' });
  await undo(page);
  expect(await editorState(page, `${easing}.y1`)).toBe(1.56);
});
