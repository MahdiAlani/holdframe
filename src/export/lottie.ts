import { resolveNumber } from '../eval/animatable';
import { approximateMeasure, layoutUnits, unitProgress, unitRanks, type MeasureText } from '../eval/text';
import type {
  Animatable,
  BlendMode,
  Easing,
  ImageLayer,
  Layer,
  Project,
  ShapeLayer,
  TextLayer,
  Transform,
  Vec2,
} from '../model/types';

export interface LottieAsset {
  dataUrl: string;
  width: number;
  height: number;
}

export interface LottieOptions {
  measure?: MeasureText;
  assets?: Record<string, LottieAsset>;
  // Turns any CSS colour into #rrggbb or rgb()/rgba(). Hex and rgb() are understood without it.
  normaliseColour?: (css: string) => string;
}

type Json = Record<string, unknown>;
interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

// lottie-web has no equivalent of `add`; 16 is the format's own code for it.
const BLEND: Record<BlendMode, number> = { normal: 0, multiply: 1, screen: 2, overlay: 3, add: 16 };
// lottie-web converts Gaussian blur "blurriness" to a standard deviation with this factor.
const BLURRINESS_TO_SIGMA = 0.3;
const NAMED: Record<string, string> = { black: '#000000', white: '#ffffff', transparent: '#00000000' };

export function parseColour(input: string): Rgba {
  const raw = input.trim().toLowerCase();
  const s = NAMED[raw] ?? raw;
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? Array.from(hex, (c) => c + c).join('') : hex;
    if (full.length === 6 || full.length === 8) {
      const n = (i: number): number => parseInt(full.slice(i, i + 2), 16) / 255;
      return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) : 1 };
    }
  }
  const parts = /^rgba?\(([^)]+)\)$/.exec(s)?.[1]?.split(/[\s,/]+/).filter(Boolean).map(Number.parseFloat);
  if (parts && parts.length >= 3 && parts.every(Number.isFinite)) {
    return { r: parts[0]! / 255, g: parts[1]! / 255, b: parts[2]! / 255, a: parts[3] ?? 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

const toHex = (c: Rgba): string =>
  `#${[c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

function easingFields(easing: Easing): Json {
  if (easing.kind === 'hold') return { h: 1 };
  const [x1, y1, x2, y2] = easing.kind === 'linear' ? [0, 0, 1, 1] : [easing.x1, easing.y1, easing.x2, easing.y2];
  return { o: { x: [x1], y: [y1] }, i: { x: [x2], y: [y2] } };
}

const fixed = (values: number[], scalar: boolean): Json => ({ a: 0, k: scalar ? values[0] : values });

function animated<T>(prop: Animatable<T>, fps: number, map: (v: T) => number[], scalar = false): Json {
  if ('static' in prop) return fixed(map(prop.static), scalar);
  const keys = prop.keyframes;
  if (keys.length === 1) return fixed(map(keys[0]!.value), scalar);
  return {
    a: 1,
    k: keys.map((k, i) =>
      i === keys.length - 1
        ? { t: k.t * fps, s: map(k.value) }
        : { t: k.t * fps, s: map(k.value), ...easingFields(k.easing) },
    ),
  };
}

// A two-key animation from one pose to another, as each text unit performs.
function tween(from: number[], to: number[], startFrame: number, endFrame: number, easing: Easing, scalar = false): Json {
  if (from.every((v, i) => v === to[i])) return fixed(to, scalar);
  if (endFrame <= startFrame) {
    return { a: 1, k: [{ t: startFrame - 1, s: from, h: 1 }, { t: startFrame, s: to }] };
  }
  return { a: 1, k: [{ t: startFrame, s: from, ...easingFields(easing) }, { t: endFrame, s: to }] };
}

// One linear key per frame, for values no pair of keyframes can express.
function bake(value: (t: number) => number, startFrame: number, endFrame: number, fps: number): Json {
  const k: Json[] = [];
  for (let f = Math.floor(startFrame); f <= Math.ceil(endFrame); f++) {
    k.push({ t: f, s: [value(f / fps)], ...(f < Math.ceil(endFrame) ? easingFields({ kind: 'linear' }) : {}) });
  }
  return { a: 1, k };
}

const vec = (v: Vec2): number[] => [v.x, v.y];
const percent = (v: Vec2): number[] => [v.x * 100, v.y * 100];
const opacity = (v: number): number[] => [Math.min(1, Math.max(0, v)) * 100];

function transformKs(tr: Transform, fps: number, withOpacity = true): Json {
  return {
    a: animated(tr.anchor, fps, vec),
    p: animated(tr.position, fps, vec),
    s: animated(tr.scale, fps, percent),
    r: animated(tr.rotation, fps, (v) => [v], true),
    o: withOpacity ? animated(tr.opacity, fps, opacity, true) : { a: 0, k: 100 },
  };
}

function fontStyle(weight: number): string {
  if (weight <= 250) return 'Light';
  if (weight <= 450) return 'Regular';
  if (weight <= 600) return 'Medium';
  if (weight <= 800) return 'Bold';
  return 'Black';
}

export function exportLottie(project: Project, options: LottieOptions = {}): Json {
  const comp = project.composition;
  const fps = comp.fps;
  const measure = options.measure ?? approximateMeasure;
  const colour = (css: string): Rgba => parseColour(options.normaliseColour?.(css) ?? css);
  const layers: Json[] = [];
  const assets: Json[] = [];
  const fonts: Json[] = [];
  let nextIndex = 1;

  const base = (layer: Layer, ty: number, nm: string): Json => ({
    ddd: 0,
    ind: nextIndex++,
    ty,
    nm,
    sr: 1,
    ao: 0,
    ip: layer.inPoint * fps,
    op: layer.outPoint * fps,
    st: 0,
    bm: BLEND[layer.blendMode],
  });

  // A null carrying the layer transform. Children add their own on top; opacity is not inherited.
  const parentNull = (layer: Layer): Json => ({
    ...base(layer, 3, `${layer.name} transform`),
    bm: 0,
    ks: transformKs(layer.transform, fps, false),
  });

  const fontName = (layer: TextLayer): string => {
    const style = fontStyle(layer.fontWeight);
    const existing = fonts.find((f) => f.fFamily === layer.fontFamily && f.fStyle === style);
    if (existing) return existing.fName as string;
    const fName = `Font${fonts.length}`;
    fonts.push({ fName, fFamily: layer.fontFamily, fStyle: style, fWeight: String(layer.fontWeight), ascent: 75, origin: 0 });
    return fName;
  };

  const textData = (layer: TextLayer, text: string, justify: number): Json => {
    const c = colour(layer.fill);
    return {
      d: {
        k: [
          {
            t: 0,
            s: {
              s: layer.fontSize,
              f: fontName(layer),
              t: text.replace(/\n/g, '\r'),
              j: justify,
              tr: 0,
              lh: layer.fontSize * layer.lineHeight,
              ls: 0,
              fc: [c.r, c.g, c.b],
            },
          },
        ],
      },
      p: {},
      m: { g: 1, a: { a: 0, k: [0, 0] } },
      a: [],
    };
  };

  const textLayers = (layer: TextLayer): void => {
    const animator = layer.animator;
    if (!animator) {
      const justify = { left: 0, right: 1, center: 2 }[layer.align];
      layers.push({ ...base(layer, 5, layer.name), ks: transformKs(layer.transform, fps), t: textData(layer, layer.text, justify) });
      return;
    }
    const units = layoutUnits(layer, animator.unit, measure);
    const ranks = unitRanks(units.length, animator.order, layer.id);
    const parent = parentNull(layer);
    const from = animator.from;
    const layerOpacity = layer.transform.opacity;
    const staticOpacity = 'static' in layerOpacity ? layerOpacity.static : layerOpacity.keyframes.length === 1 ? layerOpacity.keyframes[0]!.value : null;

    units.forEach((unit, i) => {
      const start = (layer.inPoint + ranks[i]! * animator.stagger) * fps;
      const end = start + animator.duration * fps;
      const centre = { x: unit.x + unit.width / 2, y: unit.y - layer.fontSize * 0.35 };
      const fromOpacity = from.opacity ?? 1;
      const unitOpacity =
        staticOpacity !== null
          ? tween(opacity(staticOpacity * fromOpacity), opacity(staticOpacity), start, end, animator.easing, true)
          : fromOpacity === 1
            ? animated(layerOpacity, fps, opacity, true)
            : bake(
                (t) => {
                  const e = unitProgress(animator, ranks[i]!, t - layer.inPoint);
                  const own = Math.min(1, Math.max(0, 1 + (fromOpacity - 1) * (1 - e)));
                  return Math.min(1, Math.max(0, resolveNumber(layerOpacity, t))) * own * 100;
                },
                layer.inPoint * fps,
                layer.outPoint * fps,
                fps,
              );
      const unitLayer: Json = {
        ...base(layer, 5, `${layer.name} ${i + 1}`),
        parent: parent.ind,
        ks: {
          a: { a: 0, k: [unit.width / 2, -layer.fontSize * 0.35] },
          p: tween(
            [centre.x + (from.position?.x ?? 0), centre.y + (from.position?.y ?? 0)],
            [centre.x, centre.y],
            start,
            end,
            animator.easing,
          ),
          s: tween(percent(from.scale ?? { x: 1, y: 1 }), [100, 100], start, end, animator.easing),
          r: tween([from.rotation ?? 0], [0], start, end, animator.easing, true),
          o: unitOpacity,
        },
        t: textData(layer, unit.text, 0),
      };
      if (from.blur) {
        unitLayer.ef = [
          {
            ty: 29,
            nm: 'Gaussian Blur',
            np: 5,
            en: 1,
            ef: [
              { ty: 0, nm: 'Blurriness', v: tween([from.blur / BLURRINESS_TO_SIGMA], [0], start, end, animator.easing, true) },
              { ty: 7, nm: 'Blur Dimensions', v: { a: 0, k: 1 } },
              { ty: 7, nm: 'Repeat Edge Pixels', v: { a: 0, k: 0 } },
            ],
          },
        ];
      }
      layers.push(unitLayer);
    });
    layers.push(parent);
  };

  const shapeLayer = (layer: ShapeLayer): void => {
    const items: Json[] = [
      layer.shape === 'rect'
        ? {
            ty: 'rc',
            nm: 'Rectangle',
            d: 1,
            p: { a: 0, k: [0, 0] },
            s: animated(layer.size, fps, vec),
            r: animated(layer.cornerRadius, fps, (v) => [Math.max(0, v)], true),
          }
        : { ty: 'el', nm: 'Ellipse', d: 1, p: { a: 0, k: [0, 0] }, s: animated(layer.size, fps, vec) },
    ];
    // Earlier items paint on top, so the stroke precedes the fill.
    if (layer.stroke && layer.stroke.width > 0) {
      const c = colour(layer.stroke.colour);
      items.push({
        ty: 'st',
        nm: 'Stroke',
        c: { a: 0, k: [c.r, c.g, c.b, 1] },
        o: { a: 0, k: c.a * 100 },
        w: { a: 0, k: layer.stroke.width },
        lc: 1,
        lj: 1,
        ml: 10,
      });
    }
    if (layer.fill !== null) {
      const c = colour(layer.fill);
      items.push({ ty: 'fl', nm: 'Fill', c: { a: 0, k: [c.r, c.g, c.b, 1] }, o: { a: 0, k: c.a * 100 }, r: 1 });
    }
    items.push({
      ty: 'tr',
      a: { a: 0, k: [0, 0] },
      p: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    });
    layers.push({
      ...base(layer, 4, layer.name),
      ks: transformKs(layer.transform, fps),
      shapes: [{ ty: 'gr', nm: layer.name, it: items }],
    });
  };

  const imageLayer = (layer: ImageLayer): void => {
    const asset = options.assets?.[layer.assetId];
    if (!asset) return;
    const refId = `image_${layer.assetId}`;
    if (!assets.some((a) => a.id === refId)) {
      assets.push({ id: refId, w: asset.width, h: asset.height, u: '', p: asset.dataUrl, e: 1 });
    }
    // The image is drawn at natural size from its corner; the child centres and resizes it.
    const parent = parentNull(layer);
    layers.push({
      ...base(layer, 2, layer.name),
      parent: parent.ind,
      refId,
      ks: {
        a: { a: 0, k: [asset.width / 2, asset.height / 2] },
        p: { a: 0, k: [0, 0] },
        s: animated(layer.size, fps, (v) => [(v.x / asset.width) * 100, (v.y / asset.height) * 100]),
        r: { a: 0, k: 0 },
        o: animated(layer.transform.opacity, fps, opacity, true),
      },
    });
    layers.push(parent);
  };

  for (const layer of comp.layers) {
    if (!layer.visible) continue;
    if (layer.kind === 'text') textLayers(layer);
    else if (layer.kind === 'shape') shapeLayer(layer);
    else imageLayer(layer);
  }

  const frames = Math.max(1, Math.round(comp.duration * fps));
  if (comp.background !== null) {
    const c = colour(comp.background);
    layers.push({
      ddd: 0,
      ind: nextIndex++,
      ty: 1,
      nm: 'Background',
      sr: 1,
      ao: 0,
      ip: 0,
      op: frames,
      st: 0,
      bm: 0,
      sc: toHex(c),
      sw: comp.width,
      sh: comp.height,
      ks: { a: { a: 0, k: [0, 0] }, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: c.a * 100 } },
    });
  }

  return {
    v: '5.7.4',
    nm: 'holdframe',
    fr: fps,
    ip: 0,
    op: frames,
    w: comp.width,
    h: comp.height,
    ddd: 0,
    assets,
    fonts: { list: fonts },
    layers,
    markers: [],
    meta: { g: 'holdframe' },
  };
}
