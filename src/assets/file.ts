import { loadProject } from '../model/migrate';
import type { Project } from '../model/types';

// A .holdframe file is the project JSON plus an `assets` map of image data URLs.
export interface ProjectFile {
  project: Project;
  assets: Record<string, string>;
}

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

export function buildProjectFile(project: Project, assets: Record<string, string>): string {
  return JSON.stringify({ ...project, assets });
}

// Throws without side effects if the text is not a project this build can open.
export function parseProjectFile(text: string): ProjectFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectFileError('This is not a holdframe project: the file is not valid JSON.');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ProjectFileError('This is not a holdframe project: expected a JSON object.');
  }
  const { assets = {}, ...rest } = data as Record<string, unknown>;
  const project = loadProject(rest);
  if (typeof assets !== 'object' || assets === null || Array.isArray(assets)) {
    throw new ProjectFileError('This project file is damaged: `assets` is not an object.');
  }
  for (const [id, url] of Object.entries(assets)) {
    if (typeof url !== 'string' || !url.startsWith('data:')) {
      throw new ProjectFileError(`This project file is damaged: asset "${id}" is not embedded image data.`);
    }
  }
  return { project, assets: assets as Record<string, string> };
}

export function imageAssetIds(project: Project): string[] {
  const ids = new Set<string>();
  for (const layer of project.composition.layers) {
    if (layer.kind === 'image') ids.add(layer.assetId);
  }
  return [...ids];
}
