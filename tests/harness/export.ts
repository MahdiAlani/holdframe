import lottie, { type AnimationItem } from 'lottie-web';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { getImage, registerAsset } from '../../src/assets/registry';
import { evaluate } from '../../src/eval';
import { exportGif, exportLottieBlob, exportVideo, type VideoFormat } from '../../src/export';
import { ANIMATOR_PRESETS, createProject, createShapeLayer, createTextLayer, loadProject, type Project } from '../../src/model';
import { createCanvas2DRenderer, createCanvasMeasurer } from '../../src/render';
import animator from '../fixtures/animator.json';
import golden from '../fixtures/golden.json';

async function registerChecker(): Promise<void> {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f2f2f2' : '#e0457b';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
  await registerAsset('checker', blob);
}

// A 1080x1080, 4 second composition of the kind the editor is for.
function launchProject(): Project {
  const project = createProject();
  const comp = project.composition;
  const headline = createTextLayer(comp, {
    id: 'headline',
    text: 'Motion graphics\nin your browser',
    fontFamily: 'Arial, sans-serif',
    fontSize: 110,
    animator: ANIMATOR_PRESETS[0]!.animator,
  });
  const bar = createShapeLayer(comp, 'rect', { id: 'bar', fill: '#5b8cff' });
  bar.transform.position = { static: { x: 540, y: 760 } };
  bar.size = {
    keyframes: [
      { t: 0.8, value: { x: 0, y: 24 }, easing: { kind: 'bezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 } },
      { t: 1.8, value: { x: 820, y: 24 }, easing: { kind: 'linear' } },
    ],
  };
  const dot = createShapeLayer(comp, 'ellipse', { id: 'dot', fill: '#ffb347', blendMode: 'screen' });
  dot.transform.position = {
    keyframes: [
      { t: 0, value: { x: 200, y: 200 }, easing: { kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
      { t: 4, value: { x: 880, y: 300 }, easing: { kind: 'linear' } },
    ],
  };
  comp.layers = [headline, bar, dot];
  return project;
}

const fixtures: Record<string, () => Project> = {
  golden: () => loadProject(structuredClone(golden)),
  animator: () => loadProject(structuredClone(animator)),
  launch: launchProject,
};

function project(name: string, edit?: string): Project {
  const p = fixtures[name]!();
  if (edit) new Function('p', edit)(p);
  return p;
}

async function gif(name: string, edit?: string) {
  const started = performance.now();
  const blob = await exportGif(project(name, edit), getImage);
  const ms = performance.now() - started;
  const decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: 'image/gif' });
  await decoder.tracks.ready;
  await decoder.completed;
  const track = decoder.tracks.selectedTrack!;
  let duration = 0;
  let width = 0;
  let height = 0;
  for (let i = 0; i < track.frameCount; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    duration += (image.duration ?? 0) / 1e6;
    width = image.displayWidth;
    height = image.displayHeight;
    image.close();
  }
  return { ms, bytes: blob.size, frames: track.frameCount, duration, width, height, loops: track.repetitionCount };
}

async function video(name: string, format: VideoFormat, edit?: string) {
  const p = project(name, edit);
  const started = performance.now();
  const blob = await exportVideo(p, format, getImage);
  const ms = performance.now() - started;

  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const stats = await track.computePacketStats();
  const info = {
    ms,
    bytes: blob.size,
    type: blob.type,
    codec: await track.getCodec(),
    frames: stats.packetCount,
    duration: await input.computeDuration(),
    width: await track.getDisplayWidth(),
  };

  // Plays it in a <video> element and samples a decoded frame from the middle.
  const el = document.createElement('video');
  el.muted = true;
  el.src = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    el.onloadeddata = () => resolve();
    el.onerror = () => reject(new Error(`<video> could not load the ${format}: ${el.error?.message}`));
  });
  const t = p.composition.duration / 2;
  el.currentTime = t + 0.5 / p.composition.fps;
  await new Promise<void>((resolve) => (el.onseeked = () => resolve()));
  const c = new OffscreenCanvas(el.videoWidth, el.videoHeight);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(el, 0, 0);
  const decoded = ctx.getImageData(0, 0, c.width, c.height).data;

  const ours = new OffscreenCanvas(p.composition.width, p.composition.height);
  createCanvas2DRenderer(ours, getImage).render(evaluate(p, t, createCanvasMeasurer()));
  const expected = ours.getContext('2d')!.getImageData(0, 0, ours.width, ours.height).data;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 4) {
    diff += Math.abs(decoded[i]! - expected[i]!) + Math.abs(decoded[i + 1]! - expected[i + 1]!) + Math.abs(decoded[i + 2]! - expected[i + 2]!);
  }
  return {
    ...info,
    elementDuration: el.duration,
    elementWidth: el.videoWidth,
    meanDiffFromRender: diff / ((expected.length / 4) * 3),
  };
}

let animation: AnimationItem | null = null;

// Draws our render of `name` at time t, and the exported Lottie at the same frame in lottie-web.
async function compare(name: string, t: number, edit?: string) {
  const p = project(name, edit);
  const ours = document.querySelector<HTMLCanvasElement>('#ours')!;
  createCanvas2DRenderer(ours, getImage).render(evaluate(p, t, createCanvasMeasurer()));

  const started = performance.now();
  const data = JSON.parse(await (await exportLottieBlob(p)).text());
  const ms = performance.now() - started;
  const container = document.querySelector<HTMLDivElement>('#lottie')!;
  animation?.destroy();
  container.style.width = `${p.composition.width}px`;
  container.style.height = `${p.composition.height}px`;
  animation = lottie.loadAnimation({ container, renderer: 'svg', loop: false, autoplay: false, animationData: data });
  await new Promise<void>((resolve) => {
    if (animation!.isLoaded) resolve();
    else animation!.addEventListener('DOMLoaded', () => resolve());
  });
  animation.goToAndStop(t * p.composition.fps, true);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return { ms, layers: data.layers.length, frames: data.op, fr: data.fr, bytes: JSON.stringify(data).length };
}

// Fraction of pixels that differ visibly between two PNGs, and the mean channel difference.
async function diff(a: string, b: string, threshold = 48) {
  const load = async (b64: string): Promise<ImageData> => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  };
  const [x, y] = await Promise.all([load(a), load(b)]);
  if (x.width !== y.width || x.height !== y.height) return { mismatch: 1, mean: 255, width: x.width, otherWidth: y.width };
  let over = 0;
  let total = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    const d = Math.max(
      Math.abs(x.data[i]! - y.data[i]!),
      Math.abs(x.data[i + 1]! - y.data[i + 1]!),
      Math.abs(x.data[i + 2]! - y.data[i + 2]!),
    );
    total += d;
    if (d > threshold) over++;
  }
  const pixels = x.data.length / 4;
  return { mismatch: over / pixels, mean: total / pixels, width: x.width, otherWidth: y.width };
}

const api = { gif, video, compare, diff };
export type ExportHarness = typeof api;

registerChecker().then(() => {
  (window as unknown as { harness: ExportHarness }).harness = api;
  document.body.dataset.ready = '1';
});
