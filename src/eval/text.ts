import type { TextAnimator, TextLayer, Time } from '../model/types';
import { ease } from './easing';
import { multiply, transformMatrix, type Matrix } from './matrix';
import type { TextCommand } from './renderTree';

export interface FontSpec {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}

// Width of `text` in px. Injected so evaluation stays free of the DOM.
export type MeasureText = (text: string, font: FontSpec) => number;

export const approximateMeasure: MeasureText = (text, font) => Array.from(text).length * font.fontSize * 0.6;

export interface TextUnit {
  text: string;
  x: number; // left edge, relative to the layer origin
  y: number; // baseline
  width: number;
}

type LayoutInput = Pick<TextLayer, 'text' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'align' | 'lineHeight'>;

// Splits text into animation units in reading order. Whitespace is never a unit.
export function layoutUnits(layer: LayoutInput, unit: TextAnimator['unit'], measure: MeasureText): TextUnit[] {
  const units: TextUnit[] = [];
  layer.text.split('\n').forEach((line, row) => {
    const lineWidth = measure(line, layer);
    const startX = layer.align === 'left' ? 0 : layer.align === 'center' ? -lineWidth / 2 : -lineWidth;
    const y = row * layer.fontSize * layer.lineHeight;
    const push = (text: string, offset: number): void => {
      units.push({ text, x: startX + measure(line.slice(0, offset), layer), y, width: measure(text, layer) });
    };
    if (unit === 'line') {
      if (line.trim() !== '') push(line, 0);
      return;
    }
    for (const match of line.matchAll(unit === 'word' ? /\S+/g : /\S/gu)) push(match[0], match.index ?? 0);
  });
  return units;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// rank[i] is the position of unit i in the animation order. Random is stable per seed.
export function unitRanks(count: number, order: TextAnimator['order'], seed: string): number[] {
  if (order === 'forward') return Array.from({ length: count }, (_, i) => i);
  if (order === 'reverse') return Array.from({ length: count }, (_, i) => count - 1 - i);
  const sequence = Array.from({ length: count }, (_, i) => i);
  let state = hash(seed) || 1;
  const random = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [sequence[i], sequence[j]] = [sequence[j]!, sequence[i]!];
  }
  const ranks = new Array<number>(count);
  sequence.forEach((unitIndex, rank) => {
    ranks[unitIndex] = rank;
  });
  return ranks;
}

// Eased progress of one unit, `localTime` seconds after the layer's in point.
export function unitProgress(animator: TextAnimator, rank: number, localTime: Time): number {
  const elapsed = localTime - rank * animator.stagger;
  if (animator.duration <= 0) return elapsed >= 0 ? 1 : 0;
  return ease(animator.easing, Math.min(1, Math.max(0, elapsed / animator.duration)));
}

// Seconds from the in point until the last unit has settled.
export function animatorLength(animator: TextAnimator, unitCount: number): Time {
  return Math.max(0, unitCount - 1) * animator.stagger + animator.duration;
}

type Base = Pick<TextCommand, 'layerId' | 'matrix' | 'opacity' | 'blendMode'>;

export function animateText(
  layer: TextLayer,
  animator: TextAnimator,
  base: Base,
  t: Time,
  measure: MeasureText,
): TextCommand[] {
  const units = layoutUnits(layer, animator.unit, measure);
  const ranks = unitRanks(units.length, animator.order, layer.id);
  const from = animator.from;
  return units.map((unit, i) => {
    const e = unitProgress(animator, ranks[i]!, t - layer.inPoint);
    const rest = 1 - e;
    const centre = { x: unit.x + unit.width / 2, y: unit.y - layer.fontSize * 0.35 };
    const local = transformMatrix(
      centre,
      { x: centre.x + (from.position?.x ?? 0) * rest, y: centre.y + (from.position?.y ?? 0) * rest },
      { x: 1 + ((from.scale?.x ?? 1) - 1) * rest, y: 1 + ((from.scale?.y ?? 1) - 1) * rest },
      (from.rotation ?? 0) * rest,
    );
    const place: Matrix = [1, 0, 0, 1, unit.x, unit.y];
    const opacity = Math.min(1, Math.max(0, 1 + ((from.opacity ?? 1) - 1) * rest));
    return {
      kind: 'text',
      layerId: base.layerId,
      blendMode: base.blendMode,
      matrix: multiply(base.matrix, multiply(local, place)),
      opacity: base.opacity * opacity,
      text: unit.text,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      fill: layer.fill,
      align: 'left',
      lineHeight: layer.lineHeight,
      blur: Math.max(0, (from.blur ?? 0) * rest),
    };
  });
}
