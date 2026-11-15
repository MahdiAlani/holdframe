export type Time = number; // seconds
export type Vec2 = { x: number; y: number };

export interface Project {
  version: 1;
  composition: Composition;
}

export interface Composition {
  width: number;
  height: number;
  fps: number;
  duration: Time;
  background: string | null;
  layers: Layer[]; // index 0 renders on top
}

export type Easing =
  | { kind: 'hold' }
  | { kind: 'linear' }
  | { kind: 'bezier'; x1: number; y1: number; x2: number; y2: number };

export interface Keyframe<T> {
  t: Time;
  value: T;
  easing: Easing; // easing out of this key
}

export type Animatable<T> = { static: T } | { keyframes: Keyframe<T>[] };

export interface Transform {
  anchor: Animatable<Vec2>;
  position: Animatable<Vec2>;
  scale: Animatable<Vec2>; // 1 = 100%
  rotation: Animatable<number>; // degrees
  opacity: Animatable<number>; // 0..1
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';

export interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  inPoint: Time;
  outPoint: Time;
  transform: Transform;
  blendMode: BlendMode;
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  animator: TextAnimator | null;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shape: 'rect' | 'ellipse';
  size: Animatable<Vec2>;
  fill: string | null;
  stroke: { colour: string; width: number } | null;
  cornerRadius: Animatable<number>; // rect only
}

export interface ImageLayer extends LayerBase {
  kind: 'image';
  assetId: string;
  size: Animatable<Vec2>;
}

export type Layer = TextLayer | ShapeLayer | ImageLayer;

export interface TextAnimator {
  unit: 'character' | 'word' | 'line';
  stagger: Time;
  order: 'forward' | 'reverse' | 'random';
  duration: Time;
  easing: Easing;
  from: Partial<{
    position: Vec2;
    scale: Vec2;
    rotation: number;
    opacity: number;
    blur: number;
  }>;
}

export const CURRENT_VERSION = 1;
