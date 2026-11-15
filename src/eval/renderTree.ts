import type { BlendMode } from '../model/types';
import type { Matrix } from './matrix';

interface CommandBase {
  layerId: string;
  matrix: Matrix; // local space -> composition pixels
  opacity: number; // 0..1
  blendMode: BlendMode;
}

// Rect, ellipse and image are centred on the local origin.
export interface RectCommand extends CommandBase {
  kind: 'rect';
  width: number;
  height: number;
  cornerRadius: number;
  fill: string | null;
  stroke: { colour: string; width: number } | null;
}

export interface EllipseCommand extends CommandBase {
  kind: 'ellipse';
  width: number;
  height: number;
  fill: string | null;
  stroke: { colour: string; width: number } | null;
}

export interface ImageCommand extends CommandBase {
  kind: 'image';
  assetId: string;
  width: number;
  height: number;
}

// Local origin is the first line's baseline at the alignment edge (left, centre or right).
export interface TextCommand extends CommandBase {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  blur: number; // px, 0 = sharp
}

export type DrawCommand = RectCommand | EllipseCommand | ImageCommand | TextCommand;

export interface RenderTree {
  width: number;
  height: number;
  background: string | null;
  commands: DrawCommand[]; // paint order, bottom first
}
