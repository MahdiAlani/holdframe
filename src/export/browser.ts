import { getAssetBlob, getImage } from '../assets/registry';
import type { Project } from '../model/types';
import { createCanvasMeasurer } from '../render';
import { exportLottie, type LottieAsset } from './lottie';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Lets the canvas turn any CSS colour into #rrggbb or rgba().
export function canvasColourNormaliser(): (css: string) => string {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return (css) => {
    ctx.fillStyle = '#000000';
    ctx.fillStyle = css;
    return ctx.fillStyle;
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function lottieAssets(project: Project): Promise<Record<string, LottieAsset>> {
  const out: Record<string, LottieAsset> = {};
  for (const layer of project.composition.layers) {
    if (layer.kind !== 'image' || out[layer.assetId]) continue;
    const blob = getAssetBlob(layer.assetId);
    const bitmap = getImage(layer.assetId) as ImageBitmap | null;
    if (!blob || !bitmap) continue;
    out[layer.assetId] = { dataUrl: await blobToDataUrl(blob), width: bitmap.width, height: bitmap.height };
  }
  return out;
}

export async function exportLottieBlob(project: Project): Promise<Blob> {
  const json = exportLottie(project, {
    measure: createCanvasMeasurer(),
    assets: await lottieAssets(project),
    normaliseColour: canvasColourNormaliser(),
  });
  return new Blob([JSON.stringify(json)], { type: 'application/json' });
}
