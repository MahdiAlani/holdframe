import { describe, expect, it } from 'vitest';
import { createProject, createShapeLayer, createTextLayer } from './create';
import { loadProject, UnsupportedVersionError } from './migrate';
import type { Project } from './types';
import { ProjectValidationError, validateProject } from './validate';

function sample(): Project {
  const project = createProject();
  const comp = project.composition;
  comp.layers = [
    createTextLayer(comp, {
      animator: {
        unit: 'character',
        stagger: 0.05,
        order: 'forward',
        duration: 0.4,
        easing: { kind: 'bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
        from: { opacity: 0, position: { x: 0, y: 40 } },
      },
    }),
    createShapeLayer(comp, 'rect'),
  ];
  return JSON.parse(JSON.stringify(project)) as Project;
}

function broken(edit: (p: any) => void): unknown {
  const p = sample();
  edit(p);
  return p;
}

describe('validateProject', () => {
  it('accepts a constructed project after a JSON round trip', () => {
    const project = sample();
    expect(validateProject(project)).toBe(project);
  });

  it('reports the path of the offending field', () => {
    expect(() => validateProject(broken((p) => (p.composition.layers[1].size.static.x = 'wide')))).toThrow(
      'composition.layers[1].size.static.x: expected a finite number',
    );
  });

  it.each([
    ['non-positive fps', (p: any) => (p.composition.fps = 0)],
    ['missing layers', (p: any) => delete p.composition.layers],
    ['unknown layer kind', (p: any) => (p.composition.layers[0].kind = 'video')],
    ['unknown blend mode', (p: any) => (p.composition.layers[0].blendMode = 'darken')],
    ['empty keyframes', (p: any) => (p.composition.layers[0].transform.rotation = { keyframes: [] })],
    [
      'unsorted keyframes',
      (p: any) =>
        (p.composition.layers[0].transform.rotation = {
          keyframes: [
            { t: 1, value: 0, easing: { kind: 'linear' } },
            { t: 1, value: 5, easing: { kind: 'linear' } },
          ],
        }),
    ],
    ['bezier x out of range', (p: any) => (p.composition.layers[0].animator.easing.x1 = 1.5)],
    ['outPoint before inPoint', (p: any) => (p.composition.layers[0].outPoint = -1)],
    ['duplicate ids', (p: any) => (p.composition.layers[1].id = p.composition.layers[0].id)],
    ['NaN number', (p: any) => (p.composition.layers[0].fontSize = Number.NaN)],
  ])('rejects %s', (_name, edit) => {
    expect(() => validateProject(broken(edit))).toThrow(ProjectValidationError);
  });
});

describe('loadProject', () => {
  it('loads a current-version project', () => {
    expect(loadProject(sample()).version).toBe(1);
  });

  it('refuses a future version with a clear message', () => {
    const future = { ...sample(), version: 2 };
    expect(() => loadProject(future)).toThrow(UnsupportedVersionError);
    expect(() => loadProject(future)).toThrow(/newer version of holdframe \(file version 2\)/);
  });

  it('refuses a missing version and non-objects', () => {
    expect(() => loadProject({ composition: {} })).toThrow(UnsupportedVersionError);
    expect(() => loadProject('nope')).toThrow(ProjectValidationError);
    expect(() => loadProject(null)).toThrow(ProjectValidationError);
  });
});
