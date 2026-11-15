import { useEditor } from '../store';

export function LayerList() {
  const layers = useEditor((s) => s.project.composition.layers);
  const selected = useEditor((s) => s.selectedLayerId);
  const selectLayer = useEditor((s) => s.selectLayer);

  return (
    <div className="layer-list">
      <div className="layer-list-header">Layers</div>
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={`layer-row${layer.id === selected ? ' selected' : ''}`}
          data-testid="layer-row"
          data-layer-id={layer.id}
          onClick={() => selectLayer(layer.id)}
        >
          <span className="layer-name">{layer.name}</span>
        </div>
      ))}
    </div>
  );
}
