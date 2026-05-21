import FlowIndicator from './FlowIndicator.jsx';
import GeneratePanel from '../Generate/GeneratePanel.jsx';
import EditorPanel from '../Editor/EditorPanel.jsx';
import CaptionsPanel from '../Captions/CaptionsPanel.jsx';
import SocialConnections from '../Social/SocialConnections.jsx';
import PublishPanel from '../Publish/PublishPanel.jsx';
import useAppStore from '../../store/useAppStore.js';

const PANELS = {
  generate: GeneratePanel,
  edit: EditorPanel,
  captions: CaptionsPanel,
  social: SocialConnections,
  publish: PublishPanel,
};

export default function DashboardLayout() {
  const activeTab = useAppStore(s => s.activeTab);
  const ActivePanel = PANELS[activeTab] || GeneratePanel;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm">
            M
          </div>
          <span className="font-semibold text-gray-900">Mosaic Manage</span>
        </div>
      </header>

      {/* Flow indicator */}
      <FlowIndicator />

      {/* Active panel */}
      <main className="flex-1 overflow-auto p-6">
        <ActivePanel />
      </main>
    </div>
  );
}
