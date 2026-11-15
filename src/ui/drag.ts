import type { PointerEvent as ReactPointerEvent } from 'react';

// Tracks a pointer drag on window so it survives the source element re-rendering.
export function startDrag(
  e: ReactPointerEvent,
  onMove: (ev: PointerEvent) => void,
  onEnd?: () => void,
): void {
  e.preventDefault();
  const up = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    onEnd?.();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
