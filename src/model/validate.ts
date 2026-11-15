import type { Project } from './types';

export class ProjectValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ProjectValidationError';
  }
}

type Obj = Record<string, unknown>;
type Check = (v: unknown, path: string) => void;

function fail(path: string, message: string): never {
  throw new ProjectValidationError(path, message);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected an object');
  return v as Obj;
}

const num: Check = (v, path) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'expected a finite number');
};

const str: Check = (v, path) => {
  if (typeof v !== 'string') fail(path, 'expected a string');
};

const bool: Check = (v, path) => {
  if (typeof v !== 'boolean') fail(path, 'expected a boolean');
};

function positive(v: unknown, path: string): void {
  num(v, path);
  if ((v as number) <= 0) fail(path, 'expected a number greater than 0');
}

function nonNegative(v: unknown, path: string): void {
  num(v, path);
  if ((v as number) < 0) fail(path, 'expected a number of 0 or more');
}

function oneOf(values: readonly string[]): Check {
  return (v, path) => {
    if (typeof v !== 'string' || !values.includes(v)) {
      fail(path, `expected one of ${values.join(', ')}`);
    }
  };
}

const vec2: Check = (v, path) => {
  const o = obj(v, path);
  num(o.x, `${path}.x`);
  num(o.y, `${path}.y`);
};

const easing: Check = (v, path) => {
  const o = obj(v, path);
  oneOf(['hold', 'linear', 'bezier'])(o.kind, `${path}.kind`);
  if (o.kind === 'bezier') {
    for (const k of ['x1', 'y1', 'x2', 'y2']) num(o[k], `${path}.${k}`);
    for (const k of ['x1', 'x2']) {
      const x = o[k] as number;
      if (x < 0 || x > 1) fail(`${path}.${k}`, 'expected a number between 0 and 1');
    }
  }
};

function animatable(value: Check): Check {
  return (v, path) => {
    const o = obj(v, path);
    if ('static' in o) {
      value(o.static, `${path}.static`);
      return;
    }
    if (!Array.isArray(o.keyframes)) fail(path, 'expected { static } or { keyframes }');
    const keys = o.keyframes as unknown[];
    if (keys.length === 0) fail(`${path}.keyframes`, 'expected at least one keyframe');
    let prev = -Infinity;
    keys.forEach((k, i) => {
      const p = `${path}.keyframes[${i}]`;
      const key = obj(k, p);
      num(key.t, `${p}.t`);
      if ((key.t as number) <= prev) fail(`${p}.t`, 'keyframes must be in strictly increasing time order');
      prev = key.t as number;
      value(key.value, `${p}.value`);
      easing(key.easing, `${p}.easing`);
    });
  };
}

const transform: Check = (v, path) => {
  const o = obj(v, path);
  animatable(vec2)(o.anchor, `${path}.anchor`);
  animatable(vec2)(o.position, `${path}.position`);
  animatable(vec2)(o.scale, `${path}.scale`);
  animatable(num)(o.rotation, `${path}.rotation`);
  animatable(num)(o.opacity, `${path}.opacity`);
};

const animator: Check = (v, path) => {
  const o = obj(v, path);
  oneOf(['character', 'word', 'line'])(o.unit, `${path}.unit`);
  nonNegative(o.stagger, `${path}.stagger`);
  oneOf(['forward', 'reverse', 'random'])(o.order, `${path}.order`);
  nonNegative(o.duration, `${path}.duration`);
  easing(o.easing, `${path}.easing`);
  const from = obj(o.from, `${path}.from`);
  if (from.position !== undefined) vec2(from.position, `${path}.from.position`);
  if (from.scale !== undefined) vec2(from.scale, `${path}.from.scale`);
  if (from.rotation !== undefined) num(from.rotation, `${path}.from.rotation`);
  if (from.opacity !== undefined) num(from.opacity, `${path}.from.opacity`);
  if (from.blur !== undefined) nonNegative(from.blur, `${path}.from.blur`);
};

const layer: Check = (v, path) => {
  const o = obj(v, path);
  str(o.id, `${path}.id`);
  str(o.name, `${path}.name`);
  bool(o.visible, `${path}.visible`);
  bool(o.locked, `${path}.locked`);
  num(o.inPoint, `${path}.inPoint`);
  num(o.outPoint, `${path}.outPoint`);
  if ((o.outPoint as number) < (o.inPoint as number)) fail(`${path}.outPoint`, 'must not be before inPoint');
  transform(o.transform, `${path}.transform`);
  oneOf(['normal', 'multiply', 'screen', 'overlay', 'add'])(o.blendMode, `${path}.blendMode`);
  oneOf(['text', 'shape', 'image'])(o.kind, `${path}.kind`);
  if (o.kind === 'text') {
    str(o.text, `${path}.text`);
    str(o.fontFamily, `${path}.fontFamily`);
    positive(o.fontSize, `${path}.fontSize`);
    positive(o.fontWeight, `${path}.fontWeight`);
    str(o.fill, `${path}.fill`);
    oneOf(['left', 'center', 'right'])(o.align, `${path}.align`);
    positive(o.lineHeight, `${path}.lineHeight`);
    if (o.animator !== null) animator(o.animator, `${path}.animator`);
  } else if (o.kind === 'shape') {
    oneOf(['rect', 'ellipse'])(o.shape, `${path}.shape`);
    animatable(vec2)(o.size, `${path}.size`);
    if (o.fill !== null) str(o.fill, `${path}.fill`);
    if (o.stroke !== null) {
      const s = obj(o.stroke, `${path}.stroke`);
      str(s.colour, `${path}.stroke.colour`);
      nonNegative(s.width, `${path}.stroke.width`);
    }
    animatable(num)(o.cornerRadius, `${path}.cornerRadius`);
  } else {
    str(o.assetId, `${path}.assetId`);
    animatable(vec2)(o.size, `${path}.size`);
  }
};

export function validateProject(data: unknown): Project {
  const p = obj(data, 'project');
  if (p.version !== 1) fail('project.version', 'expected 1');
  const c = obj(p.composition, 'composition');
  positive(c.width, 'composition.width');
  positive(c.height, 'composition.height');
  positive(c.fps, 'composition.fps');
  positive(c.duration, 'composition.duration');
  if (c.background !== null) str(c.background, 'composition.background');
  if (!Array.isArray(c.layers)) fail('composition.layers', 'expected an array');
  const ids = new Set<string>();
  (c.layers as unknown[]).forEach((l, i) => {
    const path = `composition.layers[${i}]`;
    layer(l, path);
    const id = (l as Obj).id as string;
    if (ids.has(id)) fail(`${path}.id`, `duplicate layer id "${id}"`);
    ids.add(id);
  });
  return data as Project;
}
