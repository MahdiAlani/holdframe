import { addImageAsset } from '../assets/registry';
import { createImageLayer, createShapeLayer, createTextLayer } from '../model/create';
import type { Layer } from '../model/types';
import { insertLayer, moveLayer, removeLayer, replaceLayer, useEditor } from '../store';

function insertOnTop(layer: Layer): void {
  const s = useEditor.getState();
  s.execute(insertLayer(layer, 0));
  s.selectLayer(layer.id);
}

export function addLayer(kind: 'text' | 'rect' | 'ellipse'): void {
  const comp = useEditor.getState().project.composition;
  insertOnTop(kind === 'text' ? createTextLayer(comp) : createShapeLayer(comp, kind));
}

export async function addImageLayer(file: Blob): Promise<void> {
  const asset = await addImageAsset(file);
  const comp = useEditor.getState().project.composition;
  const fit = Math.min(1, (comp.width * 0.8) / asset.width, (comp.height * 0.8) / asset.height);
  insertOnTop(
    createImageLayer(comp, asset.id, { x: Math.round(asset.width * fit), y: Math.round(asset.height * fit) }),
  );
}

export function deleteLayer(id: string): void {
  const s = useEditor.getState();
  const index = s.project.composition.layers.findIndex((l) => l.id === id);
  const layer = s.project.composition.layers[index];
  if (layer) s.execute(removeLayer(layer, index));
}

export function shiftLayer(id: string, delta: -1 | 1): void {
  const s = useEditor.getState();
  const layers = s.project.composition.layers;
  const from = layers.findIndex((l) => l.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= layers.length) return;
  s.execute(moveLayer(from, to));
}

export function updateLayer(prev: Layer, next: Layer, label: string, gesture?: string): void {
  if (next === prev) return;
  useEditor.getState().execute(replaceLayer(prev, next, label), gesture);
}
