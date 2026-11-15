import { evaluate } from '../eval';
import type { Project } from '../model/types';
import { createCanvas2DRenderer, createCanvasMeasurer, type AssetResolver } from '../render';
import { frameCount } from '../store/playback';

export type Progress = (done: number, total: number) => void;

export interface FrameRenderer {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  frames: number;
  fps: number;
  render(frame: number): void;
}

// Renders composition frames offscreen at full resolution, frame i at t = i / fps.
export function createFrameRenderer(project: Project, assets: AssetResolver): FrameRenderer {
  const comp = project.composition;
  const canvas = new OffscreenCanvas(comp.width, comp.height);
  const renderer = createCanvas2DRenderer(canvas, assets);
  const measure = createCanvasMeasurer();
  return {
    canvas,
    ctx: canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D,
    frames: frameCount(comp),
    fps: comp.fps,
    render: (frame) => renderer.render(evaluate(project, frame / comp.fps, measure)),
  };
}

export const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));
