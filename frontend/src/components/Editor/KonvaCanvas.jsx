import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Stage, Layer,
  Image as KonvaImage,
  Text as KonvaText,
  Rect as KonvaRect,
  Circle as KonvaCircle,
  Transformer,
} from 'react-konva';
import Konva from 'konva';
import {
  Type, ImagePlus, Square, Layers, Trash2,
  Save, Loader2, Download, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { editorApi } from '../../api/editor.js';
import useAppStore from '../../store/useAppStore.js';
import LayerPanel from './LayerPanel.jsx';
import PlatformSelector from './PlatformSelector.jsx';
import TextToolbar from './TextToolbar.jsx';
import ExportModal from './ExportModal.jsx';
import { PLATFORM_PROFILES, getDisplaySize } from '../../lib/platformProfiles.js';
import { loadGoogleFont } from '../../lib/googleFonts.js';

const FILTER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'brightness', label: 'Brighten' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'blur', label: 'Blur' },
];

export default function KonvaCanvas({ onImageUpdated }) {
  const selectedImage = useAppStore(s => s.getSelectedImage());

  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [platformId, setPlatformId] = useState('instagram_feed');
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [baseFilter, setBaseFilter] = useState('none');
  const [editingTextId, setEditingTextId] = useState(null);

  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const fileInputRef = useRef(null);
  const baseImageRef = useRef(null);
  const textareaRef = useRef(null);

  const { displayW, displayH, nativeW, nativeH, exportMultiplier } = getDisplaySize(platformId);
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null;

  // ── Load base image ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedImage) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = `data:${selectedImage.mimeType || 'image/png'};base64,${selectedImage.base64}`;
    img.onload = () => {
      setNodes([{
        id: 'base',
        type: 'image',
        name: (selectedImage.prompt || 'Background').slice(0, 24),
        visible: true,
        draggable: false,
        x: 0, y: 0,
        width: img.width,
        height: img.height,
        scaleX: displayW / img.width,
        scaleY: displayH / img.height,
        rotation: 0,
        opacity: 1,
        imageEl: img,
      }]);
      setSelectedId(null);
      setBaseFilter('none');
    };
  }, [selectedImage?.id]); // eslint-disable-line

  // ── Attach transformer ───────────────────────────────────────────────────

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (selectedId && selectedId !== editingTextId) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, nodes, editingTextId]);

  // ── Apply filter to base image ───────────────────────────────────────────

  useEffect(() => {
    const node = baseImageRef.current;
    if (!node) return;
    const filterMap = {
      grayscale: [Konva.Filters.Grayscale],
      sepia: [Konva.Filters.Sepia],
      brightness: [Konva.Filters.Brighten],
      contrast: [Konva.Filters.Contrast],
      blur: [Konva.Filters.Blur],
    };
    if (baseFilter === 'none') {
      node.filters([]);
      node.clearCache();
    } else {
      node.cache();
      node.filters(filterMap[baseFilter] || []);
      if (baseFilter === 'brightness') node.brightness(0.2);
      if (baseFilter === 'contrast') node.contrast(20);
      if (baseFilter === 'blur') node.blurRadius(6);
    }
    node.getLayer()?.batchDraw();
  }, [baseFilter]);

  // ── Node helpers ─────────────────────────────────────────────────────────

  const updateNode = useCallback((id, patch) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  }, []);

  const removeNode = useCallback((id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const moveUp = useCallback((id) => {
    setNodes(prev => {
      const i = prev.findIndex(n => n.id === id);
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }, []);

  const moveDown = useCallback((id) => {
    setNodes(prev => {
      const i = prev.findIndex(n => n.id === id);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i], next[i - 1]] = [next[i - 1], next[i]];
      return next;
    });
  }, []);

  const toggleVisibility = useCallback((id) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, visible: !n.visible } : n));
  }, []);

  // ── Font loader (triggers stage redraw after font is ready) ──────────────

  const handleFontLoad = useCallback(async (name) => {
    await loadGoogleFont(name);
    stageRef.current?.batchDraw();
  }, []);

  // ── Add Text ─────────────────────────────────────────────────────────────

  const addText = useCallback(async () => {
    await loadGoogleFont('Inter').catch(() => {});
    const id = crypto.randomUUID();
    setNodes(prev => [...prev, {
      id, type: 'text', name: 'Text',
      visible: true, draggable: true,
      x: Math.round(displayW * 0.1),
      y: Math.round(displayH * 0.4),
      width: Math.round(displayW * 0.8),
      height: 80,
      rotation: 0, opacity: 1,
      text: 'Your text here',
      fontFamily: 'Inter',
      fontSize: Math.round(displayW * 0.055),
      fontStyle: 'normal',
      fontWeight: 'normal',
      fill: '#ffffff',
      align: 'left',
    }]);
    setSelectedId(id);
  }, [displayW, displayH]);

  // ── Add Image Overlay ────────────────────────────────────────────────────

  const addImageOverlay = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = ev.target.result;
      img.onload = () => {
        const scale = Math.min((displayW * 0.5) / img.width, (displayH * 0.5) / img.height);
        const id = crypto.randomUUID();
        setNodes(prev => [...prev, {
          id, type: 'image',
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 20),
          visible: true, draggable: true,
          x: Math.round(displayW * 0.25),
          y: Math.round(displayH * 0.25),
          width: img.width,
          height: img.height,
          scaleX: scale, scaleY: scale,
          rotation: 0, opacity: 1,
          imageEl: img,
        }]);
        setSelectedId(id);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [displayW, displayH]);

  // ── Add Shape ────────────────────────────────────────────────────────────

  const addShape = useCallback((shapeType) => {
    const id = crypto.randomUUID();
    const size = Math.round(displayW * 0.25);
    setNodes(prev => [...prev, {
      id, type: shapeType,
      name: shapeType === 'circle' ? 'Circle' : 'Rectangle',
      visible: true, draggable: true,
      x: Math.round(displayW * 0.3),
      y: Math.round(displayH * 0.3),
      width: size, height: size,
      rotation: 0, opacity: 1,
      fill: 'rgba(255,255,255,0.3)',
      stroke: '#ffffff', strokeWidth: 2,
      cornerRadius: 0,
    }]);
    setSelectedId(id);
    setShowShapeMenu(false);
  }, [displayW, displayH]);

  // ── Add Gradient ─────────────────────────────────────────────────────────

  const addGradient = useCallback(() => {
    const id = crypto.randomUUID();
    setNodes(prev => [...prev, {
      id, type: 'gradient', name: 'Gradient',
      visible: true, draggable: false,
      x: 0, y: 0,
      width: displayW, height: displayH,
      rotation: 0, opacity: 1,
      colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)'],
    }]);
    setSelectedId(id);
  }, [displayW, displayH]);

  // ── Inline text editing (textarea overlay) ───────────────────────────────

  const startTextEdit = useCallback((node) => {
    const stage = stageRef.current;
    if (!stage) return;
    const konvaNode = stage.findOne(`#${node.id}`);
    if (!konvaNode) return;

    setEditingTextId(node.id);
    setSelectedId(null);

    const stageBox = stage.container().getBoundingClientRect();
    const absPos = konvaNode.getAbsolutePosition();
    const scaleX = konvaNode.getAbsoluteScale().x;

    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.value = node.text;
    textarea.style.position = 'fixed';
    textarea.style.left = `${stageBox.left + absPos.x}px`;
    textarea.style.top = `${stageBox.top + absPos.y}px`;
    textarea.style.width = `${node.width * scaleX}px`;
    textarea.style.fontSize = `${node.fontSize * scaleX}px`;
    textarea.style.fontFamily = node.fontFamily;
    textarea.style.color = node.fill;
    textarea.style.display = 'block';
    textarea.focus();
    textarea.select();
  }, []);

  const finishTextEdit = useCallback(() => {
    const id = editingTextId;
    if (!id || !textareaRef.current) return;
    updateNode(id, { text: textareaRef.current.value });
    textareaRef.current.style.display = 'none';
    setEditingTextId(null);
    setSelectedId(id);
  }, [editingTextId, updateNode]);

  // ── Drag / transform callbacks ───────────────────────────────────────────

  const handleDragEnd = useCallback((id, e) => {
    updateNode(id, { x: e.target.x(), y: e.target.y() });
  }, [updateNode]);

  const handleTransformEnd = useCallback((id, e) => {
    const t = e.target;
    updateNode(id, {
      x: t.x(), y: t.y(),
      scaleX: t.scaleX(), scaleY: t.scaleY(),
      rotation: t.rotation(),
    });
  }, [updateNode]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback((format, quality) => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({
      pixelRatio: exportMultiplier,
      mimeType: `image/${format}`,
      quality,
    });
    const ext = format === 'jpeg' ? 'jpg' : format;
    const a = document.createElement('a');
    a.href = uri;
    a.download = `mosaic-${platformId}-${Date.now()}.${ext}`;
    a.click();
  }, [exportMultiplier, platformId]);

  // ── Save to server ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage || !selectedImage) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const dataURL = stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
      const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
      const sceneGraph = {
        nodes: nodes.map(({ imageEl, ...n }) => n),
        platform: platformId,
      };
      const data = await editorApi.saveCanvas(
        selectedImage.id, null, base64, 'image/png', sceneGraph
      );
      onImageUpdated?.(data.image);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }, [selectedImage, nodes, platformId, onImageUpdated]);

  // ── Render nodes ──────────────────────────────────────────────────────────

  const commonProps = (node) => ({
    key: node.id,
    id: node.id,
    x: node.x,
    y: node.y,
    rotation: node.rotation ?? 0,
    opacity: node.visible ? (node.opacity ?? 1) : 0,
    draggable: node.draggable && node.id !== editingTextId,
    onClick: () => { if (node.id !== editingTextId) setSelectedId(node.id); },
    onTap: () => { if (node.id !== editingTextId) setSelectedId(node.id); },
    onDragEnd: (e) => handleDragEnd(node.id, e),
    onTransformEnd: (e) => handleTransformEnd(node.id, e),
    listening: node.visible,
  });

  function renderNode(node) {
    if (node.type === 'image') {
      const isBase = node.id === 'base';
      return (
        <KonvaImage
          {...commonProps(node)}
          ref={isBase ? baseImageRef : undefined}
          image={node.imageEl}
          width={node.width}
          height={node.height}
          scaleX={node.scaleX ?? 1}
          scaleY={node.scaleY ?? 1}
        />
      );
    }

    if (node.type === 'text') {
      const isEditing = node.id === editingTextId;
      return (
        <KonvaText
          {...commonProps(node)}
          text={isEditing ? '' : node.text}
          fontFamily={node.fontFamily}
          fontSize={node.fontSize}
          fontStyle={[
            node.fontWeight === 'bold' ? 'bold' : '',
            node.fontStyle === 'italic' ? 'italic' : '',
          ].filter(Boolean).join(' ') || 'normal'}
          fill={node.fill}
          align={node.align}
          width={node.width}
          wrap="word"
          onDblClick={() => startTextEdit(node)}
          onDblTap={() => startTextEdit(node)}
        />
      );
    }

    if (node.type === 'rect') {
      return (
        <KonvaRect
          {...commonProps(node)}
          width={node.width}
          height={node.height}
          fill={node.fill}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth ?? 0}
          cornerRadius={node.cornerRadius ?? 0}
        />
      );
    }

    if (node.type === 'circle') {
      return (
        <KonvaCircle
          {...commonProps(node)}
          radius={node.width / 2}
          fill={node.fill}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth ?? 0}
        />
      );
    }

    if (node.type === 'gradient') {
      const stops = node.colors.flatMap((c, i, arr) => [i / (arr.length - 1), c]);
      return (
        <KonvaRect
          {...commonProps(node)}
          width={node.width}
          height={node.height}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: node.height }}
          fillLinearGradientColorStops={stops}
          draggable={false}
          listening={false}
        />
      );
    }

    return null;
  }

  // ── Safe area overlay ─────────────────────────────────────────────────────

  function renderSafeArea() {
    if (!showSafeArea) return null;
    const profile = PLATFORM_PROFILES[platformId];
    const scale = displayW / profile.canvas.width;
    const sa = profile.safeArea;
    return (
      <KonvaRect
        key="__safe_area"
        x={sa.left * scale}
        y={sa.top * scale}
        width={(profile.canvas.width - sa.left - sa.right) * scale}
        height={(profile.canvas.height - sa.top - sa.bottom) * scale}
        fill="rgba(255,100,100,0.04)"
        stroke="rgba(255,100,100,0.75)"
        strokeWidth={1.5}
        dash={[6, 4]}
        listening={false}
      />
    );
  }

  if (!selectedImage) return null;

  return (
    <div className="flex gap-3">
      {/* Layer Panel */}
      <LayerPanel
        nodes={nodes}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          if (editingTextId) finishTextEdit();
        }}
        onToggleVisibility={toggleVisibility}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
        onRemove={removeNode}
      />

      {/* Canvas + toolbar */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Row 1: Platform selector + tools */}
        <div className="flex flex-wrap gap-2 items-center">
          <PlatformSelector platformId={platformId} onChange={setPlatformId} />

          <div className="flex flex-wrap gap-1.5 items-center ml-auto">
            <button onClick={addText}
              className="flex items-center gap-1 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-2.5 py-1.5 transition">
              <Type size={12} /> Text
            </button>

            <button onClick={addImageOverlay}
              className="flex items-center gap-1 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-2.5 py-1.5 transition">
              <ImagePlus size={12} /> Image
            </button>

            {/* Shape dropdown */}
            <div className="relative">
              <button onClick={() => setShowShapeMenu(v => !v)}
                className="flex items-center gap-1 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-2.5 py-1.5 transition">
                <Square size={12} /> Shape <ChevronDown size={10} />
              </button>
              {showShapeMenu && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden text-xs">
                  <button onClick={() => addShape('rect')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50">Rectangle</button>
                  <button onClick={() => addShape('circle')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50">Circle</button>
                </div>
              )}
            </div>

            <button onClick={addGradient}
              className="flex items-center gap-1 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-2.5 py-1.5 transition">
              <Layers size={12} /> Gradient
            </button>

            <select onChange={e => setBaseFilter(e.target.value)} value={baseFilter}
              className="text-xs bg-white border border-gray-300 hover:border-primary rounded-lg px-2 py-1.5 transition focus:outline-none">
              {FILTER_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            <button onClick={() => setShowSafeArea(v => !v)}
              className={`flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1.5 transition ${showSafeArea ? 'bg-red-50 border-red-400 text-red-600' : 'bg-white border-gray-300 hover:border-primary text-gray-700'}`}>
              <ShieldCheck size={12} /> Safe
            </button>

            <button onClick={() => removeNode(selectedId)} disabled={!selectedId || selectedId === 'base'}
              className="flex items-center gap-1 text-xs bg-white border border-gray-300 hover:border-red-400 text-gray-700 disabled:opacity-40 rounded-lg px-2.5 py-1.5 transition">
              <Trash2 size={12} /> Delete
            </button>

            <button onClick={() => setShowExport(true)}
              className="flex items-center gap-1 text-xs bg-white border border-gray-300 hover:border-primary text-gray-700 rounded-lg px-2.5 py-1.5 transition">
              <Download size={12} /> Export
            </button>

            <div className="flex items-center gap-2">
              {saveMsg && (
                <span className={`text-xs ${saveMsg.startsWith('Save failed') ? 'text-red-500' : 'text-emerald-600'}`}>
                  {saveMsg}
                </span>
              )}
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 text-xs bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition font-medium">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
              </button>
            </div>
          </div>
        </div>

        {/* Text toolbar */}
        {selectedNode?.type === 'text' && (
          <TextToolbar node={selectedNode} onUpdate={updateNode} onFontLoad={handleFontLoad} />
        )}

        {/* Konva Stage */}
        <div
          className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-900"
          style={{ width: displayW, maxWidth: '100%' }}
          onClick={() => setShowShapeMenu(false)}
        >
          <Stage
            ref={stageRef}
            width={displayW}
            height={displayH}
            onClick={(e) => { if (e.target === e.target.getStage()) { setSelectedId(null); } }}
            onTap={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          >
            <Layer>
              {nodes.map(renderNode)}
              {renderSafeArea()}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={false}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
              />
            </Layer>
          </Stage>
        </div>

        <p className="text-xs text-gray-400">
          Click to select · Drag to move · Handles to resize/rotate · Double-click text to edit
        </p>
      </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <textarea
        ref={textareaRef}
        onBlur={finishTextEdit}
        onKeyDown={(e) => { if (e.key === 'Escape') finishTextEdit(); }}
        className="hidden fixed z-50 bg-transparent border-none outline-none resize-none overflow-hidden leading-tight"
        style={{ display: 'none', minWidth: 20, minHeight: 20 }}
      />

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
