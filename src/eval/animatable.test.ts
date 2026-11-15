import { describe, expect, it } from 'vitest';
import type { Animatable, Vec2 } from '../model/types';
import { resolveNumber, resolveVec2 } from './animatable';

const linear = { kind: 'linear' } as const;
const hold = { kind: 'hold' } as const;

describe('resolve', () => {
  it('returns a static value at any time', () => {
    expect(resolveNumber({ static: 7 }, -5)).toBe(7);
    expect(resolveNumber({ static: 7 }, 100)).toBe(7);
  });

  it('interpolates linearly between keys', () => {
    const p: Animatable<number> = {
      keyframes: [
        { t: 1, value: 10, easing: linear },
        { t: 3, value: 30, easing: linear },
      ],
    };
    expect(resolveNumber(p, 1)).toBe(10);
    expect(resolveNumber(p, 1.5)).toBeCloseTo(15);
    expect(resolveNumber(p, 2)).toBeCloseTo(20);
    expect(resolveNumber(p, 3)).toBe(30);
  });

  it('clamps before the first and after the last key', () => {
    const p: Animatable<number> = {
      keyframes: [
        { t: 1, value: 10, easing: linear },
        { t: 3, value: 30, easing: linear },
      ],
    };
    expect(resolveNumber(p, 0)).toBe(10);
    expect(resolveNumber(p, -100)).toBe(10);
    expect(resolveNumber(p, 3.001)).toBe(30);
    expect(resolveNumber(p, 100)).toBe(30);
  });

  it('holds the outgoing key value until the next key', () => {
    const p: Animatable<number> = {
      keyframes: [
        { t: 0, value: 1, easing: hold },
        { t: 1, value: 2, easing: linear },
        { t: 2, value: 4, easing: hold },
      ],
    };
    expect(resolveNumber(p, 0.5)).toBe(1);
    expect(resolveNumber(p, 0.9999)).toBe(1);
    expect(resolveNumber(p, 1)).toBe(2);
    expect(resolveNumber(p, 1.5)).toBeCloseTo(3);
    expect(resolveNumber(p, 2)).toBe(4);
  });

  it('uses the easing of the outgoing key for each segment', () => {
    const p: Animatable<number> = {
      keyframes: [
        { t: 0, value: 0, easing: { kind: 'bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 } },
        { t: 1, value: 100, easing: linear },
        { t: 2, value: 200, easing: linear },
      ],
    };
    expect(resolveNumber(p, 0.5)).toBeCloseTo(31.54, 1);
    expect(resolveNumber(p, 1.5)).toBeCloseTo(150);
  });

  it('lets a bezier overshoot the target value', () => {
    const p: Animatable<number> = {
      keyframes: [
        { t: 0, value: 0, easing: { kind: 'bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } },
        { t: 1, value: 100, easing: linear },
      ],
    };
    expect(resolveNumber(p, 0.6)).toBeGreaterThan(100);
  });

  it('resolves a single keyframe to its value everywhere', () => {
    const p: Animatable<number> = { keyframes: [{ t: 2, value: 9, easing: linear }] };
    expect(resolveNumber(p, 0)).toBe(9);
    expect(resolveNumber(p, 2)).toBe(9);
    expect(resolveNumber(p, 5)).toBe(9);
  });

  it('interpolates vectors per component', () => {
    const p: Animatable<Vec2> = {
      keyframes: [
        { t: 0, value: { x: 0, y: 100 }, easing: linear },
        { t: 2, value: { x: 10, y: 0 }, easing: linear },
      ],
    };
    expect(resolveVec2(p, 0.5)).toEqual({ x: 2.5, y: 75 });
  });

  it('throws on an empty keyframe list', () => {
    expect(() => resolveNumber({ keyframes: [] }, 0)).toThrow();
  });
});
