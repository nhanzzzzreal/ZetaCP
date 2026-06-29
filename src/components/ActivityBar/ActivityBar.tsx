import React from 'react';
import { useOverlayStore } from '../../stores/useOverlayStore';

interface ActivityBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  leftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  onOpenSettings: () => void;
  onOpenDocs: (docsType: 'cp-algorithms') => void;
}

const SIDEBAR_ITEMS = [
  { id: 'explorer', icon: 'files', label: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search', icon: 'search', label: 'Search (Ctrl+Shift+F)' },
  { id: 'debug', icon: 'debug-alt', label: 'Run and Debug (Ctrl+Shift+D)' },
  { id: 'snippets', icon: 'symbol-method', label: 'Snippets' },
  { id: 'stress', icon: 'beaker', label: 'Stress Tester' },
];

const OVERLAY_TOOLS = [
  { type: 'graph', icon: 'type-hierarchy', label: 'Graph Visualizer (New Window)' },
  { type: 'fileviewer', icon: 'file', label: 'File Viewer — Image / PDF / Markdown / Word (New Window)' },
  { type: 'notes', icon: 'notebook', label: 'Text Notes (New Window)' },
  { type: 'scratchpad', icon: 'pencil', label: 'Sketchpad (New Window)' },
];

const ActiveIndicator: React.FC = () => (
  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--zcp-text-active)]" />
);

const Divider: React.FC = () => (
  <div className="w-7 h-[1px] bg-neutral-600 my-2 self-center shrink-0" />
);

const BAR_BTN_BASE =
  'relative w-full h-[var(--zcp-activitybar-width)] flex items-center justify-center cursor-pointer transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] hover:bg-[var(--zcp-hover-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)]';

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  setActiveTab,
  leftPanelOpen,
  onToggleLeftPanel,
  onOpenSettings,
  onOpenDocs,
}) => {
  const isCalcOpen = useOverlayStore((s) =>
    s.overlays.some((o) => o.type === 'calculator' && o.isVisible && !o.isMinimized)
  );

  const handleTabClick = (tabId: string) => {
    if (activeTab === tabId && leftPanelOpen) {
      onToggleLeftPanel();
    } else {
      setActiveTab(tabId);
      if (!leftPanelOpen) onToggleLeftPanel();
    }
  };

  const handleAddOverlay = (type: string) => {
    useOverlayStore.getState().addOverlay(type);
  };

  return (
    <div className="w-[var(--zcp-activitybar-width)] bg-[var(--zcp-bg-activitybar)] flex flex-col justify-between items-center border-r border-[var(--zcp-border)] select-none shrink-0 h-full font-[var(--zcp-font-ui)]">

      {/* ── Top: Sidebar nav items ── */}
      <div className="flex flex-col w-full">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeTab === item.id && leftPanelOpen;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`${BAR_BTN_BASE} ${
                isActive
                  ? 'text-[var(--zcp-text-active)]'
                  : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
              }`}
              title={item.label}
            >
              {isActive && <ActiveIndicator />}
              <span className={`codicon codicon-${item.icon}`} style={{ fontSize: 24 }} />
            </button>
          );
        })}

        <Divider />

        {/* ── Overlay Tools: Calculator (single-instance toggle) ── */}
        <button
          onClick={() => useOverlayStore.getState().toggleCalculator()}
          className={`${BAR_BTN_BASE} ${
            isCalcOpen
              ? 'text-[var(--zcp-text-active)]'
              : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
          }`}
          title="CP Calculator (Toggle)"
        >
          {isCalcOpen && <ActiveIndicator />}
          <span className="codicon codicon-symbol-numeric" style={{ fontSize: 24 }} />
        </button>

        {/* ── Overlay Tools: multi-instance ── */}
        {OVERLAY_TOOLS.map((tool) => (
          <button
            key={tool.type}
            onClick={() => handleAddOverlay(tool.type)}
            className={`${BAR_BTN_BASE} text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]`}
            title={tool.label}
          >
            <span className={`codicon codicon-${tool.icon}`} style={{ fontSize: 22 }} />
          </button>
        ))}
      </div>

      {/* ── Bottom: Docs + Settings ── */}
      <div className="w-full flex flex-col">
        <button
          onClick={() => onOpenDocs('cp-algorithms')}
          className={`${BAR_BTN_BASE} text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]`}
          title="CP Algorithms Reference"
        >
          <span className="codicon codicon-library" style={{ fontSize: 24 }} />
        </button>

        <Divider />

        <button
          onClick={onOpenSettings}
          className={`${BAR_BTN_BASE} text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]`}
          title="Settings"
        >
          <span className="codicon codicon-settings-gear" style={{ fontSize: 24 }} />
        </button>
      </div>
    </div>
  );
};
