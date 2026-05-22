import { Eye, EyeOff, Trash2, ChevronUp, ChevronDown, Image, Type, Square, Layers } from 'lucide-react';

const TYPE_ICON = {
  image: <Image size={12} />,
  text: <Type size={12} />,
  shape: <Square size={12} />,
  gradient: <Layers size={12} />,
};

export default function LayerPanel({ layers, selectedLayerId, onSelect, onToggleVisibility, onMoveUp, onMoveDown, onRemove }) {
  const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  if (sorted.length === 0) {
    return (
      <div className="w-[200px] shrink-0 bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Layers</p>
        <p className="text-xs text-gray-400 mt-4 text-center">No layers yet</p>
      </div>
    );
  }

  return (
    <div className="w-[200px] shrink-0 bg-gray-50 border border-gray-200 rounded-xl flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Layers</p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {sorted.map((layer) => {
          const isSelected = layer.id === selectedLayerId;
          return (
            <div
              key={layer.id}
              onClick={() => onSelect(layer.id)}
              className={`flex items-center gap-1.5 px-2 py-2 cursor-pointer transition-colors ${
                isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-gray-100 border-l-2 border-transparent'
              }`}
            >
              <span className={`text-gray-400 shrink-0 ${isSelected ? 'text-primary' : ''}`}>
                {TYPE_ICON[layer.type] || <Layers size={12} />}
              </span>
              <span className={`text-xs truncate flex-1 ${isSelected ? 'text-primary font-medium' : 'text-gray-700'}`}>
                {layer.name}
              </span>
              <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onToggleVisibility(layer.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-700 transition"
                  title={layer.visible ? 'Hide' : 'Show'}
                >
                  {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
                <button
                  onClick={() => onMoveUp(layer.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-700 transition"
                  title="Move up"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  onClick={() => onMoveDown(layer.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-700 transition"
                  title="Move down"
                >
                  <ChevronDown size={11} />
                </button>
                <button
                  onClick={() => onRemove(layer.id)}
                  className="p-0.5 text-gray-400 hover:text-red-500 transition"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
