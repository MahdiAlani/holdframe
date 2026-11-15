import { create } from 'zustand';
import { loadProject } from '../model/migrate';
import type { Project } from '../model/types';
import { useEditor } from '../store/editor';
import { idbGet, idbPut } from './db';
import { buildProjectFile, imageAssetIds, parseProjectFile } from './file';
import { getAssetBlob, hasAsset, registerAsset } from './registry';

interface PersistenceState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  message: string;
}

export const usePersistence = create<PersistenceState>(() => ({ status: 'idle', message: '' }));

const AUTOSAVE_KEY = 'autosave';
let autosaveEnabled = true;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function hydrateAssets(project: Project): Promise<void> {
  for (const id of imageAssetIds(project)) {
    if (hasAsset(id)) continue;
    const blob = await idbGet<Blob>('assets', id);
    if (blob) await registerAsset(id, blob);
  }
}

// Loads the autosaved project, if there is one this build can read. A copy it
// cannot read is left untouched and autosave stays off until the user replaces it.
export async function restore(): Promise<void> {
  try {
    const saved = await idbGet<unknown>('projects', AUTOSAVE_KEY);
    if (saved === undefined) return;
    const project = loadProject(saved);
    await hydrateAssets(project);
    useEditor.getState().loadProject(project);
  } catch (error) {
    autosaveEnabled = false;
    usePersistence.setState({
      status: 'error',
      message: `Could not restore your autosaved project. ${describe(error)} Autosave is paused so that copy is not overwritten.`,
    });
  }
}

export function resumeAutosave(): void {
  autosaveEnabled = true;
}

export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = useEditor.getState().project;
  const save = async (): Promise<void> => {
    try {
      await idbPut('projects', AUTOSAVE_KEY, last);
      usePersistence.setState({ status: 'saved', message: '' });
    } catch (error) {
      usePersistence.setState({ status: 'error', message: `Autosave failed. ${describe(error)}` });
    }
  };
  return useEditor.subscribe((s) => {
    if (s.project === last) return;
    last = s.project;
    if (!autosaveEnabled) return;
    usePersistence.setState({ status: 'saving', message: '' });
    clearTimeout(timer);
    timer = setTimeout(() => void save(), 300);
  });
}

export async function saveProjectFile(project: Project): Promise<Blob> {
  const assets: Record<string, string> = {};
  for (const id of imageAssetIds(project)) {
    const blob = getAssetBlob(id);
    if (blob) assets[id] = await blobToDataUrl(blob);
  }
  return new Blob([buildProjectFile(project, assets)], { type: 'application/json' });
}

// Replaces the open project. Nothing changes unless the whole file is readable.
export async function openProjectFile(file: Blob): Promise<void> {
  const { project, assets } = parseProjectFile(await file.text());
  const blobs = await Promise.all(
    Object.entries(assets).map(async ([id, url]) => [id, await (await fetch(url)).blob()] as const),
  );
  for (const [id, blob] of blobs) await registerAsset(id, blob);
  resumeAutosave();
  useEditor.getState().loadProject(project);
}
