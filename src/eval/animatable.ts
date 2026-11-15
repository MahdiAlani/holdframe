import type { Animatable, Time, Vec2 } from '../model/types';
import { ease } from './easing';

export type Lerp<T> = (a: T, b: T, u: number) => T;

export const lerpNumber: Lerp<number> = (a, b, u) => a + (b - a) * u;

export const lerpVec2: Lerp<Vec2> = (a, b, u) => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
});

// Keyframes must be sorted by t. Outside the keyed range the nearest key's value holds.
export function resolve<T>(prop: Animatable<T>, t: Time, lerp: Lerp<T>): T {
  if ('static' in prop) return prop.static;
  const keys = prop.keyframes;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) throw new Error('Animatable has no keyframes');
  if (t <= first.t) return first.value;
  if (t >= last.t) return last.value;
  let i = 0;
  while (keys[i + 1]!.t <= t) i++;
  const k0 = keys[i]!;
  const k1 = keys[i + 1]!;
  if (k0.easing.kind === 'hold') return k0.value;
  const u = (t - k0.t) / (k1.t - k0.t);
  return lerp(k0.value, k1.value, ease(k0.easing, u));
}

export const resolveNumber = (prop: Animatable<number>, t: Time): number => resolve(prop, t, lerpNumber);
export const resolveVec2 = (prop: Animatable<Vec2>, t: Time): Vec2 => resolve(prop, t, lerpVec2);
