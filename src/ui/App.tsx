import { useEffect } from 'react';
import { useEditor } from '../store';
import { deleteLayer } from './actions';
import { LayerList } from './LayerList';
import { PropertyPanel } from './PropertyPanel';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { Viewport } from './Viewport';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e.target)) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === ' ') {
        e.preventDefault();
        if (s.playing) s.pause();
        else s.play();
      } else if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedLayerId !== null) {
        e.preventDefault();
        deleteLayer(s.selectedLayerId);
      } else if (e.key === 'Escape') {
        s.selectLayer(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <main className="stage">
        <Viewport />
        <PropertyPanel />
      </main>
      <section className="bottom">
        <LayerList />
        <Timeline />
      </section>
    </div>
  );
}
