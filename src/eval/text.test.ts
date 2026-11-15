import { describe, expect, it } from 'vitest';
import { createProject, createTextLayer } from '../model/create';
import { ANIMATOR_PRESETS } from '../model/presets';
import type { TextAnimator, TextLayer } from '../model/types';
import { validateProject } from '../model/validate';
import { evaluate } from './evaluate';
import { applyToPoint } from './matrix';
import type { TextCommand } from './renderTree';
import { animatorLength, layoutUnits, unitProgress, unitRanks, type MeasureText } from './text';

// Every character is 10px wide.
const mono: MeasureText = (text) => Array.from(text).length * 10;
const comp = createProject({ width: 400, height: 200 }).composition;

function animator(overrides: Partial<TextAnimator> = {}): TextAnimator {
  return {
    unit: 'character',
    stagger: 0.1,
    order: 'forward',
    duration: 0.5,
    easing: { kind: 'linear' },
    from: { opacity: 0 },
    ...overrides,
  };
}

function layer(overrides: Partial<TextLayer> = {}): TextLayer {
  const l = createTextLayer(comp, {
    id: 'text',
    text: 'abcd',
    fontSize: 20,
    lineHeight: 1.5,
    align: 'left',
    animator: animator(),
    ...overrides,
  });
  l.transform.position = { static: { x: 100, y: 50 } };
  return l;
}

function commands(l: TextLayer, t: number): TextCommand[] {
  const project = createProject({ width: 400, height: 200 });
  project.composition.layers = [l];
  return evaluate(project, t, mono).commands as TextCommand[];
}

const opacities = (l: TextLayer, t: number) => commands(l, t).map((c) => Number(c.opacity.toFixed(4)));

describe('layoutUnits', () => {
  it('splits characters and skips whitespace', () => {
    const units = layoutUnits(layer({ text: 'ab c\nd' }), 'character', mono);
    expect(units.map((u) => [u.text, u.x, u.y])).toEqual([
      ['a', 0, 0],
      ['b', 10, 0],
      ['c', 30, 0],
      ['d', 0, 30],
    ]);
    expect(units.every((u) => u.width === 10)).toBe(true);
  });

  it('splits words and lines', () => {
    const l = layer({ text: 'ab  cde\n\nf g' });
    expect(layoutUnits(l, 'word', mono).map((u) => [u.text, u.x, u.y, u.width])).toEqual([
      ['ab', 0, 0, 20],
      ['cde', 40, 0, 30],
      ['f', 0, 60, 10],
      ['g', 20, 60, 10],
    ]);
    expect(layoutUnits(l, 'line', mono).map((u) => [u.text, u.y])).toEqual([
      ['ab  cde', 0],
      ['f g', 60],
    ]);
  });

  it('offsets each line by its own width for centre and right alignment', () => {
    const centre = layoutUnits(layer({ text: 'abcd\nab', align: 'center' }), 'line', mono);
    expect(centre.map((u) => u.x)).toEqual([-20, -10]);
    const right = layoutUnits(layer({ text: 'abcd\nab', align: 'right' }), 'character', mono);
    expect(right.map((u) => u.x)).toEqual([-40, -30, -20, -10, -20, -10]);
  });

  it('treats astral characters as one unit', () => {
    expect(layoutUnits(layer({ text: 'a😀b' }), 'character', mono).map((u) => u.text)).toEqual(['a', '😀', 'b']);
  });
});

describe('unitRanks', () => {
  it('orders forward and reverse', () => {
    expect(unitRanks(4, 'forward', 'x')).toEqual([0, 1, 2, 3]);
    expect(unitRanks(4, 'reverse', 'x')).toEqual([3, 2, 1, 0]);
  });

  it('random is a permutation that is stable per seed', () => {
    const a = unitRanks(12, 'random', 'layer-a');
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(unitRanks(12, 'random', 'layer-a')).toEqual(a);
    expect(unitRanks(12, 'random', 'layer-b')).not.toEqual(a);
    expect(a).not.toEqual(unitRanks(12, 'forward', 'layer-a'));
  });
});

describe('unitProgress', () => {
  it('delays each rank by the stagger', () => {
    const a = animator();
    expect(unitProgress(a, 0, 0.25)).toBeCloseTo(0.5);
    expect(unitProgress(a, 2, 0.25)).toBeCloseTo(0.1);
    expect(unitProgress(a, 3, 0.25)).toBe(0);
    expect(unitProgress(a, 0, 9)).toBe(1);
  });

  it('steps when the duration is zero', () => {
    const a = animator({ duration: 0 });
    expect(unitProgress(a, 1, 0.0999)).toBe(0);
    expect(unitProgress(a, 1, 0.1)).toBe(1);
  });

  it('reports when the last unit settles', () => {
    expect(animatorLength(animator(), 4)).toBeCloseTo(0.8);
    expect(animatorLength(animator(), 0)).toBeCloseTo(0.5);
  });
});

describe('animated text evaluation', () => {
  it('emits one command per unit, and a single command without an animator', () => {
    expect(commands(layer(), 0)).toHaveLength(4);
    expect(commands(layer({ animator: animator({ unit: 'word' }), text: 'one two\nthree' }), 0)).toHaveLength(3);
    expect(commands(layer({ animator: animator({ unit: 'line' }), text: 'one two\nthree' }), 0)).toHaveLength(2);
    const plain = commands(layer({ animator: null }), 0);
    expect(plain).toHaveLength(1);
    expect(plain[0]).toMatchObject({ text: 'abcd', blur: 0 });
  });

  it('staggers units forward', () => {
    const l = layer();
    expect(opacities(l, 0)).toEqual([0, 0, 0, 0]);
    expect(opacities(l, 0.25)).toEqual([0.5, 0.3, 0.1, 0]);
    expect(opacities(l, 0.5)).toEqual([1, 0.8, 0.6, 0.4]);
    expect(opacities(l, 0.8)).toEqual([1, 1, 1, 1]);
  });

  it('staggers units in reverse', () => {
    expect(opacities(layer({ animator: animator({ order: 'reverse' }) }), 0.25)).toEqual([0, 0.1, 0.3, 0.5]);
  });

  it('staggers units in a random but repeatable order', () => {
    const l = layer({ animator: animator({ order: 'random' }), text: 'abcdefgh' });
    const first = opacities(l, 0.3);
    expect(opacities(l, 0.3)).toEqual(first);
    expect([...first].sort()).toEqual([...opacities(layer({ text: 'abcdefgh' }), 0.3)].sort());
    expect(first).not.toEqual(opacities(layer({ text: 'abcdefgh' }), 0.3));
  });

  it('measures time from the layer in point', () => {
    const l = layer({ inPoint: 1 });
    expect(commands(l, 0.5)).toHaveLength(0);
    expect(opacities(l, 1.25)).toEqual([0.5, 0.3, 0.1, 0]);
  });

  it('settles every unit at its laid-out position under the layer transform', () => {
    const l = layer({ animator: animator({ from: { position: { x: 0, y: 40 }, scale: { x: 0, y: 0 }, rotation: 90 } }) });
    const settled = commands(l, 3);
    expect(settled.map((c) => c.matrix)).toEqual([
      [1, 0, 0, 1, 100, 50],
      [1, 0, 0, 1, 110, 50],
      [1, 0, 0, 1, 120, 50],
      [1, 0, 0, 1, 130, 50],
    ]);
    expect(settled.every((c) => c.align === 'left' && c.opacity === 1)).toBe(true);
  });

  it('offsets position by the remaining fraction of `from`', () => {
    const l = layer({ animator: animator({ from: { position: { x: 0, y: 40 } } }) });
    const [first, second] = commands(l, 0.25);
    expect(first!.matrix[5]).toBeCloseTo(50 + 20);
    expect(second!.matrix[5]).toBeCloseTo(50 + 40 * 0.7);
    expect(first!.matrix[4]).toBeCloseTo(100);
  });

  it('scales and rotates each unit about its own centre', () => {
    const l = layer({ animator: animator({ from: { scale: { x: 0, y: 0 }, rotation: 180 } }) });
    const start = commands(l, 0)[1]!;
    // Unit 1 spans x 10..20 and its centre sits 0.35em above the baseline.
    const centre = { x: 100 + 15, y: 50 - 7 };
    const collapsed = applyToPoint(start.matrix, { x: 0, y: 0 });
    expect(collapsed.x).toBeCloseTo(centre.x);
    expect(collapsed.y).toBeCloseTo(centre.y);

    const half = commands(layer({ animator: animator({ stagger: 0, from: { rotation: 180 } }) }), 0.25)[1]!;
    // Half way through a 180 degree turn the unit is rotated 90 degrees about its centre.
    const origin = applyToPoint(half.matrix, { x: 0, y: 0 });
    expect(origin.x).toBeCloseTo(centre.x - 7);
    expect(origin.y).toBeCloseTo(centre.y - 5);
  });

  it('overshoots with a bezier that exceeds 1', () => {
    const l = layer({
      animator: animator({ stagger: 0, easing: { kind: 'bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }, from: { position: { x: 0, y: 40 } } }),
    });
    expect(commands(l, 0.3)[0]!.matrix[5]).toBeLessThan(50);
  });

  it('fades blur to zero and multiplies opacity with the layer opacity', () => {
    const l = layer({ animator: animator({ stagger: 0, from: { blur: 10, opacity: 0 } }) });
    l.transform.opacity = { static: 0.5 };
    const mid = commands(l, 0.25)[0]!;
    expect(mid.blur).toBeCloseTo(5);
    expect(mid.opacity).toBeCloseTo(0.25);
    expect(commands(l, 1)[0]).toMatchObject({ blur: 0, opacity: 0.5 });
  });

  it('typewriter reveals one character per stagger step', () => {
    const typewriter = ANIMATOR_PRESETS.find((p) => p.id === 'typewriter')!.animator;
    const l = layer({ animator: typewriter });
    expect(opacities(l, 0)).toEqual([1, 0, 0, 0]);
    expect(opacities(l, 0.13)).toEqual([1, 1, 1, 0]);
  });
});

describe('presets', () => {
  it('ships the five built-in presets, all valid', () => {
    expect(ANIMATOR_PRESETS.map((p) => p.id)).toEqual(['fly-in-up', 'fade-in', 'scale-in', 'typewriter', 'blur-in']);
    for (const preset of ANIMATOR_PRESETS) {
      const project = createProject();
      project.composition.layers = [createTextLayer(project.composition, { animator: preset.animator })];
      expect(() => validateProject(JSON.parse(JSON.stringify(project)))).not.toThrow();
      const hidden = evaluate(project, 0, mono).commands.slice(1);
      expect(hidden.every((c) => c.opacity === 0)).toBe(true);
      const settled = evaluate(project, 3.9, mono).commands;
      expect(settled.every((c) => c.opacity === 1 && (c as TextCommand).blur === 0)).toBe(true);
    }
  });
});
