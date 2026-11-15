import type { Page } from '@playwright/test';

// Loads the golden fixture into the running editor through the dev-only store handle.
export async function loadFixture(page: Page, overrides: { duration?: number } = {}): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('[data-testid="timeline"]');
  await page.evaluate(async (o) => {
    const project = await (await fetch('/tests/fixtures/golden.json')).json();
    if (o.duration !== undefined) project.composition.duration = o.duration;
    (window as any).__holdframe.getState().loadProject(project);
  }, overrides);
}

export function editorState<T>(page: Page, pick: string): Promise<T> {
  return page.evaluate((expr) => {
    const state = (window as any).__holdframe.getState();
    return new Function('s', `return ${expr}`)(state);
  }, pick);
}

export function canvasPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="viewport-canvas"]')!;
      return Array.from(canvas.getContext('2d')!.getImageData(px!, py!, 1, 1).data);
    },
    [x, y],
  );
}
