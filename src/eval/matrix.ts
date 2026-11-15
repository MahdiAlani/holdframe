import type { Vec2 } from '../model/types';

// 2D affine in canvas order: x' = a*x + c*y + e, y' = b*x + d*y + f
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

// Result applies n first, then m.
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

// translate(position) * rotate(rotation) * scale(scale) * translate(-anchor)
export function transformMatrix(anchor: Vec2, position: Vec2, scale: Vec2, rotationDeg: number): Matrix {
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const a = cos * scale.x;
  const b = sin * scale.x;
  const c = 0 - sin * scale.y; // avoids -0 at zero rotation
  const d = cos * scale.y;
  return [a, b, c, d, position.x - (a * anchor.x + c * anchor.y), position.y - (b * anchor.x + d * anchor.y)];
}

export function applyToPoint(m: Matrix, p: Vec2): Vec2 {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export function invert(m: Matrix): Matrix | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}
