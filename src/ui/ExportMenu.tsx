import { useState } from 'react';
import { getImage } from '../assets/registry';
import { downloadBlob, exportGif, exportLottieBlob, exportVideo } from '../export';
import { useEditor } from '../store';

type Kind = 'gif' | 'mp4' | 'webm' | 'lottie';

const LABELS: Record<Kind, string> = { gif: 'GIF', mp4: 'MP4', webm: 'WebM', lottie: 'Lottie' };

function size(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ExportMenu() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const run = async (kind: Kind): Promise<void> => {
    const s = useEditor.getState();
    s.pause();
    const project = s.project;
    const progress = (done: number, total: number): void =>
      setStatus(`Exporting ${LABELS[kind]}… ${Math.round((done / total) * 100)}%`);
    setBusy(true);
    setStatus(`Exporting ${LABELS[kind]}…`);
    try {
      const blob =
        kind === 'gif'
          ? await exportGif(project, getImage, progress)
          : kind === 'lottie'
            ? await exportLottieBlob(project)
            : await exportVideo(project, kind, getImage, progress);
      downloadBlob(blob, `holdframe.${kind === 'lottie' ? 'json' : kind}`);
      setStatus(`Exported ${LABELS[kind]} · ${size(blob.size)}`);
    } catch (error) {
      setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="toolbar-group">
      <span className="status" data-testid="export-status" role="status">
        {status}
      </span>
      <span className="group-label">Export</span>
      {(Object.keys(LABELS) as Kind[]).map((kind) => (
        <button key={kind} type="button" data-testid={`export-${kind}`} disabled={busy} onClick={() => void run(kind)}>
          {LABELS[kind]}
        </button>
      ))}
    </div>
  );
}
