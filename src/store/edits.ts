import { lerpNumber, lerpVec2, resolve } from '../eval/animatable';
import type { Animatable, Easing, Keyframe, Layer, Time, Transform, Vec2 } from '../model/types';

export type PropValue = number | Vec2;
export type AnyAnimatable = Animatable<PropValue>;
export type PropPath =
  | 'transform.anchor'
  | 'transform.position'
  | 'transform.scale'
  | 'transform.rotation'
  | 'transform.opacity'
  | 'size'
  | 'cornerRadius';

const LINEAR: Easing = { kind: 'linear' };

export const sameTime = (a: Time, b: Time): boolean => Math.abs(a - b) < 1e-6;

const lerpAny = (a: PropValue, b: PropValue, u: number): PropValue =>
  typeof a === 'number' ? lerpNumber(a, b as number, u) : lerpVec2(a, b as Vec2, u);

export const valueAt = (prop: AnyAnimatable, t: Time): PropValue => resolve(prop, t, lerpAny);

export function propPaths(layer: Layer): PropPath[] {
  const paths: PropPath[] = [
    'transform.position',
    'transform.scale',
    'transform.rotation',
    'transform.opacity',
    'transform.anchor',
  ];
  if (layer.kind !== 'text') paths.push('size');
  if (layer.kind === 'shape' && layer.shape === 'rect') paths.push('cornerRadius');
  return paths;
}

export function getProp(layer: Layer, path: PropPath): AnyAnimatable | undefined {
  if (path.startsWith('transform.')) return layer.transform[path.slice(10) as keyof Transform];
  if (path === 'size') return layer.kind === 'text' ? undefined : layer.size;
  return layer.kind === 'shape' ? layer.cornerRadius : undefined;
}

export function setProp<L extends Layer>(layer: L, path: PropPath, value: AnyAnimatable): L {
  if (path.startsWith('transform.')) {
    return { ...layer, transform: { ...layer.transform, [path.slice(10)]: value } };
  }
  return { ...layer, [path]: value };
}

function upsert(keys: Keyframe<PropValue>[], key: Keyframe<PropValue>): Keyframe<PropValue>[] {
  return [...keys.filter((k) => !sameTime(k.t, key.t)), key].sort((a, b) => a.t - b.t);
}

export function keyframeAt(prop: AnyAnimatable, t: Time): Keyframe<PropValue> | undefined {
  return 'keyframes' in prop ? prop.keyframes.find((k) => sameTime(k.t, t)) : undefined;
}

// Sorted, de-duplicated keyframe times across every animated property of the layer.
export function keyframeTimes(layer: Layer): Time[] {
  const times: Time[] = [];
  for (const path of propPaths(layer)) {
    const prop = getProp(layer, path);
    if (!prop || !('keyframes' in prop)) continue;
    for (const k of prop.keyframes) {
      if (!times.some((t) => sameTime(t, k.t))) times.push(k.t);
    }
  }
  return times.sort((a, b) => a - b);
}

// Moves every keyframe at `from` to `to`. A key already at `to` is replaced.
export function moveKeyframesAt<L extends Layer>(layer: L, from: Time, to: Time): L {
  let next = layer;
  for (const path of propPaths(layer)) {
    const prop = getProp(layer, path);
    if (!prop || !('keyframes' in prop)) continue;
    const moving = prop.keyframes.find((k) => sameTime(k.t, from));
    if (!moving) continue;
    const rest = prop.keyframes.filter((k) => k !== moving);
    next = setProp(next, path, { keyframes: upsert(rest, { ...moving, t: to }) });
  }
  return next;
}

// Static properties are overwritten; keyframed ones get a key at t.
export function setPropValue<L extends Layer>(layer: L, path: PropPath, t: Time, value: PropValue): L {
  const prop = getProp(layer, path);
  if (!prop) return layer;
  if ('static' in prop) return setProp(layer, path, { static: value });
  const existing = keyframeAt(prop, t);
  const before = prop.keyframes.filter((k) => k.t < t).pop();
  const easing = existing?.easing ?? before?.easing ?? LINEAR;
  return setProp(layer, path, { keyframes: upsert(prop.keyframes, { t, value, easing }) });
}

export function addKeyframe<L extends Layer>(layer: L, path: PropPath, t: Time): L {
  const prop = getProp(layer, path);
  if (!prop) return layer;
  if ('static' in prop) {
    return setProp(layer, path, { keyframes: [{ t, value: prop.static, easing: LINEAR }] });
  }
  if (keyframeAt(prop, t)) return layer;
  return setPropValue(layer, path, t, valueAt(prop, t));
}

// Removing the last keyframe leaves a static property holding that key's value.
export function removeKeyframe<L extends Layer>(layer: L, path: PropPath, t: Time): L {
  const prop = getProp(layer, path);
  if (!prop || !('keyframes' in prop)) return layer;
  const removed = keyframeAt(prop, t);
  if (!removed) return layer;
  const keyframes = prop.keyframes.filter((k) => k !== removed);
  return setProp(layer, path, keyframes.length > 0 ? { keyframes } : { static: removed.value });
}

export function removeKeyframesAt<L extends Layer>(layer: L, t: Time): L {
  return propPaths(layer).reduce((l, path) => removeKeyframe(l, path, t), layer);
}

export function clearKeyframes<L extends Layer>(layer: L, path: PropPath, t: Time): L {
  const prop = getProp(layer, path);
  if (!prop || 'static' in prop) return layer;
  return setProp(layer, path, { static: valueAt(prop, t) });
}

export function setKeyframeEasing<L extends Layer>(layer: L, path: PropPath, t: Time, easing: Easing): L {
  const prop = getProp(layer, path);
  if (!prop || !('keyframes' in prop)) return layer;
  return setProp(layer, path, {
    keyframes: prop.keyframes.map((k) => (sameTime(k.t, t) ? { ...k, easing } : k)),
  });
}
