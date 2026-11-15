import type { DrawCommand, RenderTree, TextCommand } from '../../eval/renderTree';
import type { BlendMode } from '../../model/types';
import type { AssetResolver, Renderer } from '../renderer';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const COMPOSITE: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  add: 'lighter',
};

export function fontString(cmd: { fontWeight: number; fontSize: number; fontFamily: string }): string {
  return `${cmd.fontWeight} ${cmd.fontSize}px ${cmd.fontFamily}`;
}

function paint(ctx: Ctx, fill: string | null, stroke: { colour: string; width: number } | null): void {
  if (fill !== null) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke !== null && stroke.width > 0) {
    ctx.strokeStyle = stroke.colour;
    ctx.lineWidth = stroke.width;
    ctx.stroke();
  }
}

function drawText(ctx: Ctx, cmd: TextCommand): void {
  ctx.font = fontString(cmd);
  ctx.textAlign = cmd.align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = cmd.fill;
  cmd.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, 0, i * cmd.fontSize * cmd.lineHeight);
  });
}

function draw(ctx: Ctx, cmd: DrawCommand, assets: AssetResolver): void {
  if (cmd.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = cmd.opacity;
  ctx.globalCompositeOperation = COMPOSITE[cmd.blendMode];
  ctx.transform(...cmd.matrix);
  switch (cmd.kind) {
    case 'rect':
      ctx.beginPath();
      ctx.roundRect(-cmd.width / 2, -cmd.height / 2, cmd.width, cmd.height, cmd.cornerRadius);
      paint(ctx, cmd.fill, cmd.stroke);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(0, 0, cmd.width / 2, cmd.height / 2, 0, 0, Math.PI * 2);
      paint(ctx, cmd.fill, cmd.stroke);
      break;
    case 'image': {
      const source = assets(cmd.assetId);
      if (source) ctx.drawImage(source, -cmd.width / 2, -cmd.height / 2, cmd.width, cmd.height);
      break;
    }
    case 'text':
      drawText(ctx, cmd);
      break;
  }
  ctx.restore();
}

export function createCanvas2DRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  assets: AssetResolver,
): Renderer {
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('Canvas2D is not available');
  return {
    render(tree: RenderTree): void {
      if (canvas.width !== tree.width) canvas.width = tree.width;
      if (canvas.height !== tree.height) canvas.height = tree.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, tree.width, tree.height);
      if (tree.background !== null) {
        ctx.fillStyle = tree.background;
        ctx.fillRect(0, 0, tree.width, tree.height);
      }
      for (const cmd of tree.commands) draw(ctx, cmd, assets);
    },
  };
}
