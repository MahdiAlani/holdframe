import type { Composition, Time } from '../model/types';

export function frameCount(comp: Pick<Composition, 'fps' | 'duration'>): number {
  return Math.max(1, Math.round(comp.duration * comp.fps));
}

// Snaps to a frame boundary within the composition. The last frame is one frame before `duration`.
export function snapTime(t: Time, comp: Pick<Composition, 'fps' | 'duration'>): Time {
  const frame = Math.min(frameCount(comp) - 1, Math.max(0, Math.round(t * comp.fps)));
  return frame / comp.fps;
}

// Playhead time after `elapsed` wall-clock seconds of playback. Derived from the
// clock rather than accumulated per tick, so it cannot drift. Loops at the end.
export function playbackTime(
  startTime: Time,
  elapsed: number,
  comp: Pick<Composition, 'fps' | 'duration'>,
): Time {
  const frames = frameCount(comp);
  const start = Math.round(startTime * comp.fps);
  const advanced = Math.floor(Math.max(0, elapsed) * comp.fps + 1e-9);
  return ((start + advanced) % frames) / comp.fps;
}
