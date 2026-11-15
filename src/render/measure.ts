import type { MeasureText } from '../eval/text';
import { fontString } from './canvas2d';

export function createCanvasMeasurer(): MeasureText {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const cache = new Map<string, number>();
  return (text, font) => {
    const css = fontString(font);
    const key = `${css}\n${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      ctx.font = css;
      width = ctx.measureText(text).width;
      if (cache.size > 5000) cache.clear();
      cache.set(key, width);
    }
    return width;
  };
}
