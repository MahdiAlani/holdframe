import { describe, expect, it } from 'vitest';
import { createImageLayer, createProject, createShapeLayer, createTextLayer } from '../model/create';
import type { Project, TextAnimator } from '../model/types';
import { gifDelays } from './gif';
import { exportLottie, parseColour } from './lottie';

type Any = any;
const linear = { kind: 'linear' } as const;
const mono = (text: string): number => Array.from(text).length * 10;

function project(): Project {
  return createProject({ width: 400, height: 200, fps: 30, duration: 2, background: '#102030' });
}

const animator: TextAnimator = {
  unit: 'character',
  stagger: 0.1,
  order: 'forward',
  duration: 0.5,
  easing: { kind: 'bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  from: { position: { x: 0, y: 40 }, opacity: 0, blur: 6 },
};

describe('gifDelays', () => {
  it('sums to the exact duration when 100 / fps is not whole', () => {
    const delays = gifDelays(120, 30);
    expect(delays.reduce((a, b) => a + b, 0)).toBe(400);
    expect(new Set(delays)).toEqual(new Set([3, 4]));
    expect(gifDelays(100, 25)).toEqual(new Array(100).fill(4));
    expect(gifDelays(48, 24).reduce((a, b) => a + b, 0)).toBe(200);
  });
});

describe('parseColour', () => {
  it('reads hex and rgb forms', () => {
    expect(parseColour('#fff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColour('#FF000080').a).toBeCloseTo(0.502, 2);
    expect(parseColour('rgba(255, 0, 51, 0.5)')).toEqual({ r: 1, g: 0, b: 0.2, a: 0.5 });
    expect(parseColour('rgb(0 128 255)').g).toBeCloseTo(0.502, 2);
    expect(parseColour('nonsense')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('exportLottie', () => {
  it('writes composition settings and a background solid at the bottom', () => {
    const json = exportLottie(project()) as Any;
    expect(json).toMatchObject({ fr: 30, ip: 0, op: 60, w: 400, h: 200 });
    expect(json.layers).toHaveLength(1);
    expect(json.layers[0]).toMatchObject({ ty: 1, sc: '#102030', sw: 400, sh: 200 });
    const transparent = project();
    transparent.composition.background = null;
    expect((exportLottie(transparent) as Any).layers).toHaveLength(0);
  });

  it('keeps layer order, in/out points and blend modes, and skips hidden layers', () => {
    const p = project();
    const comp = p.composition;
    comp.layers = [
      createShapeLayer(comp, 'ellipse', { name: 'top', inPoint: 0.5, outPoint: 1.5, blendMode: 'screen' }),
      createShapeLayer(comp, 'rect', { name: 'hidden', visible: false }),
      createShapeLayer(comp, 'rect', { name: 'bottom', blendMode: 'add' }),
    ];
    const { layers } = exportLottie(p) as Any;
    expect(layers.map((l: Any) => l.nm)).toEqual(['top', 'bottom', 'Background']);
    expect(layers[0]).toMatchObject({ ty: 4, ip: 15, op: 45, bm: 2 });
    expect(layers[1].bm).toBe(16);
    expect(new Set(layers.map((l: Any) => l.ind)).size).toBe(3);
  });

  it('converts transforms to Lottie units', () => {
    const p = project();
    const layer = createShapeLayer(p.composition, 'rect');
    layer.transform = {
      anchor: { static: { x: 5, y: 6 } },
      position: { static: { x: 100, y: 50 } },
      scale: { static: { x: 2, y: 0.5 } },
      rotation: { static: 30 },
      opacity: { static: 0.4 },
    };
    p.composition.layers = [layer];
    expect((exportLottie(p) as Any).layers[0].ks).toEqual({
      a: { a: 0, k: [5, 6] },
      p: { a: 0, k: [100, 50] },
      s: { a: 0, k: [200, 50] },
      r: { a: 0, k: 30 },
      o: { a: 0, k: 40 },
    });
  });

  it('writes keyframes in frames with bezier, linear and hold easing', () => {
    const p = project();
    const layer = createShapeLayer(p.composition, 'rect');
    layer.transform.rotation = {
      keyframes: [
        { t: 0, value: 0, easing: { kind: 'bezier', x1: 0.1, y1: 0.2, x2: 0.3, y2: 1.4 } },
        { t: 0.5, value: 90, easing: linear },
        { t: 1, value: 45, easing: { kind: 'hold' } },
        { t: 1.5, value: 0, easing: linear },
      ],
    };
    layer.transform.opacity = { keyframes: [{ t: 1, value: 0.5, easing: linear }] };
    p.composition.layers = [layer];
    const ks = (exportLottie(p) as Any).layers[0].ks;
    expect(ks.r).toEqual({
      a: 1,
      k: [
        { t: 0, s: [0], o: { x: [0.1], y: [0.2] }, i: { x: [0.3], y: [1.4] } },
        { t: 15, s: [90], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
        { t: 30, s: [45], h: 1 },
        { t: 45, s: [0] },
      ],
    });
    expect(ks.o).toEqual({ a: 0, k: 50 });
  });

  it('writes rect and ellipse shapes with the stroke above the fill', () => {
    const p = project();
    const comp = p.composition;
    const rect = createShapeLayer(comp, 'rect', { fill: '#ff0000', stroke: { colour: 'rgba(0, 255, 0, 0.5)', width: 3 } });
    rect.size = { static: { x: 120, y: 60 } };
    rect.cornerRadius = { static: 8 };
    comp.layers = [rect, createShapeLayer(comp, 'ellipse', { fill: null })];
    const { layers } = exportLottie(p) as Any;
    const items = layers[0].shapes[0].it;
    expect(items.map((i: Any) => i.ty)).toEqual(['rc', 'st', 'fl', 'tr']);
    expect(items[0]).toMatchObject({ s: { a: 0, k: [120, 60] }, r: { a: 0, k: 8 }, p: { a: 0, k: [0, 0] } });
    expect(items[1]).toMatchObject({ c: { k: [0, 1, 0, 1] }, o: { k: 50 }, w: { k: 3 } });
    expect(items[2].c.k).toEqual([1, 0, 0, 1]);
    expect(layers[1].shapes[0].it.map((i: Any) => i.ty)).toEqual(['el', 'tr']);
  });

  it('writes plain text as one text layer with alignment and line height', () => {
    const p = project();
    p.composition.layers = [
      createTextLayer(p.composition, { text: 'a\nb', fontFamily: 'Arial, sans-serif', fontSize: 40, fontWeight: 700, lineHeight: 1.5, align: 'center', fill: '#ffcc00' }),
    ];
    const json = exportLottie(p) as Any;
    expect(json.fonts.list).toEqual([
      { fName: 'Font0', fFamily: 'Arial, sans-serif', fStyle: 'Bold', fWeight: '700', ascent: 75, origin: 0 },
    ]);
    expect(json.layers[0].ty).toBe(5);
    expect(json.layers[0].t.d.k[0].s).toMatchObject({ s: 40, f: 'Font0', t: 'a\rb', j: 2, lh: 60, fc: [1, 0.8, 0] });
  });

  it('writes animated text as one staggered layer per unit under a transform null', () => {
    const p = project();
    const layer = createTextLayer(p.composition, { id: 't', text: 'abc', fontSize: 20, align: 'left', inPoint: 0.5, animator });
    layer.transform.position = { static: { x: 100, y: 50 } };
    p.composition.layers = [layer];
    const { layers } = exportLottie(p, { measure: mono }) as Any;
    expect(layers.map((l: Any) => l.ty)).toEqual([5, 5, 5, 3, 1]);
    const parent = layers[3];
    expect(parent.ks.p).toEqual({ a: 0, k: [100, 50] });
    expect(parent.ks.o).toEqual({ a: 0, k: 100 });
    expect(layers.slice(0, 3).every((l: Any) => l.parent === parent.ind && l.ip === 15)).toBe(true);
    expect(layers.slice(0, 3).map((l: Any) => l.t.d.k[0].s.t)).toEqual(['a', 'b', 'c']);

    // Unit 1 starts one stagger after the in point and runs for the animator duration.
    const second = layers[1].ks;
    expect(second.a).toEqual({ a: 0, k: [5, -7] });
    expect(second.p).toEqual({
      a: 1,
      k: [
        { t: 18, s: [15, 33], o: { x: [0.34], y: [1.56] }, i: { x: [0.64], y: [1] } },
        { t: 33, s: [15, -7] },
      ],
    });
    expect(second.o.k.map((k: Any) => [k.t, k.s[0]])).toEqual([
      [18, 0],
      [33, 100],
    ]);
    expect(second.s).toEqual({ a: 0, k: [100, 100] });
    expect(layers[1].ef[0].ef[0].v.k[0].s[0]).toBeCloseTo(20);
  });

  it('steps units with a hold key when the animator duration is zero', () => {
    const p = project();
    p.composition.layers = [
      createTextLayer(p.composition, { text: 'ab', animator: { ...animator, duration: 0, from: { opacity: 0 } } }),
    ];
    const { layers } = exportLottie(p, { measure: mono }) as Any;
    expect(layers[1].ks.o.k).toEqual([{ t: 2, s: [0], h: 1 }, { t: 3, s: [100] }]);
  });

  it('bakes unit opacity per frame when the layer opacity is animated too', () => {
    const p = project();
    const layer = createTextLayer(p.composition, { text: 'a', animator: { ...animator, easing: linear, from: { opacity: 0 } } });
    layer.transform.opacity = {
      keyframes: [
        { t: 0, value: 1, easing: linear },
        { t: 2, value: 0, easing: linear },
      ],
    };
    p.composition.layers = [layer];
    const o = (exportLottie(p, { measure: mono }) as Any).layers[0].ks.o;
    expect(o.k).toHaveLength(61);
    // Frame 6: unit is 40% in, layer is 90% opaque.
    expect(o.k[6].s[0]).toBeCloseTo(0.4 * 0.9 * 100);
    expect(o.k[60].s[0]).toBeCloseTo(0);
  });

  it('embeds images and resizes them through a child layer', () => {
    const p = project();
    const image = createImageLayer(p.composition, 'pic', { x: 200, y: 50 });
    p.composition.layers = [image];
    expect((exportLottie(p) as Any).layers.map((l: Any) => l.ty)).toEqual([1]);
    const json = exportLottie(p, { assets: { pic: { dataUrl: 'data:image/png;base64,AA', width: 100, height: 100 } } }) as Any;
    expect(json.assets).toEqual([{ id: 'image_pic', w: 100, h: 100, u: '', p: 'data:image/png;base64,AA', e: 1 }]);
    expect(json.layers[0]).toMatchObject({ ty: 2, refId: 'image_pic', parent: json.layers[1].ind });
    expect(json.layers[0].ks).toMatchObject({ a: { k: [50, 50] }, s: { k: [200, 50] } });
  });

  it('is plain JSON', () => {
    const p = project();
    p.composition.layers = [createTextLayer(p.composition, { animator })];
    const json = exportLottie(p, { measure: mono });
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
  });
});
