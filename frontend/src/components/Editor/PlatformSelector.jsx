import { PLATFORM_LIST, PLATFORM_PROFILES } from '../../lib/platformProfiles.js';

export default function PlatformSelector({ platformId, onChange }) {
  const profile = PLATFORM_PROFILES[platformId];
  const { width, height } = profile?.canvas || {};

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 font-medium shrink-0">Platform</label>
      <select
        value={platformId}
        onChange={e => onChange(e.target.value)}
        className="text-xs bg-white border border-gray-300 hover:border-primary rounded-lg px-2 py-1.5 transition focus:outline-none focus:border-primary"
      >
        {PLATFORM_LIST.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      {width && height && (
        <span className="text-xs text-gray-400">{width}×{height}</span>
      )}
    </div>
  );
}
