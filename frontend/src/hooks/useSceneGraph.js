import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FabricImage, IText, Rect, Gradient } from 'fabric';
import { PLATFORM_PROFILES, getDisplaySize } from '../lib/platformProfiles.js';
import { loadGoogleFont } from '../lib/googleFonts.js';

const SAFE_AREA_ID = '__safe_area';

function makeLayer(type, name, partial = {}) {
  return {
    id: uuidv4(),
    type,
    name,
    visible: true,
    zIndex: 0,
    position: { xPercent: 0.1, yPercent: 0.1 },
    size: { widthPercent: 0.5, heightPercent: 0.15 },
    scale: 1,
    rotation: 0,
    opacity: 1,
    anchor: 'top-left',
    constraints: { safeAreaOnly: false, maintainAspectRatio: false },
    props: {},
    ...partial,
  };
}

export default function useSceneGraph(fabricRef) {
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [platformId, setPlatformIdState] = useState('instagram_feed');
  const [showSafeArea, setShowSafeArea] = useState(false);
  const syncing = useRef(false);

  const displaySize = getDisplaySize(platformId);
  const { displayW, displayH, exportMultiplier } = displaySize;

  // ── helpers ──────────────────────────────────────────────────────────────

  function toPixel(xPercent, yPercent) {
    return { x: xPercent * displayW, y: yPercent * displayH };
  }

  function toNorm(px, py) {
    return { xPercent: px / displayW, yPercent: py / displayH };
  }

  function getFabricObj(layerId) {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return canvas.getObjects().find(o => o.layerId === layerId) || null;
  }

  // ── safe area overlay ─────────────────────────────────────────────────────

  function removeSafeAreaOverlay() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const existing = canvas.getObjects().find(o => o.layerId === SAFE_AREA_ID);
    if (existing) canvas.remove(existing);
  }

  function drawSafeAreaOverlay(show) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    removeSafeAreaOverlay();
    if (!show) { canvas.renderAll(); return; }
    const profile = PLATFORM_PROFILES[platformId];
    const { safeArea } = profile;
    const scale = displayW / profile.canvas.width;
    const rect = new Rect({
      left: safeArea.left * scale,
      top: safeArea.top * scale,
      width: (profile.canvas.width - safeArea.left - safeArea.right) * scale,
      height: (profile.canvas.height - safeArea.top - safeArea.bottom) * scale,
      fill: 'rgba(255,100,100,0.04)',
      stroke: 'rgba(255,100,100,0.7)',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      layerId: SAFE_AREA_ID,
    });
    canvas.add(rect);
    canvas.bringObjectToFront(rect);
    canvas.renderAll();
  }

  // ── create fabric object from layer ──────────────────────────────────────

  async function createFabricObject(layer) {
    const { x, y } = toPixel(layer.position.xPercent, layer.position.yPercent);
    const w = layer.size.widthPercent * displayW;
    const h = layer.size.heightPercent * displayH;

    let obj;
    if (layer.type === 'image') {
      const src = layer.props.src;
      if (!src) return null;
      obj = await FabricImage.fromURL(src);
      const scaleX = w / obj.width;
      const scaleY = h / obj.height;
      obj.set({ scaleX, scaleY });
    } else if (layer.type === 'text') {
      if (layer.props.fontFamily) {
        await loadGoogleFont(layer.props.fontFamily).catch(() => {});
      }
      obj = new IText(layer.props.content || 'Text', {
        fontSize: (layer.props.fontSize || 40) * (displayW / 1080),
        fill: layer.props.color || '#ffffff',
        fontFamily: layer.props.fontFamily || 'Inter',
        fontWeight: layer.props.fontWeight || 'normal',
        fontStyle: layer.props.fontStyle || 'normal',
        textAlign: layer.props.align || 'left',
        lineHeight: layer.props.lineHeight || 1.2,
      });
    } else if (layer.type === 'shape') {
      const shapeType = layer.props.shapeType || 'rect';
      obj = new Rect({
        width: w,
        height: shapeType === 'circle' ? w : h,
        rx: shapeType === 'circle' ? w / 2 : 0,
        ry: shapeType === 'circle' ? w / 2 : 0,
        fill: layer.props.fill || 'rgba(255,255,255,0.3)',
        stroke: layer.props.stroke || '',
        strokeWidth: layer.props.strokeWidth || 0,
      });
    } else if (layer.type === 'gradient') {
      obj = new Rect({
        width: displayW,
        height: displayH,
        fill: new Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: { x1: 0, y1: 0, x2: 0, y2: displayH },
          colorStops: (layer.props.colors || ['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']).map((c, i, arr) => ({
            offset: i / (arr.length - 1),
            color: c,
          })),
        }),
        selectable: false,
        evented: false,
      });
    }

    if (!obj) return null;

    obj.set({
      left: x,
      top: y,
      angle: layer.rotation,
      opacity: layer.opacity,
      visible: layer.visible,
      layerId: layer.id,
    });

    return obj;
  }

  // ── reconcile all layers → fabric ─────────────────────────────────────────

  const reconcile = useCallback(async (nextLayers, nextShowSafeArea) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    syncing.current = true;

    const sorted = [...nextLayers].sort((a, b) => a.zIndex - b.zIndex);
    const existingIds = new Set(
      canvas.getObjects()
        .filter(o => o.layerId && o.layerId !== SAFE_AREA_ID)
        .map(o => o.layerId)
    );

    // Remove fabric objects for deleted layers
    const nextIds = new Set(sorted.map(l => l.id));
    for (const id of existingIds) {
      if (!nextIds.has(id)) {
        const obj = getFabricObj(id);
        if (obj) canvas.remove(obj);
      }
    }

    // Create or update
    for (let i = 0; i < sorted.length; i++) {
      const layer = sorted[i];
      let obj = getFabricObj(layer.id);
      if (!obj) {
        obj = await createFabricObject(layer);
        if (!obj) continue;
        canvas.add(obj);
      } else {
        // update position/size/transform
        const { x, y } = toPixel(layer.position.xPercent, layer.position.yPercent);
        obj.set({
          left: x,
          top: y,
          angle: layer.rotation,
          opacity: layer.opacity,
          visible: layer.visible,
        });
        // update text-specific props
        if (layer.type === 'text' && obj.type === 'i-text') {
          if (obj.text !== layer.props.content) obj.set('text', layer.props.content || '');
          obj.set({
            fill: layer.props.color || '#ffffff',
            fontFamily: layer.props.fontFamily || 'Inter',
            fontWeight: layer.props.fontWeight || 'normal',
            fontStyle: layer.props.fontStyle || 'normal',
            textAlign: layer.props.align || 'left',
            fontSize: (layer.props.fontSize || 40) * (displayW / 1080),
          });
        }
      }
      canvas.moveTo(obj, i);
    }

    // Safe area on top
    drawSafeAreaOverlay(nextShowSafeArea);
    canvas.renderAll();
    syncing.current = false;
  }, [fabricRef, displayW, displayH, platformId]); // eslint-disable-line

  // ── attach fabric event listeners (called once per canvas init) ───────────

  const attachEvents = useCallback((canvas) => {
    canvas.on('object:modified', ({ target: obj }) => {
      if (!obj?.layerId || obj.layerId === SAFE_AREA_ID || syncing.current) return;
      const norm = toNorm(obj.left, obj.top);
      setLayers(prev => prev.map(l =>
        l.id === obj.layerId
          ? {
              ...l,
              position: norm,
              size: {
                widthPercent: obj.getScaledWidth() / displayW,
                heightPercent: obj.getScaledHeight() / displayH,
              },
              rotation: obj.angle,
              opacity: obj.opacity,
              ...(l.type === 'text' ? { props: { ...l.props, content: obj.text } } : {}),
            }
          : l
      ));
    });

    canvas.on('selection:created', ({ selected }) => {
      const id = selected?.[0]?.layerId;
      if (id && id !== SAFE_AREA_ID) setSelectedLayerId(id);
    });
    canvas.on('selection:updated', ({ selected }) => {
      const id = selected?.[0]?.layerId;
      if (id && id !== SAFE_AREA_ID) setSelectedLayerId(id);
    });
    canvas.on('selection:cleared', () => setSelectedLayerId(null));
  }, [displayW, displayH]); // eslint-disable-line

  // ── public layer actions ──────────────────────────────────────────────────

  const addImageLayer = useCallback(async (src, name = 'Image') => {
    const id = uuidv4();
    const layer = makeLayer('image', name, {
      id,
      zIndex: layers.length,
      position: { xPercent: 0, yPercent: 0 },
      size: { widthPercent: 1, heightPercent: 1 },
      props: { src, fit: 'cover' },
    });
    const next = [...layers, layer];
    setLayers(next);
    await reconcile(next, showSafeArea);
    return layer;
  }, [layers, showSafeArea, reconcile]);

  const addTextLayer = useCallback(async () => {
    await loadGoogleFont('Inter').catch(() => {});
    const id = uuidv4();
    const layer = makeLayer('text', 'Text', {
      id,
      zIndex: layers.length,
      position: { xPercent: 0.1, yPercent: 0.4 },
      size: { widthPercent: 0.8, heightPercent: 0.1 },
      props: {
        content: 'Your text here',
        fontFamily: 'Inter',
        fontSize: 60,
        fontWeight: '700',
        fontStyle: 'normal',
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.2,
      },
    });
    const next = [...layers, layer];
    setLayers(next);
    await reconcile(next, showSafeArea);
    // select it
    const canvas = fabricRef.current;
    if (canvas) {
      const obj = canvas.getObjects().find(o => o.layerId === id);
      if (obj) canvas.setActiveObject(obj);
      canvas.renderAll();
    }
    setSelectedLayerId(id);
    return layer;
  }, [layers, showSafeArea, reconcile, fabricRef]);

  const addShapeLayer = useCallback(async (shapeType = 'rect') => {
    const id = uuidv4();
    const layer = makeLayer('shape', shapeType === 'circle' ? 'Circle' : 'Rectangle', {
      id,
      zIndex: layers.length,
      position: { xPercent: 0.2, yPercent: 0.2 },
      size: { widthPercent: 0.3, heightPercent: 0.3 },
      props: { shapeType, fill: 'rgba(255,255,255,0.3)', stroke: '#ffffff', strokeWidth: 2 },
    });
    const next = [...layers, layer];
    setLayers(next);
    await reconcile(next, showSafeArea);
    return layer;
  }, [layers, showSafeArea, reconcile]);

  const addGradientLayer = useCallback(async () => {
    const id = uuidv4();
    const layer = makeLayer('gradient', 'Gradient', {
      id,
      zIndex: layers.length,
      position: { xPercent: 0, yPercent: 0 },
      size: { widthPercent: 1, heightPercent: 1 },
      props: { colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)'], angle: 180 },
    });
    const next = [...layers, layer];
    setLayers(next);
    await reconcile(next, showSafeArea);
    return layer;
  }, [layers, showSafeArea, reconcile]);

  const removeLayer = useCallback(async (id) => {
    const next = layers.filter(l => l.id !== id);
    setLayers(next);
    if (selectedLayerId === id) setSelectedLayerId(null);
    await reconcile(next, showSafeArea);
  }, [layers, selectedLayerId, showSafeArea, reconcile]);

  const updateLayer = useCallback(async (id, patch) => {
    const next = layers.map(l => {
      if (l.id !== id) return l;
      const updated = {
        ...l,
        ...patch,
        props: patch.props ? { ...l.props, ...patch.props } : l.props,
      };
      return updated;
    });
    setLayers(next);
    await reconcile(next, showSafeArea);
  }, [layers, showSafeArea, reconcile]);

  const moveLayerUp = useCallback(async (id) => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx < 0 || idx === layers.length - 1) return;
    const next = layers.map(l => {
      if (l.id === id) return { ...l, zIndex: layers[idx + 1].zIndex + 1 };
      if (l.id === layers[idx + 1].id) return { ...l, zIndex: layers[idx].zIndex };
      return l;
    });
    setLayers(next);
    await reconcile(next, showSafeArea);
  }, [layers, showSafeArea, reconcile]);

  const moveLayerDown = useCallback(async (id) => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx <= 0) return;
    const next = layers.map(l => {
      if (l.id === id) return { ...l, zIndex: layers[idx - 1].zIndex - 1 };
      if (l.id === layers[idx - 1].id) return { ...l, zIndex: layers[idx].zIndex };
      return l;
    });
    setLayers(next);
    await reconcile(next, showSafeArea);
  }, [layers, showSafeArea, reconcile]);

  const toggleVisibility = useCallback(async (id) => {
    const next = layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
    setLayers(next);
    await reconcile(next, showSafeArea);
  }, [layers, showSafeArea, reconcile]);

  const toggleSafeArea = useCallback(async (value) => {
    const next = value !== undefined ? value : !showSafeArea;
    setShowSafeArea(next);
    drawSafeAreaOverlay(next);
  }, [showSafeArea, platformId, displayW, displayH]); // eslint-disable-line

  const setPlatform = useCallback(async (id) => {
    setPlatformIdState(id);
    // Reconcile will re-run with new display size on next render
  }, []);

  const resetLayers = useCallback(() => {
    setLayers([]);
    setSelectedLayerId(null);
  }, []);

  const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

  return {
    layers,
    selectedLayerId,
    setSelectedLayerId,
    selectedLayer,
    platformId,
    setPlatform,
    showSafeArea,
    toggleSafeArea,
    displaySize,
    exportMultiplier,
    addImageLayer,
    addTextLayer,
    addShapeLayer,
    addGradientLayer,
    removeLayer,
    updateLayer,
    moveLayerUp,
    moveLayerDown,
    toggleVisibility,
    attachEvents,
    reconcile,
    drawSafeAreaOverlay,
    resetLayers,
  };
}
