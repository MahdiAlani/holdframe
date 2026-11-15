import { describe, expect, it } from 'vitest';
import { createImageLayer, createProject, createTextLayer } from '../model/create';
import { ANIMATOR_PRESETS } from '../model/presets';
import { buildProjectFile, imageAssetIds, parseProjectFile, ProjectFileError } from './file';

const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

function sample() {
  const project = createProject();
  const comp = project.composition;
  comp.layers = [
    createTextLayer(comp, { animator: ANIMATOR_PRESETS[0]!.animator }),
    createImageLayer(comp, 'pic', { x: 10, y: 10 }),
    createImageLayer(comp, 'pic', { x: 20, y: 20 }),
  ];
  return project;
}

describe('.holdframe files', () => {
  it('round-trips a project and its embedded images', () => {
    const project = sample();
    const parsed = parseProjectFile(buildProjectFile(project, { pic: PIXEL }));
    expect(parsed.project).toEqual(project);
    expect(parsed.assets).toEqual({ pic: PIXEL });
    expect('assets' in parsed.project).toBe(false);
  });

  it('lists each referenced image once', () => {
    expect(imageAssetIds(sample())).toEqual(['pic']);
  });

  it('accepts a file with no assets', () => {
    expect(parseProjectFile(JSON.stringify(createProject())).assets).toEqual({});
  });

  it('refuses an unknown future version with a clear message', () => {
    const future = buildProjectFile({ ...sample(), version: 7 as 1 }, {});
    expect(() => parseProjectFile(future)).toThrow(/newer version of holdframe \(file version 7\).*reads up to version 1/);
  });

  it('refuses files that are not projects', () => {
    expect(() => parseProjectFile('not json')).toThrow(ProjectFileError);
    expect(() => parseProjectFile('[1, 2]')).toThrow(ProjectFileError);
    expect(() => parseProjectFile('{"hello": "world"}')).toThrow(/Unrecognised project version/);
    const broken = JSON.parse(buildProjectFile(sample(), {}));
    broken.composition.layers[0].fontSize = 'big';
    expect(() => parseProjectFile(JSON.stringify(broken))).toThrow('composition.layers[0].fontSize');
  });

  it('refuses damaged assets', () => {
    const base = JSON.parse(buildProjectFile(sample(), {}));
    expect(() => parseProjectFile(JSON.stringify({ ...base, assets: ['x'] }))).toThrow(/assets/);
    expect(() => parseProjectFile(JSON.stringify({ ...base, assets: { pic: 'http://example.com/a.png' } }))).toThrow(/asset "pic"/);
  });
});
