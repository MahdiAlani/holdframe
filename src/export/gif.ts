import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import type { Project } from '../model/types';
import type { AssetResolver } from '../render';
import { createFrameRenderer, nextTask, type Progress } from './frames';

// GIF delays are whole centiseconds. Spreading the rounding error across frames
// keeps the total duration exact even when 100 / fps is not an integer.
export function gifDelays(frames: number, fps: number): number[] {
  return Array.from({ length: frames }, (_, i) => Math.round(((i + 1) * 100) / fps) - Math.round((i * 100) / fps));
}

export async function exportGif(project: Project, assets: AssetResolver, onProgress?: Progress): Promise<Blob> {
  const { width, height, background } = project.composition;
  const frames = createFrameRenderer(project, assets);
  const delays = gifDelays(frames.frames, frames.fps);
  const transparent = background === null;
  const format = transparent ? 'rgba4444' : 'rgb565';
  const gif = GIFEncoder();

  for (let i = 0; i < frames.frames; i++) {
    frames.render(i);
    const { data } = frames.ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256, { format, oneBitAlpha: transparent });
    const index = applyPalette(data, palette, format);
    const transparentIndex = transparent ? palette.findIndex((c) => c[3] === 0) : -1;
    gif.writeFrame(index, width, height, {
      palette,
      delay: delays[i]! * 10,
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: transparent ? 2 : undefined,
    });
    onProgress?.(i + 1, frames.frames);
    await nextTask();
  }
  gif.finish();
  return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
}
