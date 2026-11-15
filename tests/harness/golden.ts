import { evaluate } from '../../src/eval';
import { loadProject } from '../../src/model';
import { createCanvas2DRenderer } from '../../src/render';
import data from '../fixtures/golden.json';

function checker(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f2f2f2' : '#e0457b';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  return c;
}

const project = loadProject(data);
const t = Number(new URLSearchParams(location.search).get('t') ?? '0');
const image = checker();
const canvas = document.querySelector('canvas')!;
const renderer = createCanvas2DRenderer(canvas, (id) => (id === 'checker' ? image : null));

document.fonts.ready.then(() => {
  renderer.render(evaluate(project, t));
  document.body.dataset.ready = '1';
});
