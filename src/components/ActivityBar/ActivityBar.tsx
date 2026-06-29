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

  const items = [
    { id: 'explorer', icon: 'files', label: 'Explorer (Ctrl+Shift+E)' },
    { id: 'search', icon: 'search', label: 'Search (Ctrl+Shift+F)' },
    { id: 'debug', icon: 'debug-alt', label: 'Run and Debug (Ctrl+Shift+D)' },
    { id: 'snippets', icon: 'symbol-method', label: 'Snippets' },
    { id: 'stress', icon: 'beaker', label: 'Stress Tester' },
  ];

  const handleTabClick = (tabId: string) => {
    if (activeTab === tabId && leftPanelOpen) {
      onToggleLeftPanel();
    } else {
      setActiveTab(tabId);
      if (!leftPanelOpen) {
        onToggleLeftPanel();
      }
    }
  };

  return (
    <div className="w-[var(--zcp-activitybar-width)] bg-[var(--zcp-bg-activitybar)] flex flex-col justify-between items-center border-r border-[var(--zcp-border)] select-none shrink-0 h-full font-[var(--zcp-font-ui)]">
      {/* Top Icons */}
      <div className="flex flex-col w-full">
        {items.map((item) => {
          const isActive = activeTab === item.id && leftPanelOpen;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`relative w-full h-[var(--zcp-activitybar-width)] flex items-center justify-center cursor-pointer transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] hover:bg-[var(--zcp-hover-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)] ${
                isActive ? 'text-[var(--zcp-text-active)]' : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
              }`}
              title={item.label}
            >
              {/* Active Indicator Line */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--zcp-text-active)]" />
              )}
              
              <span className={`codicon codicon-${item.icon}`} style={{ fontSize: 24 }} />
            </button>
          );
        })}

        {/* CP Calculator Floating Window Button in Top Section */}
        <button
          onClick={() => useOverlayStore.getState().toggleCalculator()}
          className={`relative w-full h-[var(--zcp-activitybar-width)] flex items-center justify-center cursor-pointer transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] hover:bg-[var(--zcp-hover-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)] ${
            isCalcOpen ? 'text-[var(--zcp-text-active)]' : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
          }`}
          title="CP Calculator (Floating Window)"
        >
          {isCalcOpen && (
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--zcp-text-active)]" />
          )}
          <span className="codicon codicon-symbol-numeric" style={{ fontSize: 24 }} />
        </button>
      </div>

      {/* Bottom Icons (Docs + Settings) */}
      <div className="w-full flex flex-col">
        {/* Offline Documentation Buttons */}
        <button
          onClick={() => onOpenDocs('cp-algorithms')}
          className="relative w-full h-[var(--zcp-activitybar-width)] flex items-center justify-center cursor-pointer text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)]"
          title="CP Algorithms Reference"
        >
          <span className="codicon codicon-library" style={{ fontSize: 24 }} />
        </button>

        {/* Divider line for Settings */}
        <div className="w-5 h-[1px] bg-[var(--zcp-border)]/50 self-center my-1" />

        <button
          onClick={onOpenSettings}
          className="w-full h-[var(--zcp-activitybar-width)] flex items-center justify-center cursor-pointer text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)]"
          title="Settings"
        >
          <span className="codicon codicon-settings-gear" style={{ fontSize: 24 }} />
        </button>
      </div>
    </div>
  );
};
