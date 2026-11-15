import type { RenderTree } from '../eval/renderTree';

export type AssetResolver = (assetId: string) => CanvasImageSource | null;

export interface Renderer {
  render(tree: RenderTree): void;
}
