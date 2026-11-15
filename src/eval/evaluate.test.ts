import { describe, expect, it } from 'vitest';
import { createImageLayer, createProject, createShapeLayer, createTextLayer } from '../model/create';
import type { Project } from '../model/types';
import { evaluate } from './evaluate';
import { applyToPoint, invert, multiply, transformMatrix } from './matrix';

const linear = { kind: 'linear' } as const;

function close(actual: { x: number; y: number }, x: number, y: number) {
  expect(actual.x).toBeCloseTo(x, 9);
  expect(actual.y).toBeCloseTo(y, 9);
}

describe('transformMatrix', () => {
  it('maps the anchor to the position', () => {
    const m = transformMatrix({ x: 10, y: 20 }, { x: 100, y: 50 }, { x: 2, y: 3 }, 37);
    close(applyToPoint(m, { x: 10, y: 20 }), 100, 50);
  });

  it('applies scale, then rotation, about the anchor', () => {
    const m = transformMatrix({ x: 10, y: 20 }, { x: 100, y: 50 }, { x: 2, y: 3 }, 90);
    close(applyToPoint(m, { x: 11, y: 20 }), 100, 52);
    close(applyToPoint(m, { x: 10, y: 21 }), 97, 50);
  });

  it('rotates clockwise in y-down space', () => {
    const m = transformMatrix({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, 90);
    close(applyToPoint(m, { x: 1, y: 0 }), 0, 1);
  });

  it('is the identity for a default transform', () => {
    const m = transformMatrix({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, 0);
    expect(m).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('inverts', () => {
    const m = transformMatrix({ x: 5, y: -3 }, { x: 40, y: 60 }, { x: 1.5, y: 0.5 }, 33);
    const id = multiply(m, invert(m)!);
    [1, 0, 0, 1, 0, 0].forEach((v, i) => expect(id[i]).toBeCloseTo(v, 9));
    expect(invert([0, 0, 0, 0, 1, 1])).toBeNull();
  });
});

function fixture(): Project {
  const project = createProject({ width: 200, height: 100, duration: 4, background: '#000' });
  const comp = project.composition;
  comp.layers = [
    createTextLayer(comp, { id: 'top', text: 'hi' }),
    createShapeLayer(comp, 'ellipse', { id: 'mid', inPoint: 1, outPoint: 2 }),
    createShapeLayer(comp, 'rect', { id: 'bottom' }),
  ];
  return project;
}

describe('evaluate', () => {
  it('carries composition settings into the tree', () => {
    const tree = evaluate(fixture(), 0);
    expect(tree).toMatchObject({ width: 200, height: 100, background: '#000' });
  });

  it('orders commands bottom first, so layer 0 paints last', () => {
    const tree = evaluate(fixture(), 1.5);
    expect(tree.commands.map((c) => c.layerId)).toEqual(['bottom', 'mid', 'top']);
  });

  it('omits layers outside inPoint..outPoint', () => {
    const ids = (t: number) => evaluate(fixture(), t).commands.map((c) => c.layerId);
    expect(ids(0.999)).not.toContain('mid');
    expect(ids(1)).toContain('mid');
    expect(ids(1.999)).toContain('mid');
    expect(ids(2)).not.toContain('mid');
    expect(ids(4)).toEqual([]);
    expect(ids(-0.1)).toEqual([]);
  });

  it('omits hidden layers', () => {
    const project = fixture();
    project.composition.layers[2]!.visible = false;
    expect(evaluate(project, 0).commands.map((c) => c.layerId)).toEqual(['top']);
  });

  it('resolves static and keyframed properties together', () => {
    const project = createProject({ width: 200, height: 100 });
    const layer = createShapeLayer(project.composition, 'rect', { id: 'r' });
    layer.transform.position = {
      keyframes: [
        { t: 0, value: { x: 0, y: 0 }, easing: linear },
        { t: 2, value: { x: 100, y: 40 }, easing: linear },
      ],
    };
    layer.transform.opacity = {
      keyframes: [
        { t: 0, value: 0, easing: { kind: 'hold' } },
        { t: 1, value: 0.5, easing: linear },
      ],
    };
    layer.size = { static: { x: 20, y: 10 } };
    layer.cornerRadius = {
      keyframes: [
        { t: 0, value: 0, easing: linear },
        { t: 2, value: 4, easing: linear },
      ],
    };
    project.composition.layers = [layer];

    const at = (t: number) => evaluate(project, t).commands[0]!;
    expect(at(0.5)).toMatchObject({ kind: 'rect', width: 20, height: 10, cornerRadius: 1, opacity: 0 });
    expect(at(0.5).matrix).toEqual([1, 0, 0, 1, 25, 10]);
    expect(at(1).opacity).toBe(0.5);
    expect(at(3).matrix).toEqual([1, 0, 0, 1, 100, 40]);
    expect(at(3)).toMatchObject({ cornerRadius: 4 });
  });

  it('composes anchor, scale and rotation into the command matrix', () => {
    const project = createProject();
    const layer = createShapeLayer(project.composition, 'rect', { id: 'r' });
    layer.transform = {
      anchor: { static: { x: 10, y: 20 } },
      position: { static: { x: 100, y: 50 } },
      scale: { static: { x: 2, y: 3 } },
      rotation: { static: 90 },
      opacity: { static: 1 },
    };
    project.composition.layers = [layer];
    const m = evaluate(project, 0).commands[0]!.matrix;
    close(applyToPoint(m, { x: 10, y: 20 }), 100, 50);
    close(applyToPoint(m, { x: 11, y: 20 }), 100, 52);
    close(applyToPoint(m, { x: 10, y: 21 }), 97, 50);
  });

  it('clamps opacity and corner radius to valid ranges', () => {
    const project = createProject();
    const layer = createShapeLayer(project.composition, 'rect', { id: 'r' });
    layer.transform.opacity = { static: 1.7 };
    layer.size = { static: { x: 20, y: 10 } };
    layer.cornerRadius = { static: 99 };
    project.composition.layers = [layer];
    expect(evaluate(project, 0).commands[0]).toMatchObject({ opacity: 1, cornerRadius: 5 });
  });

  it('emits a command per layer kind with its own fields', () => {
    const project = createProject();
    const comp = project.composition;
    comp.layers = [
      createTextLayer(comp, { id: 't', text: 'Hello', fontSize: 40, align: 'left' }),
      createShapeLayer(comp, 'ellipse', { id: 'e', fill: null, stroke: { colour: '#f00', width: 2 } }),
      createImageLayer(comp, 'asset-1', { x: 64, y: 32 }, { id: 'i', blendMode: 'screen' }),
    ];
    const [image, ellipse, text] = evaluate(project, 0).commands;
    expect(image).toMatchObject({ kind: 'image', assetId: 'asset-1', width: 64, height: 32, blendMode: 'screen' });
    expect(ellipse).toMatchObject({ kind: 'ellipse', fill: null, stroke: { colour: '#f00', width: 2 } });
    expect(text).toMatchObject({ kind: 'text', text: 'Hello', fontSize: 40, align: 'left' });
  });

  it('does not mutate the project', () => {
    const project = fixture();
    const before = JSON.stringify(project);
    evaluate(project, 1.5);
    expect(JSON.stringify(project)).toBe(before);
  });
});
