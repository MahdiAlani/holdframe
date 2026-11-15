import type { ReactNode } from 'react';
import { useEditor } from '../store';
import { addImageLayer, addLayer } from './actions';

export function Toolbar({ children }: { children?: ReactNode }) {
  const playing = useEditor((s) => s.playing);
  const time = useEditor((s) => s.time);
  const fps = useEditor((s) => s.project.composition.fps);
  const canUndo = useEditor((s) => s.undoStack.length > 0);
  const canRedo = useEditor((s) => s.redoStack.length > 0);
  const { play, pause, undo, redo } = useEditor.getState();

  return (
    <header className="toolbar">
      <span className="brand">holdframe</span>
      <div className="toolbar-group">
        <button type="button" data-testid="add-text" onClick={() => addLayer('text')}>
          + Text
        </button>
        <button type="button" data-testid="add-rect" onClick={() => addLayer('rect')}>
          + Rectangle
        </button>
        <button type="button" data-testid="add-ellipse" onClick={() => addLayer('ellipse')}>
          + Ellipse
        </button>
        <label className="file-button">
          + Image
          <input
            type="file"
            accept="image/*"
            data-testid="add-image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void addImageLayer(file);
            }}
          />
        </label>
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className="primary"
          data-testid="play-toggle"
          onClick={playing ? pause : play}
          title="Play / pause (Space)"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <span className="timecode" data-testid="timecode">
          {time.toFixed(2)}s · frame {Math.round(time * fps)}
        </span>
      </div>
      <div className="toolbar-group">
        <button type="button" data-testid="undo" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button type="button" data-testid="redo" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
      </div>
      <div className="toolbar-spacer" />
      {children}
    </header>
  );
}
