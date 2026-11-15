import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor } from './store';
import { App } from './ui/App';
import './ui/styles.css';

if (import.meta.env.DEV) {
  (window as unknown as { __holdframe: typeof useEditor }).__holdframe = useEditor;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
