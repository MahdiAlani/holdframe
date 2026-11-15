import type { Composition, Layer, Project } from '../model/types';

export interface Command {
  label: string;
  apply(project: Project): Project;
  revert(project: Project): Project;
  swap?: { prev: Layer; next: Layer };
}

export type CompositionSettings = Omit<Composition, 'layers'>;

function withLayers(project: Project, layers: Layer[]): Project {
  return { ...project, composition: { ...project.composition, layers } };
}

function swapLayer(project: Project, layer: Layer): Project {
  return withLayers(
    project,
    project.composition.layers.map((l) => (l.id === layer.id ? layer : l)),
  );
}

export function replaceLayer(prev: Layer, next: Layer, label: string): Command {
  return {
    label,
    apply: (p) => swapLayer(p, next),
    revert: (p) => swapLayer(p, prev),
    swap: { prev, next },
  };
}

export function insertLayer(layer: Layer, index: number): Command {
  return {
    label: 'Add layer',
    apply: (p) => {
      const layers = [...p.composition.layers];
      layers.splice(index, 0, layer);
      return withLayers(p, layers);
    },
    revert: (p) => withLayers(p, p.composition.layers.filter((l) => l.id !== layer.id)),
  };
}

export function removeLayer(layer: Layer, index: number): Command {
  const insert = insertLayer(layer, index);
  return { label: 'Delete layer', apply: insert.revert, revert: insert.apply };
}

export function moveLayer(from: number, to: number): Command {
  const move = (p: Project, a: number, b: number): Project => {
    const layers = [...p.composition.layers];
    const [layer] = layers.splice(a, 1);
    if (!layer) return p;
    layers.splice(b, 0, layer);
    return withLayers(p, layers);
  };
  return { label: 'Reorder layer', apply: (p) => move(p, from, to), revert: (p) => move(p, to, from) };
}

export function setComposition(prev: CompositionSettings, next: CompositionSettings): Command {
  const set = (p: Project, s: CompositionSettings): Project => ({
    ...p,
    composition: { ...s, layers: p.composition.layers },
  });
  return { label: 'Edit composition', apply: (p) => set(p, next), revert: (p) => set(p, prev) };
}

// Folds b into a so one gesture is one undo entry.
export function mergeCommands(a: Command, b: Command): Command {
  if (a.swap && b.swap && a.swap.prev.id === b.swap.next.id) {
    return replaceLayer(a.swap.prev, b.swap.next, b.label);
  }
  return {
    label: b.label,
    apply: (p) => b.apply(a.apply(p)),
    revert: (p) => a.revert(b.revert(p)),
  };
}
