// src/components/ActivityBar/ActivityBar.tsx

import React from 'react';

interface ActivityBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  leftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  onOpenSettings: () => void;
  onOpenDocs: (docsType: 'cp-algorithms' | 'cppreference') => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  setActiveTab,
  leftPanelOpen,
  onToggleLeftPanel,
  onOpenSettings,
  onOpenDocs,
}) => {
  const items = [
    { id: 'explorer', icon: 'files', label: 'Explorer (Ctrl+Shift+E)' },
    { id: 'search', icon: 'search', label: 'Search (Ctrl+Shift+F)' },
    { id: 'debug', icon: 'debug-alt', label: 'Run and Debug (Ctrl+Shift+D)' },
    { id: 'snippets', icon: 'symbol-method', label: 'Snippets' },
  ];

  const handleTabClick = (tabId: string) => {
    if (activeTab === tabId) {
      onToggleLeftPanel();
    } else {
      setActiveTab(tabId);
      if (!leftPanelOpen) {
        onToggleLeftPanel();
      }
    }
  };

  return (
    <div className="w-[36px] bg-[var(--zcp-bg-activitybar)] flex flex-col justify-between items-center py-2 border-r border-[var(--zcp-border)] select-none shrink-0 h-full font-mono">
      {/* Top Icons */}
      <div className="flex flex-col w-full gap-2">
        {items.map((item) => {
          const isActive = activeTab === item.id && leftPanelOpen;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`relative w-full h-[36px] flex items-center justify-center cursor-pointer text-[18px] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] hover:bg-[var(--zcp-hover-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)] ${
                isActive ? 'text-[var(--zcp-text-active)]' : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
              }`}
              title={item.label}
            >
              {/* Active Indicator Line */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--zcp-text-active)]" />
              )}
              
              <span className={`codicon codicon-${item.icon}`} />
            </button>
          );
        })}
      </div>

      {/* Bottom Icons (Docs + Settings) */}
      <div className="w-full flex flex-col gap-1.5 pb-1">
        {/* Offline Documentation Buttons */}
        <button
          onClick={() => onOpenDocs('cp-algorithms')}
          className="relative w-full h-[36px] flex items-center justify-center cursor-pointer text-[17px] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)]"
          title="CP Algorithms Reference"
        >
          <span className="codicon codicon-library" />
        </button>
        <button
          onClick={() => onOpenDocs('cppreference')}
          className="relative w-full h-[36px] flex items-center justify-center cursor-pointer text-[17px] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)]"
          title="C++ Reference"
        >
          <span className="codicon codicon-code" />
        </button>

        {/* Divider line for Settings */}
        <div className="w-5 h-[1px] bg-[var(--zcp-border)]/50 self-center my-1" />

        <button
          onClick={onOpenSettings}
          className="w-full h-[36px] flex items-center justify-center cursor-pointer text-[18px] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)]"
          title="Settings"
        >
          <span className="codicon codicon-settings-gear" />
        </button>
      </div>
    </div>
  );
};
