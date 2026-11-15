import { useMemo, useRef, useState, type ReactNode } from 'react';
import { newId } from '../model/create';
import { useEditor } from '../store';

// One gesture per focus session, so typing in a field is a single undo entry.
export function useGesture() {
  const ref = useRef<string | undefined>(undefined);
  return useMemo(
    () => ({
      start: () => {
        ref.current = newId();
      },
      end: () => {
        ref.current = undefined;
        useEditor.getState().endGesture();
      },
      id: () => ref.current,
    }),
    [],
  );
}

const display = (v: number): string => String(Number(v.toFixed(4)));

interface NumberFieldProps {
  value: number;
  onChange(value: number, gesture?: string): void;
  label?: string;
  step?: number;
  min?: number;
  max?: number;
  testId?: string;
}

export function NumberField({ value, onChange, label, step = 1, min, max, testId }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const gesture = useGesture();
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <input
        type="number"
        data-testid={testId}
        step={step}
        min={min}
        max={max}
        value={draft ?? display(value)}
        onFocus={() => {
          gesture.start();
          setDraft(display(value));
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = e.target.valueAsNumber;
          if (!Number.isFinite(v)) return;
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)), gesture.id());
        }}
        onBlur={() => {
          setDraft(null);
          gesture.end();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

interface TextFieldProps {
  value: string;
  onChange(value: string, gesture?: string): void;
  testId?: string;
  multiline?: boolean;
  list?: string;
}

export function TextField({ value, onChange, testId, multiline, list }: TextFieldProps) {
  const gesture = useGesture();
  const common = {
    value,
    'data-testid': testId,
    spellCheck: false,
    onFocus: gesture.start,
    onBlur: gesture.end,
  };
  return multiline ? (
    <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value, gesture.id())} />
  ) : (
    <input {...common} type="text" list={list} onChange={(e) => onChange(e.target.value, gesture.id())} />
  );
}

interface ColourFieldProps {
  value: string;
  onChange(value: string, gesture?: string): void;
  testId?: string;
}

export function ColourField({ value, onChange, testId }: ColourFieldProps) {
  const gesture = useGesture();
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <span className="field colour">
      <input
        type="color"
        value={hex}
        data-testid={testId ? `${testId}-swatch` : undefined}
        onFocus={gesture.start}
        onBlur={gesture.end}
        onChange={(e) => onChange(e.target.value, gesture.id())}
      />
      <TextField value={value} onChange={onChange} testId={testId} />
    </span>
  );
}

interface SelectFieldProps<T extends string> {
  value: T;
  options: readonly (T | { value: T; label: string })[];
  onChange(value: T): void;
  testId?: string;
}

export function SelectField<T extends string>({ value, options, onChange, testId }: SelectFieldProps<T>) {
  return (
    <select value={value} data-testid={testId} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

export function CheckField(props: { label: string; checked: boolean; onChange(v: boolean): void; testId?: string }) {
  return (
    <label className="field check">
      <input
        type="checkbox"
        data-testid={props.testId}
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <div className="row-fields">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
