import { expect, it } from 'vitest';
import demo from '../../demo/demo.holdframe?raw';
import { evaluate } from '../eval';
import { parseProjectFile } from './file';

it('the demo project is valid and loops: its first and last frames are both empty', () => {
  const { project } = parseProjectFile(demo);
  const { fps, duration, width, height } = project.composition;
  expect([width, height, fps, duration]).toEqual([1080, 1080, 30, 4]);
  for (const t of [0, duration - 1 / fps]) {
    const visible = evaluate(project, t).commands.filter(
      (c) => c.opacity > 0 && !(c.kind === 'rect' && Math.abs(c.matrix[0]) < 1e-9),
    );
    expect(visible).toEqual([]);
  }
  const settled = evaluate(project, 3).commands;
  expect(settled).toHaveLength(1 + 9 + 5);
  expect(settled.every((c) => c.opacity === 1)).toBe(true);
});
