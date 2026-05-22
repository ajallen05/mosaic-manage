import { AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import { GOOGLE_FONTS } from '../../lib/googleFonts.js';

export default function TextToolbar({ node, onUpdate, onFontLoad }) {
  if (!node || node.type !== 'text') return null;

  async function handleFontFamily(name) {
    await onFontLoad?.(name).catch(() => {});
    onUpdate(node.id, { fontFamily: name });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs">
      {/* Text content */}
      <input
        type="text"
        value={node.text}
        onChange={e => onUpdate(node.id, { text: e.target.value })}
        placeholder="Text content"
        className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-primary bg-white min-w-0 w-36"
      />

      {/* Font family */}
      <select
        value={node.fontFamily || 'Inter'}
        onChange={e => handleFontFamily(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-primary bg-white"
        style={{ fontFamily: node.fontFamily, maxWidth: 140 }}
      >
        {GOOGLE_FONTS.map(f => (
          <option key={f.name} value={f.name}>{f.name}</option>
        ))}
      </select>

      {/* Font size */}
      <input
        type="number"
        min={6}
        max={400}
        value={node.fontSize || 40}
        onChange={e => onUpdate(node.id, { fontSize: Number(e.target.value) })}
        className="w-16 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-primary bg-white"
      />

      {/* Bold */}
      <button
        onClick={() => onUpdate(node.id, { fontWeight: node.fontWeight === 'bold' ? 'normal' : 'bold' })}
        className={`p-1.5 rounded-lg border transition ${node.fontWeight === 'bold' ? 'bg-primary text-white border-primary' : 'border-gray-300 hover:border-primary text-gray-700 bg-white'}`}
      >
        <Bold size={12} />
      </button>

      {/* Italic */}
      <button
        onClick={() => onUpdate(node.id, { fontStyle: node.fontStyle === 'italic' ? 'normal' : 'italic' })}
        className={`p-1.5 rounded-lg border transition ${node.fontStyle === 'italic' ? 'bg-primary text-white border-primary' : 'border-gray-300 hover:border-primary text-gray-700 bg-white'}`}
      >
        <Italic size={12} />
      </button>

      {/* Color */}
      <label className="flex items-center gap-1 cursor-pointer">
        <span className="text-gray-500">Color</span>
        <input
          type="color"
          value={node.fill || '#ffffff'}
          onChange={e => onUpdate(node.id, { fill: e.target.value })}
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
            onClick={() => onUpdate(node.id, { align: val })}
            className={`p-1.5 transition ${node.align === val ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            <Icon size={12} />
          </button>
        ))}
      </div>

      {/* Opacity */}
      <label className="flex items-center gap-1.5">
        <span className="text-gray-500 shrink-0">Opacity</span>
        <input
          type="range" min={0} max={100}
          value={Math.round((node.opacity ?? 1) * 100)}
          onChange={e => onUpdate(node.id, { opacity: Number(e.target.value) / 100 })}
          className="w-20 accent-primary"
        />
        <span className="text-gray-400 w-6">{Math.round((node.opacity ?? 1) * 100)}</span>
      </label>
    </div>
  );
}
