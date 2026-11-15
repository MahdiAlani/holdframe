import type { Layer, Project, Time } from '../model/types';
import { resolveNumber, resolveVec2 } from './animatable';
import { transformMatrix } from './matrix';
import type { DrawCommand, RenderTree } from './renderTree';

// A layer is live for inPoint <= t < outPoint.
export function isLayerActive(layer: Layer, t: Time): boolean {
  return layer.visible && t >= layer.inPoint && t < layer.outPoint;
}

function evaluateLayer(layer: Layer, t: Time): DrawCommand {
  const tr = layer.transform;
  const base = {
    layerId: layer.id,
    matrix: transformMatrix(
      resolveVec2(tr.anchor, t),
      resolveVec2(tr.position, t),
      resolveVec2(tr.scale, t),
      resolveNumber(tr.rotation, t),
    ),
    opacity: Math.min(1, Math.max(0, resolveNumber(tr.opacity, t))),
    blendMode: layer.blendMode,
  };
  switch (layer.kind) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        text: layer.text,
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize,
        fontWeight: layer.fontWeight,
        fill: layer.fill,
        align: layer.align,
        lineHeight: layer.lineHeight,
      };
    case 'shape': {
      const size = resolveVec2(layer.size, t);
      const width = Math.max(0, size.x);
      const height = Math.max(0, size.y);
      if (layer.shape === 'ellipse') {
        return { ...base, kind: 'ellipse', width, height, fill: layer.fill, stroke: layer.stroke };
      }
      const radius = Math.min(Math.max(0, resolveNumber(layer.cornerRadius, t)), width / 2, height / 2);
      return { ...base, kind: 'rect', width, height, cornerRadius: radius, fill: layer.fill, stroke: layer.stroke };
    }
    case 'image': {
      const size = resolveVec2(layer.size, t);
      return { ...base, kind: 'image', assetId: layer.assetId, width: Math.max(0, size.x), height: Math.max(0, size.y) };
    }
  }
}

export function evaluate(project: Project, t: Time): RenderTree {
  const comp = project.composition;
  const commands: DrawCommand[] = [];
  for (let i = comp.layers.length - 1; i >= 0; i--) {
    const layer = comp.layers[i]!;
    if (isLayerActive(layer, t)) commands.push(evaluateLayer(layer, t));
  }
  return { width: comp.width, height: comp.height, background: comp.background, commands };
}
