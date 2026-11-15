import type { Easing, TextAnimator } from './types';

export interface AnimatorPreset {
  id: string;
  name: string;
  animator: TextAnimator;
}

const EASE_OUT: Easing = { kind: 'bezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
const OVERSHOOT: Easing = { kind: 'bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 };

export const ANIMATOR_PRESETS: readonly AnimatorPreset[] = [
  {
    id: 'fly-in-up',
    name: 'Fly in up',
    animator: {
      unit: 'character',
      stagger: 0.04,
      order: 'forward',
      duration: 0.5,
      easing: OVERSHOOT,
      from: { position: { x: 0, y: 80 }, opacity: 0 },
    },
  },
  {
    id: 'fade-in',
    name: 'Fade in',
    animator: {
      unit: 'character',
      stagger: 0.03,
      order: 'forward',
      duration: 0.4,
      easing: EASE_OUT,
      from: { opacity: 0 },
    },
  },
  {
    id: 'scale-in',
    name: 'Scale in',
    animator: {
      unit: 'character',
      stagger: 0.04,
      order: 'forward',
      duration: 0.5,
      easing: OVERSHOOT,
      from: { scale: { x: 0, y: 0 }, opacity: 0 },
    },
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    animator: {
      unit: 'character',
      stagger: 0.06,
      order: 'forward',
      duration: 0,
      easing: { kind: 'linear' },
      from: { opacity: 0 },
    },
  },
  {
    id: 'blur-in',
    name: 'Blur in',
    animator: {
      unit: 'character',
      stagger: 0.03,
      order: 'forward',
      duration: 0.6,
      easing: EASE_OUT,
      from: { blur: 16, opacity: 0 },
    },
  },
];
