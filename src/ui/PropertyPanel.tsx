import { useState } from 'react';
import { addImageAsset } from '../assets/registry';
import type { BlendMode, Layer, ShapeLayer, TextLayer } from '../model/types';
import {
  addKeyframe,
  clearKeyframes,
  getProp,
  keyframeAt,
  removeKeyframe,
  selectedLayer,
  setComposition,
  setKeyframeEasing,
  setPropValue,
  useEditor,
  valueAt,
  type CompositionSettings,
  type PropPath,
  type PropValue,
} from '../store';
import { updateLayer } from './actions';
import { AnimatorSection } from './AnimatorSection';
import { EasingEditor } from './EasingEditor';
import { CheckField, ColourField, NumberField, Row, Section, SelectField, TextField } from './fields';

const BLEND_MODES: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'add'];
const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
const FONTS = [
  'Inter, system-ui, sans-serif',
  'Arial, sans-serif',
  'Georgia, serif',
  'Impact, sans-serif',
  'Courier New, monospace',
  'Times New Roman, serif',
  'Verdana, sans-serif',
];

function CompositionPanel() {
  const comp = useEditor((s) => s.project.composition);
  const { layers: _layers, ...settings } = comp;
  const set = (patch: Partial<CompositionSettings>, gesture?: string): void => {
    useEditor.getState().execute(setComposition(settings, { ...settings, ...patch }), gesture);
  };
  return (
    <Section title="Composition">
      <Row label="Size">
        <NumberField label="W" testId="comp-width" min={1} value={comp.width} onChange={(width, g) => set({ width }, g)} />
        <NumberField label="H" testId="comp-height" min={1} value={comp.height} onChange={(height, g) => set({ height }, g)} />
      </Row>
      <Row label="Frame rate">
        <NumberField testId="comp-fps" min={1} max={120} value={comp.fps} onChange={(fps, g) => set({ fps }, g)} />
      </Row>
      <Row label="Duration">
        <NumberField
          testId="comp-duration"
          min={0.1}
          step={0.1}
          value={comp.duration}
          onChange={(duration, g) => set({ duration }, g)}
        />
      </Row>
      <Row label="Background">
        {comp.background !== null ? (
          <ColourField testId="comp-background" value={comp.background} onChange={(background, g) => set({ background }, g)} />
        ) : null}
        <CheckField
          label="Transparent"
          testId="comp-transparent"
          checked={comp.background === null}
          onChange={(on) => set({ background: on ? null : '#111111' })}
        />
      </Row>
    </Section>
  );
}

interface AnimRowProps {
  layer: Layer;
  path: PropPath;
  label: string;
  step?: number;
  min?: number;
  max?: number;
  open: boolean;
  onToggleEasing(): void;
}

function AnimRow({ layer, path, label, step, min, max, open, onToggleEasing }: AnimRowProps) {
  const time = useEditor((s) => s.time);
  const prop = getProp(layer, path);
  if (!prop) return null;
  const animated = 'keyframes' in prop;
  const value = valueAt(prop, time);
  const key = keyframeAt(prop, time);
  const times = animated ? prop.keyframes.map((k) => k.t) : [];
  const prev = times.filter((t) => t < time - 1e-6).pop();
  const next = times.find((t) => t > time + 1e-6);
  const { setTime } = useEditor.getState();
  const set = (v: PropValue, g?: string): void =>
    updateLayer(layer, setPropValue(layer, path, time, v), `Edit ${label.toLowerCase()}`, g);
  const number = { step, min, max };

  return (
    <div className="anim" data-prop={path}>
      <div className="anim-row">
        <button
          type="button"
          className={`icon${animated ? ' active' : ''}`}
          data-testid={`stopwatch-${path}`}
          title={animated ? 'Remove all keyframes' : 'Animate this property'}
          aria-pressed={animated}
          onClick={() =>
            updateLayer(
              layer,
              animated ? clearKeyframes(layer, path, time) : addKeyframe(layer, path, time),
              animated ? 'Remove animation' : 'Add keyframe',
            )
          }
        >
          ◷
        </button>
        <span className="row-label">{label}</span>
        <div className="row-fields">
          {typeof value === 'number' ? (
            <NumberField {...number} testId={`prop-${path}`} value={value} onChange={set} />
          ) : (
            <>
              <NumberField {...number} label="X" testId={`prop-${path}-x`} value={value.x} onChange={(x, g) => set({ ...value, x }, g)} />
              <NumberField {...number} label="Y" testId={`prop-${path}-y`} value={value.y} onChange={(y, g) => set({ ...value, y }, g)} />
            </>
          )}
        </div>
      </div>
      {animated ? (
        <div className="key-nav">
          <button
            type="button"
            className="icon"
            data-testid={`key-prev-${path}`}
            title="Previous keyframe"
            disabled={prev === undefined}
            onClick={() => prev !== undefined && setTime(prev)}
          >
            ◀
          </button>
          <button
            type="button"
            className={`icon${key ? ' active' : ''}`}
            data-testid={`key-toggle-${path}`}
            title={key ? 'Remove keyframe here' : 'Add keyframe here'}
            aria-pressed={key !== undefined}
            onClick={() =>
              updateLayer(
                layer,
                key ? removeKeyframe(layer, path, time) : addKeyframe(layer, path, time),
                key ? 'Remove keyframe' : 'Add keyframe',
              )
            }
          >
            ◆
          </button>
          <button
            type="button"
            className="icon"
            data-testid={`key-next-${path}`}
            title="Next keyframe"
            disabled={next === undefined}
            onClick={() => next !== undefined && setTime(next)}
          >
            ▶
          </button>
          <button
            type="button"
            className={open && key ? 'active' : ''}
            data-testid={`easing-toggle-${path}`}
            disabled={!key}
            title={key ? 'Edit the easing out of this keyframe' : 'Move to a keyframe to edit its easing'}
            onClick={onToggleEasing}
          >
            Easing
          </button>
          <span className="key-count">
            {times.length} key{times.length === 1 ? '' : 's'}
          </span>
        </div>
      ) : null}
      {open && key ? (
        <EasingEditor
          easing={key.easing}
          onChange={(easing, g) => updateLayer(layer, setKeyframeEasing(layer, path, time, easing), 'Edit easing', g)}
        />
      ) : null}
    </div>
  );
}

function TextSection({ layer }: { layer: TextLayer }) {
  const set = (patch: Partial<TextLayer>, g?: string): void => updateLayer(layer, { ...layer, ...patch }, 'Edit text', g);
  return (
    <Section title="Text">
      <Row label="Content">
        <TextField multiline testId="text-content" value={layer.text} onChange={(text, g) => set({ text }, g)} />
      </Row>
      <Row label="Font">
        <TextField list="font-families" testId="text-font" value={layer.fontFamily} onChange={(fontFamily, g) => set({ fontFamily }, g)} />
        <datalist id="font-families">
          {FONTS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </Row>
      <Row label="Size">
        <NumberField testId="text-size" min={1} value={layer.fontSize} onChange={(fontSize, g) => set({ fontSize }, g)} />
      </Row>
      <Row label="Weight">
        <SelectField testId="text-weight" value={String(layer.fontWeight)} options={WEIGHTS} onChange={(w) => set({ fontWeight: Number(w) })} />
      </Row>
      <Row label="Fill">
        <ColourField testId="text-fill" value={layer.fill} onChange={(fill, g) => set({ fill }, g)} />
      </Row>
      <Row label="Align">
        <SelectField testId="text-align" value={layer.align} options={['left', 'center', 'right'] as const} onChange={(align) => set({ align })} />
      </Row>
      <Row label="Line height">
        <NumberField testId="text-line-height" min={0.1} step={0.05} value={layer.lineHeight} onChange={(lineHeight, g) => set({ lineHeight }, g)} />
      </Row>
    </Section>
  );
}

function ShapeSection({ layer }: { layer: ShapeLayer }) {
  const set = (patch: Partial<ShapeLayer>, g?: string): void => updateLayer(layer, { ...layer, ...patch }, 'Edit shape', g);
  return (
    <Section title="Shape">
      <Row label="Shape">
        <SelectField testId="shape-kind" value={layer.shape} options={['rect', 'ellipse'] as const} onChange={(shape) => set({ shape })} />
      </Row>
      <Row label="Fill">
        {layer.fill !== null ? <ColourField testId="shape-fill" value={layer.fill} onChange={(fill, g) => set({ fill }, g)} /> : null}
        <CheckField label="None" testId="shape-fill-none" checked={layer.fill === null} onChange={(none) => set({ fill: none ? null : '#4f8cff' })} />
      </Row>
      <Row label="Stroke">
        <CheckField
          label="On"
          testId="shape-stroke-on"
          checked={layer.stroke !== null}
          onChange={(on) => set({ stroke: on ? { colour: '#ffffff', width: 4 } : null })}
        />
        {layer.stroke !== null ? (
          <>
            <ColourField
              testId="shape-stroke-colour"
              value={layer.stroke.colour}
              onChange={(colour, g) => set({ stroke: { ...layer.stroke!, colour } }, g)}
            />
            <NumberField
              testId="shape-stroke-width"
              min={0}
              value={layer.stroke.width}
              onChange={(width, g) => set({ stroke: { ...layer.stroke!, width } }, g)}
            />
          </>
        ) : null}
      </Row>
    </Section>
  );
}

function LayerPanel({ layer }: { layer: Layer }) {
  const duration = useEditor((s) => s.project.composition.duration);
  const [easingFor, setEasingFor] = useState<PropPath | null>(null);
  const set = (patch: Partial<Layer>, label: string, g?: string): void =>
    updateLayer(layer, { ...layer, ...patch } as Layer, label, g);
  const anim = (path: PropPath, label: string, rest: { step?: number; min?: number; max?: number } = {}) => (
    <AnimRow
      layer={layer}
      path={path}
      label={label}
      {...rest}
      open={easingFor === path}
      onToggleEasing={() => setEasingFor(easingFor === path ? null : path)}
    />
  );

  return (
    <>
      <Section title="Layer">
        <Row label="Name">
          <TextField testId="layer-name" value={layer.name} onChange={(name, g) => set({ name }, 'Rename layer', g)} />
        </Row>
        <Row label="In / out">
          <NumberField
            testId="layer-in"
            step={0.1}
            min={0}
            max={layer.outPoint}
            value={layer.inPoint}
            onChange={(inPoint, g) => set({ inPoint }, 'Edit in point', g)}
          />
          <NumberField
            testId="layer-out"
            step={0.1}
            min={layer.inPoint}
            max={duration}
            value={layer.outPoint}
            onChange={(outPoint, g) => set({ outPoint }, 'Edit out point', g)}
          />
        </Row>
        <Row label="Blend">
          <SelectField testId="layer-blend" value={layer.blendMode} options={BLEND_MODES} onChange={(blendMode) => set({ blendMode }, 'Edit blend mode')} />
        </Row>
        <Row label="State">
          <CheckField label="Visible" testId="layer-visible" checked={layer.visible} onChange={(visible) => set({ visible }, 'Toggle visibility')} />
          <CheckField label="Locked" testId="layer-locked" checked={layer.locked} onChange={(locked) => set({ locked }, 'Toggle lock')} />
        </Row>
      </Section>
      <fieldset className="lockable" disabled={layer.locked}>
        <Section title="Transform">
          {anim('transform.position', 'Position')}
          {anim('transform.scale', 'Scale', { step: 0.05 })}
          {anim('transform.rotation', 'Rotation')}
          {anim('transform.opacity', 'Opacity', { step: 0.05, min: 0, max: 1 })}
          {anim('transform.anchor', 'Anchor')}
        </Section>
        {layer.kind === 'text' ? (
          <>
            <TextSection layer={layer} />
            <AnimatorSection layer={layer} />
          </>
        ) : null}
        {layer.kind === 'shape' ? (
          <>
            <ShapeSection layer={layer} />
            <Section title="Geometry">
              {anim('size', 'Size', { min: 0 })}
              {layer.shape === 'rect' ? anim('cornerRadius', 'Radius', { min: 0 }) : null}
            </Section>
          </>
        ) : null}
        {layer.kind === 'image' ? (
          <Section title="Image">
            {anim('size', 'Size', { min: 0 })}
            <Row label="Source">
              <label className="file-button">
                Replace image
                <input
                  type="file"
                  accept="image/*"
                  data-testid="image-replace"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    const asset = await addImageAsset(file);
                    set({ assetId: asset.id }, 'Replace image');
                  }}
                />
              </label>
            </Row>
          </Section>
        ) : null}
      </fieldset>
    </>
  );
}

export function PropertyPanel() {
  const layer = useEditor(selectedLayer);
  return (
    <aside className="panel" data-testid="property-panel">
      {layer ? <LayerPanel key={layer.id} layer={layer} /> : <CompositionPanel />}
    </aside>
  );
}
