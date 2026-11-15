import { useEffect } from 'react';
import { useEditor } from '../store';
import { LayerList } from './LayerList';
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
      </main>
      <section className="bottom">
        <LayerList />
        <Timeline />
      </section>
    </div>
  );
}
