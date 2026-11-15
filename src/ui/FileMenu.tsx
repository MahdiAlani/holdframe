import { useState } from 'react';
import { openProjectFile, resumeAutosave, saveProjectFile, usePersistence } from '../assets/persistence';
import { downloadBlob } from '../export';
import { createProject } from '../model/create';
import { useEditor } from '../store';

const AUTOSAVE_TEXT = { idle: '', saving: 'Saving…', saved: 'Saved in this browser', error: '' } as const;

export function FileMenu() {
  const persistence = usePersistence();
  const [error, setError] = useState('');
  const problem = error || persistence.message;

  const open = async (file: File): Promise<void> => {
    try {
      await openProjectFile(file);
      setError('');
    } catch (e) {
      setError(`Could not open ${file.name}. ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="toolbar-group">
      <button
        type="button"
        data-testid="file-new"
        onClick={() => {
          resumeAutosave();
          setError('');
          useEditor.getState().loadProject(createProject());
        }}
      >
        New
      </button>
      <label className="file-button">
        Open
        <input
          type="file"
          accept=".holdframe,application/json"
          data-testid="file-open"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void open(file);
          }}
        />
      </label>
      <button
        type="button"
        data-testid="file-save"
        title="Download this project as a .holdframe file"
        onClick={async () => downloadBlob(await saveProjectFile(useEditor.getState().project), 'project.holdframe')}
      >
        Save
      </button>
      {problem ? (
        <span className="status error" data-testid="file-error" role="alert" title={problem}>
          {problem}
        </span>
      ) : (
        <span className="status" data-testid="save-status" role="status">
          {AUTOSAVE_TEXT[persistence.status]}
        </span>
      )}
    </div>
  );
}
