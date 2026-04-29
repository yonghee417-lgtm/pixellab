import { useProjectStore, type RightPanelTab } from '../store/projectStore';
import { PropertiesPanel } from './PropertiesPanel';
import { FiltersPanel } from './FiltersPanel';
import { FontsPanel } from './FontsPanel';
import { CanvasActionsPanel } from './CanvasActionsPanel';

const TABS: { key: RightPanelTab; label: string; icon: string }[] = [
  { key: 'properties', label: '속성', icon: '⚙' },
  { key: 'filters', label: '필터', icon: '✦' },
  { key: 'fonts', label: '폰트', icon: 'A' },
  { key: 'history', label: '캔버스', icon: '◰' },
];

export function RightPanel() {
  const tab = useProjectStore((s) => s.rightTab);
  const setTab = useProjectStore((s) => s.setRightTab);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-border-subtle bg-bg-panel">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-2 text-xs font-medium transition-colors border-b-2 ${
                active
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'properties' && <PropertiesPanel />}
        {tab === 'filters' && <FiltersPanel />}
        {tab === 'fonts' && <FontsPanel />}
        {tab === 'history' && <CanvasActionsPanel />}
      </div>
    </div>
  );
}
