import { expect, test, type Page } from '@playwright/test';
import { canvasPixel, editorState } from './helpers';

const LAYERS = 's.project.composition.layers';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('html[data-restored]');
  await page.waitForSelector('[data-testid="timeline"]');
}

// A project with an animated text layer and an image scaled up to cover the centre.
async function author(page: Page): Promise<void> {
  await page.getByTestId('add-image').setInputFiles('tests/fixtures/tile.png');
  await expect(page.getByTestId('layer-row')).toHaveCount(1);
  for (const id of ['prop-size-x', 'prop-size-y']) {
    await page.getByTestId(id).fill('400');
    await page.getByTestId(id).blur();
  }
  await page.getByTestId('add-text').click();
  await page.getByTestId('text-content').fill('Kept');
  await page.getByTestId('preset-scale-in').click();
  await page.getByTestId('prop-transform.position-y').fill('200');
  await page.getByTestId('prop-transform.position-y').blur();
}

async function expectAuthored(page: Page): Promise<void> {
  expect(await editorState(page, `${LAYERS}.map((l) => [l.kind, l.name])`)).toEqual([
    ['text', 'Text'],
    ['image', 'Image'],
  ]);
  expect(await editorState(page, `${LAYERS}[0].text`)).toBe('Kept');
  expect(await editorState(page, `${LAYERS}[0].animator.from`)).toEqual({ scale: { x: 0, y: 0 }, opacity: 0 });
  expect(await editorState(page, `${LAYERS}[1].size.static`)).toEqual({ x: 400, y: 400 });
  // The tile's own colours are drawn, so the image itself came back, not just its layer.
  await expect.poll(() => canvasPixel(page, 400, 400)).toEqual([20, 200, 255, 255]);
  expect(await canvasPixel(page, 400, 700)).toEqual([255, 80, 60, 255]);
}

test('autosave survives a reload, images included', async ({ page }) => {
  await open(page);
  await author(page);
  await expect(page.getByTestId('save-status')).toHaveText('Saved in this browser');
  await page.reload();
  await page.waitForSelector('html[data-restored]');
  await expectAuthored(page);
  expect(await editorState(page, 's.undoStack.length')).toBe(0);
});

test('a project round-trips through a single .holdframe file, images included', async ({ page, browser }) => {
  await open(page);
  await author(page);
  const pending = page.waitForEvent('download');
  await page.getByTestId('file-save').click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('project.holdframe');
  const path = await download.path();

  // A separate browser profile has none of the first one's IndexedDB.
  const context = await browser.newContext();
  const other = await context.newPage();
  await open(other);
  expect(await editorState(other, `${LAYERS}.length`)).toBe(0);
  await other.getByTestId('file-open').setInputFiles(path);
  await expect(other.getByTestId('layer-row')).toHaveCount(2);
  await expectAuthored(other);
  await context.close();
});

test('new starts a blank project', async ({ page }) => {
  await open(page);
  await author(page);
  await page.getByTestId('file-new').click();
  expect(await editorState(page, `${LAYERS}.length`)).toBe(0);
  await expect(page.getByTestId('save-status')).toHaveText('Saved in this browser');
  await page.reload();
  await page.waitForSelector('html[data-restored]');
  expect(await editorState(page, `${LAYERS}.length`)).toBe(0);
});

test('a file from a future version is refused with a clear message and changes nothing', async ({ page }) => {
  await open(page);
  await author(page);
  await expect(page.getByTestId('save-status')).toHaveText('Saved in this browser');

  await page.getByTestId('file-open').setInputFiles('tests/fixtures/future.holdframe');
  await expect(page.getByTestId('file-error')).toContainText(
    'Could not open future.holdframe. This project was saved by a newer version of holdframe (file version 2). This build reads up to version 1.',
  );
  await expectAuthored(page);

  await page.getByTestId('file-open').setInputFiles('tests/fixtures/broken.holdframe');
  await expect(page.getByTestId('file-error')).toContainText('composition.fps: expected a finite number');
  await expectAuthored(page);

  await page.reload();
  await page.waitForSelector('html[data-restored]');
  await expectAuthored(page);
});

test('an autosave from a future version is reported and left untouched', async ({ page }) => {
  await open(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('holdframe', 1);
        request.onsuccess = () => {
          const tx = request.result.transaction('projects', 'readwrite');
          tx.objectStore('projects').put({ version: 3, composition: { scenes: [] } }, 'autosave');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.waitForSelector('html[data-restored]');
  await expect(page.getByTestId('file-error')).toContainText('newer version of holdframe (file version 3)');
  expect(await editorState(page, `${LAYERS}.length`)).toBe(0);

  await page.getByTestId('add-rect').click();
  await page.waitForTimeout(600);
  const stored = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const request = indexedDB.open('holdframe', 1);
        request.onsuccess = () => {
          const get = request.result.transaction('projects').objectStore('projects').get('autosave');
          get.onsuccess = () => resolve(get.result);
        };
      }),
  );
  expect(stored).toEqual({ version: 3, composition: { scenes: [] } });
});
