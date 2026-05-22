import { AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import { GOOGLE_FONTS, loadGoogleFont } from '../../lib/googleFonts.js';

export default function TextToolbar({ layer, onUpdate }) {
  if (!layer || layer.type !== 'text') return null;

  const { props } = layer;

  async function handleFontFamily(name) {
    await loadGoogleFont(name).catch(() => {});
    onUpdate(layer.id, { props: { fontFamily: name } });
  }

  function handleProp(key, value) {
    onUpdate(layer.id, { props: { [key]: value } });
  }

  function toggleWeight() {
    handleProp('fontWeight', props.fontWeight === '700' ? '400' : '700');
  }

  function toggleStyle() {
    handleProp('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic');
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs">
      {/* Font family */}
      <select
        value={props.fontFamily || 'Inter'}
        onChange={e => handleFontFamily(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-primary bg-white"
        style={{ fontFamily: props.fontFamily, maxWidth: 140 }}
      >
        {GOOGLE_FONTS.map(f => (
          <option key={f.name} value={f.name}>{f.name}</option>
        ))}
      </select>

      {/* Font size */}
      <input
        type="number"
        min={8}
        max={300}
        value={props.fontSize || 60}
        onChange={e => handleProp('fontSize', Number(e.target.value))}
        className="w-16 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-primary bg-white"
      />

      {/* Bold */}
      <button
        onClick={toggleWeight}
        className={`p-1.5 rounded-lg border transition ${props.fontWeight === '700' ? 'bg-primary text-white border-primary' : 'border-gray-300 hover:border-primary text-gray-700 bg-white'}`}
        title="Bold"
      >
        <Bold size={12} />
      </button>

      {/* Italic */}
      <button
        onClick={toggleStyle}
        className={`p-1.5 rounded-lg border transition ${props.fontStyle === 'italic' ? 'bg-primary text-white border-primary' : 'border-gray-300 hover:border-primary text-gray-700 bg-white'}`}
        title="Italic"
      >
        <Italic size={12} />
      </button>

      {/* Color */}
      <label className="flex items-center gap-1 cursor-pointer" title="Text color">
        <span className="text-gray-500">Color</span>
        <input
          type="color"
          value={props.color || '#ffffff'}
          onChange={e => handleProp('color', e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
        />
      </label>

      {/* Alignment */}
      <div className="flex rounded-lg border border-gray-300 overflow-hidden">
        {[
          { val: 'left', Icon: AlignLeft },
          { val: 'center', Icon: AlignCenter },
          { val: 'right', Icon: AlignRight },
        ].map(({ val, Icon }) => (
          <button
            key={val}
            onClick={() => handleProp('align', val)}
            className={`p-1.5 transition ${props.align === val ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            title={`Align ${val}`}
          >
            <Icon size={12} />
          </button>
        ))}
      </div>

      {/* Opacity */}
      <label className="flex items-center gap-1.5">
        <span className="text-gray-500 shrink-0">Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((layer.opacity ?? 1) * 100)}
          onChange={e => onUpdate(layer.id, { opacity: Number(e.target.value) / 100 })}
          className="w-20 accent-primary"
        />
        <span className="text-gray-500 w-6">{Math.round((layer.opacity ?? 1) * 100)}</span>
      </label>
    </div>
  );
}
