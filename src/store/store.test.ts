import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createShapeLayer, createTextLayer } from '../model/create';
import type { Layer, ShapeLayer } from '../model/types';
import { insertLayer, moveLayer, removeLayer, replaceLayer, setComposition } from './commands';
import { useEditor } from './editor';
import {
  addKeyframe,
  clearKeyframes,
  getProp,
  keyframeTimes,
  moveKeyframesAt,
  propPaths,
  removeKeyframe,
  removeKeyframesAt,
  setKeyframeEasing,
  setPropValue,
} from './edits';
import { playbackTime, snapTime } from './playback';

const linear = { kind: 'linear' } as const;
const comp = createProject().composition;
const state = () => useEditor.getState();
const ids = () => state().project.composition.layers.map((l) => l.id);

function rect(id: string): ShapeLayer {
  return createShapeLayer(comp, 'rect', { id, name: id });
}

beforeEach(() => {
  state().loadProject(createProject());
});

describe('command stack', () => {
  it('inserts, removes and reorders layers with exact undo', () => {
    const [a, b, c] = [rect('a'), rect('b'), rect('c')];
    state().execute(insertLayer(a, 0));
    state().execute(insertLayer(b, 0));
    state().execute(insertLayer(c, 1));
    expect(ids()).toEqual(['b', 'c', 'a']);
    state().execute(moveLayer(2, 0));
    expect(ids()).toEqual(['a', 'b', 'c']);
    state().execute(removeLayer(b, 1));
    expect(ids()).toEqual(['a', 'c']);

    state().undo();
    expect(ids()).toEqual(['a', 'b', 'c']);
    state().undo();
    expect(ids()).toEqual(['b', 'c', 'a']);
    state().undo();
    state().undo();
    state().undo();
    expect(ids()).toEqual([]);
    state().undo();
    expect(ids()).toEqual([]);

    for (let i = 0; i < 5; i++) state().redo();
    expect(ids()).toEqual(['a', 'c']);
  });

  it('clears redo when a new command runs', () => {
    state().execute(insertLayer(rect('a'), 0));
    state().undo();
    state().execute(insertLayer(rect('b'), 0));
    expect(state().redoStack).toHaveLength(0);
    state().redo();
    expect(ids()).toEqual(['b']);
  });

  it('folds a gesture into one undo entry', () => {
    const a = rect('a');
    state().execute(insertLayer(a, 0));
    for (const name of ['x', 'xy', 'xyz']) {
      state().execute(replaceLayer(a, { ...a, name }, 'Rename'), 'g1');
    }
    state().endGesture();
    expect(state().undoStack).toHaveLength(2);
    expect(state().project.composition.layers[0]!.name).toBe('xyz');
    state().undo();
    expect(state().project.composition.layers[0]!.name).toBe('a');
    state().redo();
    expect(state().project.composition.layers[0]!.name).toBe('xyz');
  });

  it('keeps separate gestures as separate entries', () => {
    const a = rect('a');
    state().execute(insertLayer(a, 0));
    state().execute(replaceLayer(a, { ...a, name: 'one' }, 'Rename'), 'g1');
    state().endGesture();
    const current = state().project.composition.layers[0]!;
    state().execute(replaceLayer(current, { ...current, name: 'two' }, 'Rename'), 'g1');
    expect(state().undoStack).toHaveLength(3);
    state().undo();
    expect(state().project.composition.layers[0]!.name).toBe('one');
  });

  it('edits composition settings and snaps time back into range', () => {
    const { layers: _layers, ...settings } = state().project.composition;
    state().setTime(3.5);
    state().execute(setComposition(settings, { ...settings, duration: 2 }));
    expect(state().project.composition.duration).toBe(2);
    expect(state().time).toBeCloseTo(2 - 1 / 30);
    state().undo();
    expect(state().project.composition.duration).toBe(4);
  });

  it('drops the selection when the selected layer is removed', () => {
    const a = rect('a');
    state().execute(insertLayer(a, 0));
    state().selectLayer('a');
    state().undo();
    expect(state().selectedLayerId).toBeNull();
  });
});

describe('keyframe edits', () => {
  const keyed = (): Layer => {
    const layer = rect('k');
    layer.transform.rotation = {
      keyframes: [
        { t: 0, value: 0, easing: linear },
        { t: 1, value: 90, easing: linear },
      ],
    };
    layer.transform.opacity = { keyframes: [{ t: 1, value: 0.5, easing: linear }] };
    return layer;
  };

  it('lists animatable properties per layer kind', () => {
    expect(propPaths(rect('r'))).toContain('cornerRadius');
    expect(propPaths(createShapeLayer(comp, 'ellipse'))).not.toContain('cornerRadius');
    expect(propPaths(createTextLayer(comp))).not.toContain('size');
  });

  it('collects unique keyframe times across properties', () => {
    expect(keyframeTimes(keyed())).toEqual([0, 1]);
    expect(keyframeTimes(rect('r'))).toEqual([]);
  });

  it('moves every keyframe at a time and keeps them sorted', () => {
    const moved = moveKeyframesAt(keyed(), 0, 2);
    expect(keyframeTimes(moved)).toEqual([1, 2]);
    expect(getProp(moved, 'transform.rotation')).toEqual({
      keyframes: [
        { t: 1, value: 90, easing: linear },
        { t: 2, value: 0, easing: linear },
      ],
    });
  });

  it('replaces a key it lands on', () => {
    const moved = moveKeyframesAt(keyed(), 0, 1);
    expect(getProp(moved, 'transform.rotation')).toEqual({ keyframes: [{ t: 1, value: 0, easing: linear }] });
  });

  it('sets a static value, or a key at the current time when animated', () => {
    const layer = keyed();
    expect(getProp(setPropValue(layer, 'transform.scale', 0.5, { x: 2, y: 2 }), 'transform.scale')).toEqual({
      static: { x: 2, y: 2 },
    });
    const next = setPropValue(layer, 'transform.rotation', 0.5, 10);
    expect(keyframeTimes(next)).toEqual([0, 0.5, 1]);
    const updated = setPropValue(next, 'transform.rotation', 0.5, 20);
    expect(getProp(updated, 'transform.rotation')).toMatchObject({ keyframes: [{}, { t: 0.5, value: 20 }, {}] });
  });

  it('adds a keyframe with the interpolated value', () => {
    const layer = addKeyframe(keyed(), 'transform.rotation', 0.5);
    expect(getProp(layer, 'transform.rotation')).toMatchObject({ keyframes: [{}, { t: 0.5, value: 45 }, {}] });
    const first = addKeyframe(rect('r'), 'transform.opacity', 2);
    expect(getProp(first, 'transform.opacity')).toEqual({ keyframes: [{ t: 2, value: 1, easing: linear }] });
  });

  it('removes keyframes and falls back to static when none remain', () => {
    const layer = removeKeyframe(keyed(), 'transform.opacity', 1);
    expect(getProp(layer, 'transform.opacity')).toEqual({ static: 0.5 });
    expect(keyframeTimes(removeKeyframesAt(keyed(), 1))).toEqual([0]);
  });

  it('clears animation to the value at the current time', () => {
    expect(getProp(clearKeyframes(keyed(), 'transform.rotation', 0.5), 'transform.rotation')).toEqual({ static: 45 });
  });

  it('sets the easing of one key', () => {
    const layer = setKeyframeEasing(keyed(), 'transform.rotation', 0, { kind: 'hold' });
    expect(getProp(layer, 'transform.rotation')).toMatchObject({
      keyframes: [{ easing: { kind: 'hold' } }, { easing: linear }],
    });
  });
});

describe('playback clock', () => {
  const c = { fps: 30, duration: 12 };

  it('snaps to frames and clamps to the last frame', () => {
    expect(snapTime(0.51, c)).toBeCloseTo(15 / 30);
    expect(snapTime(-1, c)).toBe(0);
    expect(snapTime(99, c)).toBeCloseTo(12 - 1 / 30);
  });

  it('does not drift over 10 seconds of irregular ticks', () => {
    let elapsed = 0;
    let seed = 7;
    while (elapsed < 10) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      elapsed += 0.004 + (seed / 2147483648) * 0.03;
      const t = playbackTime(0, elapsed, c);
      expect(t).toBeLessThanOrEqual(elapsed + 1e-9);
      expect(elapsed - t).toBeLessThan(1 / 30 + 1e-9);
    }
    expect(playbackTime(0, 10, c)).toBe(10);
  });

  it('starts from the playhead and loops at the end', () => {
    expect(playbackTime(1, 0.5, c)).toBeCloseTo(1.5);
    expect(playbackTime(11.5, 1, c)).toBeCloseTo(0.5);
    expect(playbackTime(0, 24, c)).toBe(0);
  });
});
