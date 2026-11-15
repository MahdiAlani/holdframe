import { useRef, type PointerEvent } from 'react';
import { newId } from '../model/create';
import type { Layer, Time } from '../model/types';
import { keyframeTimes, moveKeyframesAt, replaceLayer, sameTime, useEditor } from '../store';
import { startDrag } from './drag';

function ticks(duration: Time): Time[] {
  const step = duration <= 10 ? 0.5 : duration <= 30 ? 1 : 5;
  const out: Time[] = [];
  for (let t = 0; t <= duration + 1e-9; t += step) out.push(Number(t.toFixed(3)));
  return out;
}

export function Timeline() {
  const comp = useEditor((s) => s.project.composition);
  const time = useEditor((s) => s.time);
  const selected = useEditor((s) => s.selectedLayerId);
  const inner = useRef<HTMLDivElement>(null);
  const pct = (t: Time): string => `${(t / comp.duration) * 100}%`;

  const timeAt = (clientX: number): Time => {
    const rect = inner.current!.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * comp.duration;
  };

  const scrub = (e: PointerEvent): void => {
    const { setTime, pause } = useEditor.getState();
    pause();
    setTime(timeAt(e.clientX));
    startDrag(e, (ev) => setTime(timeAt(ev.clientX)));
  };

  const dragKeyframe = (e: PointerEvent, layer: Layer, from: Time): void => {
    e.stopPropagation();
    const { execute, endGesture, selectLayer } = useEditor.getState();
    selectLayer(layer.id);
    if (layer.locked) return;
    const gesture = `move-keyframe-${newId()}`;
    let last = from;
    startDrag(
      e,
      (ev) => {
        const frame = Math.round(timeAt(ev.clientX) * comp.fps);
        const to = Math.min(comp.duration, Math.max(0, frame / comp.fps));
        if (sameTime(to, last)) return;
        last = to;
        execute(replaceLayer(layer, moveKeyframesAt(layer, from, to), 'Move keyframe'), gesture);
      },
      endGesture,
    );
  };

  return (
    <div className="timeline" data-testid="timeline">
      <div className="timeline-inner" ref={inner}>
        <div className="ruler" data-testid="ruler" onPointerDown={scrub}>
          {ticks(comp.duration).map((t) => (
            <span key={t} className={`tick${Number.isInteger(t) ? ' major' : ''}`} style={{ left: pct(t) }}>
              {Number.isInteger(t) ? <em>{t}s</em> : null}
            </span>
          ))}
        </div>
        {comp.layers.map((layer) => (
          <div
            key={layer.id}
            className={`track${layer.id === selected ? ' selected' : ''}`}
            data-testid="track"
            data-layer-id={layer.id}
            onPointerDown={() => useEditor.getState().selectLayer(layer.id)}
          >
            <div
              className={`bar ${layer.kind}`}
              style={{ left: pct(layer.inPoint), width: pct(Math.max(0, layer.outPoint - layer.inPoint)) }}
            />
            {keyframeTimes(layer).map((t, i) => (
              <button
                key={i}
                type="button"
                className="keyframe"
                data-testid="keyframe"
                data-time={t.toFixed(4)}
                title={`Keyframe at ${t.toFixed(2)}s`}
                style={{ left: pct(t) }}
                onPointerDown={(e) => dragKeyframe(e, layer, t)}
              />
            ))}
          </div>
        ))}
        <div className="playhead" data-testid="playhead" style={{ left: pct(time) }} onPointerDown={scrub} />
      </div>
    </div>
  );
}
