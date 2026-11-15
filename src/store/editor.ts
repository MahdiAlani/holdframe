import { create } from 'zustand';
import { createProject } from '../model/create';
import type { Layer, Project, Time } from '../model/types';
import { mergeCommands, type Command } from './commands';
import { playbackTime, snapTime } from './playback';

export interface EditorState {
  project: Project;
  time: Time;
  playing: boolean;
  selectedLayerId: string | null;
  undoStack: Command[];
  redoStack: Command[];
  gesture: string | null;

  // Commands sharing a gesture id fold into a single undo entry.
  execute(command: Command, gesture?: string): void;
  endGesture(): void;
  undo(): void;
  redo(): void;
  loadProject(project: Project): void;
  setTime(t: Time): void;
  selectLayer(id: string | null): void;
  play(): void;
  pause(): void;
}

function fitSelection(project: Project, id: string | null): string | null {
  return id !== null && project.composition.layers.some((l) => l.id === id) ? id : null;
}

export const useEditor = create<EditorState>()((set, get) => {
  const commit = (project: Project, rest: Partial<EditorState>): void => {
    const s = get();
    set({
      project,
      time: snapTime(s.time, project.composition),
      selectedLayerId: fitSelection(project, s.selectedLayerId),
      ...rest,
    });
  };

  return {
    project: createProject(),
    time: 0,
    playing: false,
    selectedLayerId: null,
    undoStack: [],
    redoStack: [],
    gesture: null,

    execute(command, gesture) {
      const s = get();
      const top = s.undoStack[s.undoStack.length - 1];
      if (gesture !== undefined && gesture === s.gesture && top) {
        commit(command.apply(s.project), {
          undoStack: [...s.undoStack.slice(0, -1), mergeCommands(top, command)],
        });
        return;
      }
      commit(command.apply(s.project), {
        undoStack: [...s.undoStack, command],
        redoStack: [],
        gesture: gesture ?? null,
      });
    },

    endGesture() {
      set({ gesture: null });
    },

    undo() {
      const s = get();
      const command = s.undoStack[s.undoStack.length - 1];
      if (!command) return;
      commit(command.revert(s.project), {
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, command],
        gesture: null,
      });
    },

    redo() {
      const s = get();
      const command = s.redoStack[s.redoStack.length - 1];
      if (!command) return;
      commit(command.apply(s.project), {
        undoStack: [...s.undoStack, command],
        redoStack: s.redoStack.slice(0, -1),
        gesture: null,
      });
    },

    loadProject(project) {
      set({
        project,
        time: 0,
        playing: false,
        selectedLayerId: null,
        undoStack: [],
        redoStack: [],
        gesture: null,
      });
    },

    setTime(t) {
      set({ time: snapTime(t, get().project.composition) });
    },

    selectLayer(id) {
      set({ selectedLayerId: id });
    },

    play() {
      if (get().playing) return;
      const startWall = performance.now();
      const startTime = get().time;
      set({ playing: true });
      const tick = (now: number): void => {
        const s = get();
        if (!s.playing) return;
        set({ time: playbackTime(startTime, (now - startWall) / 1000, s.project.composition) });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    pause() {
      set({ playing: false });
    },
  };
});

export function selectedLayer(s: EditorState): Layer | null {
  return s.project.composition.layers.find((l) => l.id === s.selectedLayerId) ?? null;
}
