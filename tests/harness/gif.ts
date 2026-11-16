import { applyPalette, GIFEncoder, quantize, type Encoder, type Palette } from 'gifenc';
import { downloadBlob } from '../../src/export';

// Assembles UI screenshots into a GIF with one palette shared by every frame.
// Pixels that match the previous frame are written as transparent, which keeps
// a mostly static editor window small.
const counts = new Map<number, number>();
let palette: Palette = [];
let gif: Encoder | null = null;
let previous: Uint8ClampedArray | null = null;

async function pixels(pngBase64: string): Promise<ImageData> {
  const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${pngBase64}`)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// First pass: collect the colours of a sample frame.
async function addSample(pngBase64: string): Promise<void> {
  const { data } = await pixels(pngBase64);
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
}

// Caps how often each colour is counted, so thin accents such as the playhead
// are not crowded out of the palette by large flat panels.
function buildPalette(): number {
  const out: number[] = [];
  for (const [key, count] of counts) {
    for (let n = Math.min(count, 64); n > 0; n--) out.push(key >> 16, (key >> 8) & 255, key & 255, 255);
  }
  palette = quantize(Uint8Array.from(out), 255);
  counts.clear();
  return palette.length;
}

async function addFrame(pngBase64: string, delayCs: number): Promise<void> {
  gif ??= GIFEncoder();
  const { data, width, height } = await pixels(pngBase64);
  const index = applyPalette(data, palette);
  const transparentIndex = palette.length;
  if (previous) {
    for (let p = 0, i = 0; p < index.length; p++, i += 4) {
      if (data[i] === previous[i] && data[i + 1] === previous[i + 1] && data[i + 2] === previous[i + 2]) {
        index[p] = transparentIndex;
      }
    }
  }
  gif.writeFrame(index, width, height, {
    palette: [...palette, [0, 0, 0]],
    delay: delayCs * 10,
    repeat: 0,
    transparent: previous !== null,
    transparentIndex,
    dispose: 1,
  });
  previous = data;
}

function finish(filename: string): number {
  gif!.finish();
  const bytes = gif!.bytes() as Uint8Array<ArrayBuffer>;
  downloadBlob(new Blob([bytes], { type: 'image/gif' }), filename);
  gif = null;
  previous = null;
  return bytes.length;
}

const api = { addSample, buildPalette, addFrame, finish };
export type GifHarness = typeof api;
(window as unknown as { gifHarness: GifHarness }).gifHarness = api;
document.body.dataset.ready = '1';
