import { useState } from 'react';
import { X, Download } from 'lucide-react';

const FORMATS = [
  { id: 'png', label: 'PNG', hasQuality: false },
  { id: 'jpeg', label: 'JPG', hasQuality: true },
  { id: 'webp', label: 'WEBP', hasQuality: true },
];

export default function ExportModal({ onClose, onExport, nativeWidth, nativeHeight }) {
  const [format, setFormat] = useState('png');
  const [quality, setQuality] = useState(0.92);

  const hasQuality = FORMATS.find(f => f.id === format)?.hasQuality;

  function handleExport() {
    onExport(format, quality);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Export Image</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={16} />
          </button>
        </div>

        {/* Resolution */}
        <div className="bg-gray-50 rounded-xl px-4 py-2 text-xs text-gray-500 text-center">
          {nativeWidth} × {nativeHeight} px (native resolution)
        </div>

        {/* Format tabs */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5 font-medium">Format</p>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {FORMATS.map(f => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  format === f.id ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quality */}
        {hasQuality && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">
              Quality — {Math.round(quality * 100)}%
            </p>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(quality * 100)}
              onChange={e => setQuality(Number(e.target.value) / 100)}
              className="w-full accent-primary"
            />
          </div>
        )}

        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-xl text-sm transition"
        >
          <Download size={14} />
          Download {format.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
