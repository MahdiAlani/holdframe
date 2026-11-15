import { describe, expect, it } from 'vitest';
import { cubicBezier, ease } from './easing';

describe('ease', () => {
  it('linear is the identity on 0..1', () => {
    expect(ease({ kind: 'linear' }, 0)).toBe(0);
    expect(ease({ kind: 'linear' }, 0.25)).toBe(0.25);
    expect(ease({ kind: 'linear' }, 1)).toBe(1);
  });

  it('hold stays at 0 until the end', () => {
    expect(ease({ kind: 'hold' }, 0)).toBe(0);
    expect(ease({ kind: 'hold' }, 0.999)).toBe(0);
    expect(ease({ kind: 'hold' }, 1)).toBe(1);
  });

  it('bezier hits its endpoints exactly', () => {
    const e = { kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 } as const;
    expect(ease(e, 0)).toBe(0);
    expect(ease(e, 1)).toBe(1);
  });
});

describe('cubicBezier', () => {
  it('with control points on the diagonal is linear', () => {
    for (const u of [0.1, 0.3, 0.5, 0.9]) {
      expect(cubicBezier(0.25, 0.25, 0.75, 0.75, u)).toBeCloseTo(u, 5);
    }
  });

  it('ease-in-out is symmetric about the midpoint', () => {
    expect(cubicBezier(0.42, 0, 0.58, 1, 0.5)).toBeCloseTo(0.5, 5);
    const a = cubicBezier(0.42, 0, 0.58, 1, 0.2);
    const b = cubicBezier(0.42, 0, 0.58, 1, 0.8);
    expect(a + b).toBeCloseTo(1, 5);
    expect(a).toBeLessThan(0.2);
  });

  it('matches known CSS ease-in and ease-out values', () => {
    expect(cubicBezier(0.42, 0, 1, 1, 0.5)).toBeCloseTo(0.3154, 3);
    expect(cubicBezier(0, 0, 0.58, 1, 0.5)).toBeCloseTo(0.6846, 3);
  });

  it('agrees with the parametric curve', () => {
    const [x1, y1, x2, y2] = [0.17, 0.67, 0.83, 0.67];
    for (const s of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95]) {
      const inv = 1 - s;
      const x = 3 * inv * inv * s * x1 + 3 * inv * s * s * x2 + s ** 3;
      const y = 3 * inv * inv * s * y1 + 3 * inv * s * s * y2 + s ** 3;
      expect(cubicBezier(x1, y1, x2, y2, x)).toBeCloseTo(y, 5);
    }
  });

  it('overshoots when y control points exceed 1', () => {
    let max = 0;
    for (let u = 0; u <= 1; u += 0.01) max = Math.max(max, cubicBezier(0.34, 1.56, 0.64, 1, u));
    expect(max).toBeGreaterThan(1.05);
  });

  it('is monotonic in x for steep curves', () => {
    let prev = -1;
    for (let u = 0; u <= 1; u += 0.02) {
      const y = cubicBezier(0, 0, 1, 1, u);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});
