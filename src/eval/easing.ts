import type { Easing } from '../model/types';

function bez(p1: number, p2: number, s: number): number {
  const inv = 1 - s;
  return 3 * inv * inv * s * p1 + 3 * inv * s * s * p2 + s * s * s;
}

function bezSlope(p1: number, p2: number, s: number): number {
  const inv = 1 - s;
  return 3 * inv * inv * p1 + 6 * inv * s * (p2 - p1) + 3 * s * s * (1 - p2);
}

// CSS-style cubic bezier through (0,0) and (1,1). x1 and x2 must lie in 0..1.
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let s = u;
  for (let i = 0; i < 8; i++) {
    const err = bez(x1, x2, s) - u;
    if (Math.abs(err) < 1e-7) return bez(y1, y2, s);
    const slope = bezSlope(x1, x2, s);
    if (Math.abs(slope) < 1e-6) break;
    s -= err / slope;
  }
  let lo = 0;
  let hi = 1;
  s = u;
  for (let i = 0; i < 40; i++) {
    const x = bez(x1, x2, s);
    if (Math.abs(x - u) < 1e-7) break;
    if (x < u) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return bez(y1, y2, s);
}

// Maps linear progress u in 0..1 to eased progress. Bezier may overshoot 0..1.
export function ease(easing: Easing, u: number): number {
  switch (easing.kind) {
    case 'hold':
      return u >= 1 ? 1 : 0;
    case 'linear':
      return Math.min(1, Math.max(0, u));
    case 'bezier':
      return cubicBezier(easing.x1, easing.y1, easing.x2, easing.y2, u);
  }
}
