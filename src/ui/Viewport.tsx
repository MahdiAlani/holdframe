import { useEffect, useRef } from 'react';
import { getImage, onAssetsChanged } from '../assets/registry';
import { evaluate } from '../eval';
import { createCanvas2DRenderer } from '../render';
import { useEditor } from '../store';

export function Viewport() {
  const ref = useRef<HTMLCanvasElement>(null);

  // Draws straight from the store subscription so a scrub repaints in the same frame.
  useEffect(() => {
    const renderer = createCanvas2DRenderer(ref.current!, getImage);
    const draw = (): void => {
      const { project, time } = useEditor.getState();
      renderer.render(evaluate(project, time));
    };
    draw();
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.project !== prev.project || s.time !== prev.time) draw();
    });
    const unsubscribeAssets = onAssetsChanged(draw);
    return () => {
      unsubscribe();
      unsubscribeAssets();
    };
  }, []);

  return (
    <div className="viewport">
      <canvas ref={ref} data-testid="viewport-canvas" />
    </div>
  );
}
