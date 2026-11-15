declare module 'gifenc' {
  export type Palette = number[][];
  export type PixelFormat = 'rgb565' | 'rgb444' | 'rgba4444';

  export interface FrameOptions {
    palette?: Palette;
    delay?: number; // ms, stored in 1/100 s
    transparent?: boolean;
    transparentIndex?: number;
    repeat?: number; // 0 = loop forever
    dispose?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: PixelFormat; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: PixelFormat): Uint8Array;
}
