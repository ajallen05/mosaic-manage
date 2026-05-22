import { useEffect, useRef, useCallback, useState } from 'react';
import { Canvas, FabricImage, filters as FabricFilters } from 'fabric';
import {
  Type, Square, Layers, Trash2, Save, Loader2,
  Download, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { editorApi } from '../../api/editor.js';
import useAppStore from '../../store/useAppStore.js';
import useSceneGraph from '../../hooks/useSceneGraph.js';
import LayerPanel from './LayerPanel.jsx';
import PlatformSelector from './PlatformSelector.jsx';
import TextToolbar from './TextToolbar.jsx';
import ExportModal from './ExportModal.jsx';

const FILTER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'brightness', label: 'Brighten' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'blur', label: 'Blur' },
];

export default function FabricCanvas({ onImageUpdated }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const selectedImage = useAppStore(s => s.getSelectedImage());

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);

  const sg = useSceneGraph(fabricRef);
  const {
    layers, selectedLayerId, selectedLayer,
    platformId, setPlatform,
    showSafeArea, toggleSafeArea,
    displaySize,
    addTextLayer, addShapeLayer, addGradientLayer,
    removeLayer, updateLayer,
    moveLayerUp, moveLayerDown,
    toggleVisibility,
    attachEvents,
    reconcile,
    drawSafeAreaOverlay,
    resetLayers,
    addImageLayer,
  } = sg;

  const { displayW, displayH, nativeW, nativeH, exportMultiplier } = displaySize;

  // ── Initialize canvas + load base image ──────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current || !selectedImage) return;

    resetLayers();

    const canvas = new Canvas(canvasRef.current, {
      width: displayW,
      height: displayH,
      backgroundColor: '#1a1a2e',
    });
    fabricRef.current = canvas;
    attachEvents(canvas);

    // Load base image as first layer
    const src = `data:${selectedImage.mimeType || 'image/png'};base64,${selectedImage.base64}`;
    FabricImage.fromURL(src)
      .then(async img => {
        const scaleX = displayW / img.width;
        const scaleY = displayH / img.height;
        img.set({ scaleX, scaleY, left: 0, top: 0, selectable: true, evented: true, layerId: '__base_img' });
        canvas.add(img);
        canvas.renderAll();

        // Add as scene graph layer
        await addImageLayer(src, selectedImage.prompt?.slice(0, 20) || 'Background');
      })
      .catch(err => console.error('[FabricCanvas] image load error:', err));

    const handleKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
        const obj = canvas.getActiveObject();
        if (obj?.layerId && obj.layerId !== '__safe_area') {
          removeLayer(obj.layerId);
        }
      }
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [selectedImage?.id]); // eslint-disable-line

  // ── Resize canvas when platform changes ──────────────────────────────────

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width: displayW, height: displayH });
    reconcile(layers, showSafeArea);
  }, [platformId]); // eslint-disable-line

  // ── Filters (apply to first image object) ────────────────────────────────

  const applyFilter = useCallback((filterName) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const img = canvas.getObjects('image')[0];
    if (!img) return;
    const filterMap = {
      grayscale: new FabricFilters.Grayscale(),
      sepia: new FabricFilters.Sepia(),
      brightness: new FabricFilters.Brightness({ brightness: 0.2 }),
      contrast: new FabricFilters.Contrast({ contrast: 0.2 }),
      blur: new FabricFilters.Blur({ blur: 0.1 }),
    };
    img.filters = filterName === 'none' ? [] : [filterMap[filterName]];
    img.applyFilters();
    canvas.renderAll();
  }, []);

  // ── Delete selected ───────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (selectedLayerId) removeLayer(selectedLayerId);
  }, [selectedLayerId, removeLayer]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback((format, quality) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Hide safe area before export
    drawSafeAreaOverlay(false);
    const dataURL = canvas.toDataURL({
      format,
      quality,
      multiplier: exportMultiplier,
    });
    drawSafeAreaOverlay(showSafeArea);
    const ext = format === 'jpeg' ? 'jpg' : format;
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `mosaic-${platformId}-${Date.now()}.${ext}`;
    a.click();
  }, [exportMultiplier, platformId, showSafeArea, drawSafeAreaOverlay]);

  // ── Save to server ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedImage) return;
    setSaving(true);
    setSaveMsg('');
    try {
      drawSafeAreaOverlay(false);
      const canvasData = canvas.toJSON();
      const sceneGraph = { layers, platform: platformId };
      const dataURL = canvas.toDataURL({ format: 'png', multiplier: 1 });
      const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
      drawSafeAreaOverlay(showSafeArea);
      const data = await editorApi.saveCanvas(selectedImage.id, canvasData, base64, 'image/png', sceneGraph);
      onImageUpdated?.(data.image);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }, [selectedImage, onImageUpdated, layers, platformId, showSafeArea, drawSafeAreaOverlay]);

  if (!selectedImage) return null;

  return (
    <div className="flex gap-3">
      {/* Layer Panel */}
      <LayerPanel
        layers={layers}
        selectedLayerId={selectedLayerId}
        onSelect={(id) => {
          sg.setSelectedLayerId(id);
          const canvas = fabricRef.current;
          if (canvas) {
            const obj = canvas.getObjects().find(o => o.layerId === id);
            if (obj) { canvas.setActiveObject(obj); canvas.renderAll(); }
          }
        }}
        onToggleVisibility={toggleVisibility}
        onMoveUp={moveLayerUp}
        onMoveDown={moveLayerDown}
        onRemove={removeLayer}
      />

      {/* Canvas area */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Platform + toolbar row */}
        <div className="flex flex-wrap gap-2 items-center">
          <PlatformSelector platformId={platformId} onChange={setPlatform} />
          <div className="ml-auto flex flex-wrap gap-2 items-center">
            {/* Add Text */}
            <button
              onClick={addTextLayer}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-3 py-2 transition"
            >
              <Type size={13} /> Text
            </button>

            {/* Add Shape dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowShapeMenu(v => !v)}
                className="flex items-center gap-1 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-3 py-2 transition"
              >
                <Square size={13} /> Shape <ChevronDown size={11} />
              </button>
              {showShapeMenu && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden text-xs">
                  {['rect', 'circle'].map(t => (
                    <button
                      key={t}
                      onClick={() => { addShapeLayer(t); setShowShapeMenu(false); }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-50 capitalize"
                    >
                      {t === 'rect' ? 'Rectangle' : 'Circle'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Gradient */}
            <button
              onClick={addGradientLayer}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-3 py-2 transition"
            >
              <Layers size={13} /> Gradient
            </button>

            {/* Filter */}
            <select
              onChange={e => applyFilter(e.target.value)}
              defaultValue="none"
              className="text-xs bg-white border border-gray-300 hover:border-primary rounded-lg px-2 py-2 transition focus:outline-none"
            >
              {FILTER_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* Safe area toggle */}
            <button
              onClick={() => toggleSafeArea()}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition ${
                showSafeArea
                  ? 'bg-red-50 border-red-400 text-red-600'
                  : 'bg-white border-gray-300 hover:border-primary text-gray-700'
              }`}
              title="Toggle safe area overlay"
            >
              <ShieldCheck size={13} /> Safe
            </button>

            {/* Delete */}
            <button
              onClick={deleteSelected}
              disabled={!selectedLayerId}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-red-400 text-gray-700 disabled:opacity-40 rounded-lg px-3 py-2 transition"
            >
              <Trash2 size={13} /> Delete
            </button>

            {/* Export */}
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-3 py-2 transition"
            >
              <Download size={13} /> Export
            </button>

            {/* Save */}
            <div className="flex items-center gap-2">
              {saveMsg && (
                <span className={`text-xs ${saveMsg.startsWith('Save failed') ? 'text-red-500' : 'text-emerald-600'}`}>
                  {saveMsg}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg px-4 py-2 transition font-medium"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Text toolbar (shown when text layer selected) */}
        {selectedLayer?.type === 'text' && (
          <TextToolbar layer={selectedLayer} onUpdate={updateLayer} />
        )}

        {/* Canvas */}
        <div
          className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
          style={{ width: displayW, maxWidth: '100%' }}
        >
          <canvas ref={canvasRef} />
        </div>

        <p className="text-xs text-gray-400">
          Double-click text to edit inline. Click to select, Delete/Backspace to remove.
        </p>
      </div>

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          onExport={handleExport}
          nativeWidth={nativeW}
          nativeHeight={nativeH}
        />
      )}
    </div>
  );
}
