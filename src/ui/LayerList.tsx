import { useState } from 'react';
import type { Layer } from '../model/types';
import { useEditor } from '../store';
import { deleteLayer, shiftLayer, updateLayer } from './actions';

function NameEditor({ layer, onDone }: { layer: Layer; onDone(): void }) {
  const [name, setName] = useState(layer.name);
  const commit = (): void => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== layer.name) updateLayer(layer, { ...layer, name: trimmed }, 'Rename layer');
    onDone();
  };
  return (
    <input
      className="layer-name"
      data-testid="layer-rename"
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onDone();
      }}
    />
  );
}

export function LayerList() {
  const layers = useEditor((s) => s.project.composition.layers);
  const selected = useEditor((s) => s.selectedLayerId);
  const selectLayer = useEditor((s) => s.selectLayer);
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <div className="layer-list">
      <div className="layer-list-header" onClick={() => selectLayer(null)}>
        Layers
      </div>
      {layers.map((layer, i) => (
        <div
          key={layer.id}
          className={`layer-row${layer.id === selected ? ' selected' : ''}${layer.visible ? '' : ' dimmed'}`}
          data-testid="layer-row"
          data-layer-id={layer.id}
          onClick={() => selectLayer(layer.id)}
        >
          <button
            type="button"
            className={`icon${layer.visible ? ' on' : ''}`}
            data-testid="layer-toggle-visible"
            title={layer.visible ? 'Hide layer' : 'Show layer'}
            aria-pressed={layer.visible}
            onClick={() => updateLayer(layer, { ...layer, visible: !layer.visible }, 'Toggle visibility')}
          >
            {layer.visible ? '◉' : '○'}
          </button>
          <button
            type="button"
            className={`icon${layer.locked ? ' on' : ''}`}
            data-testid="layer-toggle-locked"
            title={layer.locked ? 'Unlock layer' : 'Lock layer'}
            aria-pressed={layer.locked}
            onClick={() => updateLayer(layer, { ...layer, locked: !layer.locked }, 'Toggle lock')}
          >
            {layer.locked ? '▣' : '▢'}
          </button>
          {renaming === layer.id ? (
            <NameEditor layer={layer} onDone={() => setRenaming(null)} />
          ) : (
            <span className="layer-name" title="Double-click to rename" onDoubleClick={() => setRenaming(layer.id)}>
              {layer.name}
            </span>
          )}
          <button
            type="button"
            className="icon"
            data-testid="layer-up"
            title="Move up"
            disabled={i === 0}
            onClick={() => shiftLayer(layer.id, -1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="icon"
            data-testid="layer-down"
            title="Move down"
            disabled={i === layers.length - 1}
            onClick={() => shiftLayer(layer.id, 1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="icon"
            data-testid="layer-delete"
            title="Delete layer"
            onClick={(e) => {
              e.stopPropagation();
              deleteLayer(layer.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
      {layers.length === 0 ? <div className="empty">No layers yet. Add one from the toolbar.</div> : null}
    </div>
  );
}
