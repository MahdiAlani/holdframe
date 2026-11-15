import { ANIMATOR_PRESETS } from '../model/presets';
import type { TextAnimator, TextLayer, Vec2 } from '../model/types';
import { updateLayer } from './actions';
import { EasingEditor } from './EasingEditor';
import { NumberField, Row, Section, SelectField } from './fields';

interface From {
  position: Vec2;
  scale: Vec2;
  rotation: number;
  opacity: number;
  blur: number;
}

function expand(from: TextAnimator['from']): From {
  return {
    position: from.position ?? { x: 0, y: 0 },
    scale: from.scale ?? { x: 1, y: 1 },
    rotation: from.rotation ?? 0,
    opacity: from.opacity ?? 1,
    blur: from.blur ?? 0,
  };
}

// Values equal to the resting pose are left out of `from`.
function compact(v: From): TextAnimator['from'] {
  const from: TextAnimator['from'] = {};
  if (v.position.x !== 0 || v.position.y !== 0) from.position = v.position;
  if (v.scale.x !== 1 || v.scale.y !== 1) from.scale = v.scale;
  if (v.rotation !== 0) from.rotation = v.rotation;
  if (v.opacity !== 1) from.opacity = v.opacity;
  if (v.blur !== 0) from.blur = v.blur;
  return from;
}

export function AnimatorSection({ layer }: { layer: TextLayer }) {
  const animator = layer.animator;
  const setAnimator = (next: TextAnimator | null, label: string, g?: string): void =>
    updateLayer(layer, { ...layer, animator: next }, label, g);

  const presets = (
    <div className="presets">
      {ANIMATOR_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          data-testid={`preset-${preset.id}`}
          onClick={() => setAnimator(preset.animator, `Apply ${preset.name}`)}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );

  if (!animator) {
    return (
      <Section title="Text animator">
        <p className="hint">Animate each character, word or line with a delay between them. Start from a preset:</p>
        {presets}
      </Section>
    );
  }

  const set = (patch: Partial<TextAnimator>, g?: string): void => setAnimator({ ...animator, ...patch }, 'Edit animator', g);
  const from = expand(animator.from);
  const setFrom = (patch: Partial<From>, g?: string): void => set({ from: compact({ ...from, ...patch }) }, g);

  return (
    <Section title="Text animator">
      {presets}
      <Row label="Animate by">
        <SelectField
          testId="animator-unit"
          value={animator.unit}
          options={['character', 'word', 'line'] as const}
          onChange={(unit) => set({ unit })}
        />
      </Row>
      <Row label="Order">
        <SelectField
          testId="animator-order"
          value={animator.order}
          options={['forward', 'reverse', 'random'] as const}
          onChange={(order) => set({ order })}
        />
      </Row>
      <Row label="Stagger">
        <NumberField testId="animator-stagger" min={0} step={0.01} value={animator.stagger} onChange={(stagger, g) => set({ stagger }, g)} />
      </Row>
      <Row label="Duration">
        <NumberField testId="animator-duration" min={0} step={0.05} value={animator.duration} onChange={(duration, g) => set({ duration }, g)} />
      </Row>
      <h4>Start from</h4>
      <Row label="Offset">
        <NumberField label="X" testId="animator-from-x" value={from.position.x} onChange={(x, g) => setFrom({ position: { ...from.position, x } }, g)} />
        <NumberField label="Y" testId="animator-from-y" value={from.position.y} onChange={(y, g) => setFrom({ position: { ...from.position, y } }, g)} />
      </Row>
      <Row label="Scale">
        <NumberField label="X" testId="animator-from-scale-x" step={0.05} value={from.scale.x} onChange={(x, g) => setFrom({ scale: { ...from.scale, x } }, g)} />
        <NumberField label="Y" testId="animator-from-scale-y" step={0.05} value={from.scale.y} onChange={(y, g) => setFrom({ scale: { ...from.scale, y } }, g)} />
      </Row>
      <Row label="Rotation">
        <NumberField testId="animator-from-rotation" value={from.rotation} onChange={(rotation, g) => setFrom({ rotation }, g)} />
      </Row>
      <Row label="Opacity">
        <NumberField testId="animator-from-opacity" min={0} max={1} step={0.05} value={from.opacity} onChange={(opacity, g) => setFrom({ opacity }, g)} />
      </Row>
      <Row label="Blur">
        <NumberField testId="animator-from-blur" min={0} value={from.blur} onChange={(blur, g) => setFrom({ blur }, g)} />
      </Row>
      <EasingEditor easing={animator.easing} onChange={(easing, g) => set({ easing }, g)} label="Easing per unit" />
      <button type="button" data-testid="animator-remove" onClick={() => setAnimator(null, 'Remove animator')}>
        Remove animator
      </button>
    </Section>
  );
}
