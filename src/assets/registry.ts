import { newId } from '../model/create';
import { idbPut } from './db';

interface Asset {
  blob: Blob;
  bitmap: ImageBitmap;
}

const assets = new Map<string, Asset>();
const listeners = new Set<() => void>();

export function getImage(id: string): CanvasImageSource | null {
  return assets.get(id)?.bitmap ?? null;
}

export function getAssetBlob(id: string): Blob | null {
  return assets.get(id)?.blob ?? null;
}

export function hasAsset(id: string): boolean {
  return assets.has(id);
}

export async function registerAsset(id: string, blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  assets.set(id, { blob, bitmap });
  void idbPut('assets', id, blob).catch(() => undefined);
  listeners.forEach((fn) => fn());
  return { width: bitmap.width, height: bitmap.height };
}

export async function addImageAsset(blob: Blob): Promise<{ id: string; width: number; height: number }> {
  const id = newId();
  return { id, ...(await registerAsset(id, blob)) };
}

export function onAssetsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
