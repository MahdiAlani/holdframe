import type {
  Composition,
  ImageLayer,
  LayerBase,
  Project,
  ShapeLayer,
  TextLayer,
  Transform,
  Vec2,
} from './types';

let counter = 0;

export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createTransform(position: Vec2 = { x: 0, y: 0 }): Transform {
  return {
    anchor: { static: { x: 0, y: 0 } },
    position: { static: position },
    scale: { static: { x: 1, y: 1 } },
    rotation: { static: 0 },
    opacity: { static: 1 },
  };
}

export function createProject(overrides: Partial<Composition> = {}): Project {
  return {
    version: 1,
    composition: {
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 4,
      background: '#111111',
      layers: [],
      ...overrides,
    },
  };
}

function base(comp: Composition, name: string): LayerBase {
  return {
    id: newId(),
    name,
    visible: true,
    locked: false,
    inPoint: 0,
    outPoint: comp.duration,
    transform: createTransform({ x: comp.width / 2, y: comp.height / 2 }),
    blendMode: 'normal',
  };
}

export function createTextLayer(comp: Composition, overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    ...base(comp, 'Text'),
    kind: 'text',
    text: 'Text',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 96,
    fontWeight: 700,
    fill: '#ffffff',
    align: 'center',
    lineHeight: 1.2,
    animator: null,
    ...overrides,
  };
}

export function createShapeLayer(
  comp: Composition,
  shape: 'rect' | 'ellipse',
  overrides: Partial<ShapeLayer> = {},
): ShapeLayer {
  return {
    ...base(comp, shape === 'rect' ? 'Rectangle' : 'Ellipse'),
    kind: 'shape',
    shape,
    size: { static: { x: 300, y: 300 } },
    fill: '#4f8cff',
    stroke: null,
    cornerRadius: { static: 0 },
    ...overrides,
  };
}

export function createImageLayer(
  comp: Composition,
  assetId: string,
  size: Vec2,
  overrides: Partial<ImageLayer> = {},
): ImageLayer {
  return {
    ...base(comp, 'Image'),
    kind: 'image',
    assetId,
    size: { static: size },
    ...overrides,
  };
}
