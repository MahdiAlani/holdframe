import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
} from 'mediabunny';
import type { Project } from '../model/types';
import type { AssetResolver } from '../render';
import { createFrameRenderer, type Progress } from './frames';

export type VideoFormat = 'mp4' | 'webm';

export async function exportVideo(
  project: Project,
  format: VideoFormat,
  assets: AssetResolver,
  onProgress?: Progress,
): Promise<Blob> {
  const { width, height } = project.composition;
  const container = format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
  // Takes the container's preferred codec this browser can encode: H.264 for MP4 where available.
  const codec = await getFirstEncodableVideoCodec(container.getSupportedVideoCodecs(), { width, height });
  if (!codec) {
    throw new Error(`This browser cannot encode ${format.toUpperCase()} video at ${width}x${height}. Try GIF, or a Chromium-based browser.`);
  }

  const frames = createFrameRenderer(project, assets);
  const target = new BufferTarget();
  const output = new Output({ format: container, target });
  const source = new CanvasSource(frames.canvas, { codec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: frames.fps });
  await output.start();
  for (let i = 0; i < frames.frames; i++) {
    frames.render(i);
    await source.add(i / frames.fps, 1 / frames.fps);
    onProgress?.(i + 1, frames.frames);
  }
  await output.finalize();
  if (!target.buffer) throw new Error('Video export produced no data.');
  return new Blob([target.buffer], { type: container.mimeType });
}
