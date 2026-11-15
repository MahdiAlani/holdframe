const images = new Map<string, CanvasImageSource>();
const listeners = new Set<() => void>();

export function getImage(id: string): CanvasImageSource | null {
  return images.get(id) ?? null;
}

export function setImage(id: string, source: CanvasImageSource): void {
  images.set(id, source);
  listeners.forEach((fn) => fn());
}

export function onAssetsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
