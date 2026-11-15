import { useRef, type PointerEvent } from 'react';
import { newId } from '../model/create';
import type { Easing } from '../model/types';
import { useEditor } from '../store';
import { startDrag } from './drag';
import { SelectField } from './fields';

type Bezier = Extract<Easing, { kind: 'bezier' }>;

export const EASING_PRESETS: { name: string; easing: Bezier }[] = [
  { name: 'Ease', easing: { kind: 'bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
  { name: 'In', easing: { kind: 'bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 } },
  { name: 'Out', easing: { kind: 'bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 } },
  { name: 'In-out', easing: { kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
  { name: 'Overshoot', easing: { kind: 'bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } },
];

const SIZE = 180;
const PAD = 14;
const Y_MIN = -0.5;
const Y_MAX = 1.5;
const sx = (x: number): number => PAD + x * (SIZE - 2 * PAD);
const sy = (y: number): number => SIZE - PAD - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (SIZE - 2 * PAD);

interface Props {
  easing: Easing;
  onChange(easing: Easing, gesture?: string): void;
}

export function EasingEditor({ easing, onChange }: Props) {
  const svg = useRef<SVGSVGElement>(null);

  const dragHandle = (e: PointerEvent, which: 1 | 2): void => {
    if (easing.kind !== 'bezier') return;
    const gesture = `easing-${newId()}`;
    startDrag(
      e,
      (ev) => {
        const rect = svg.current!.getBoundingClientRect();
        const px = ((ev.clientX - rect.left) / rect.width) * SIZE;
        const py = ((ev.clientY - rect.top) / rect.height) * SIZE;
        const x = Math.min(1, Math.max(0, (px - PAD) / (SIZE - 2 * PAD)));
        const y = Math.min(Y_MAX, Math.max(Y_MIN, Y_MIN + ((SIZE - PAD - py) / (SIZE - 2 * PAD)) * (Y_MAX - Y_MIN)));
        const rx = Number(x.toFixed(2));
        const ry = Number(y.toFixed(2));
        onChange(which === 1 ? { ...easing, x1: rx, y1: ry } : { ...easing, x2: rx, y2: ry }, gesture);
      },
      () => useEditor.getState().endGesture(),
    );
  };

  return (
    <div className="easing" data-testid="easing-editor">
      <div className="easing-head">
        <span>Easing to next key</span>
        <SelectField
          testId="easing-kind"
          value={easing.kind}
          options={[
            { value: 'linear', label: 'Linear' },
            { value: 'hold', label: 'Hold' },
            { value: 'bezier', label: 'Bezier' },
          ]}
          onChange={(kind) =>
            onChange(kind === 'bezier' ? EASING_PRESETS[3]!.easing : { kind })
          }
        />
      </div>
      {easing.kind === 'bezier' ? (
        <>
          <svg ref={svg} viewBox={`0 0 ${SIZE} ${SIZE}`} className="bezier" data-testid="bezier">
            <rect x={sx(0)} y={sy(1)} width={sx(1) - sx(0)} height={sy(0) - sy(1)} className="bezier-box" />
            <line x1={sx(0)} y1={sy(0)} x2={sx(easing.x1)} y2={sy(easing.y1)} className="bezier-arm" />
            <line x1={sx(1)} y1={sy(1)} x2={sx(easing.x2)} y2={sy(easing.y2)} className="bezier-arm" />
            <path
              className="bezier-curve"
              d={`M ${sx(0)} ${sy(0)} C ${sx(easing.x1)} ${sy(easing.y1)}, ${sx(easing.x2)} ${sy(easing.y2)}, ${sx(1)} ${sy(1)}`}
            />
            <circle
              cx={sx(easing.x1)}
              cy={sy(easing.y1)}
              r={7}
              className="bezier-handle"
              data-testid="bezier-h1"
              onPointerDown={(e) => dragHandle(e, 1)}
            />
            <circle
              cx={sx(easing.x2)}
              cy={sy(easing.y2)}
              r={7}
              className="bezier-handle"
              data-testid="bezier-h2"
              onPointerDown={(e) => dragHandle(e, 2)}
            />
          </svg>
          <div className="easing-presets">
            {EASING_PRESETS.map((p) => (
              <button key={p.name} type="button" data-testid={`easing-preset-${p.name}`} onClick={() => onChange(p.easing)}>
                {p.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
