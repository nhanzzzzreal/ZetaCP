import React, { useState, useRef, useEffect } from 'react';
import { useOverlayStore } from '../../stores/useOverlayStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { PanelViewId } from '../../types/panelLayout';

interface ActivityBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  leftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenDocs: (docsType: 'cp-algorithms') => void;
}

const SIDEBAR_ITEMS: { id: PanelViewId; icon: string; label: string }[] = [
  { id: 'explorer', icon: 'files', label: 'Explorer (Ctrl+Shift+E)' },
  { id: 'debug', icon: 'debug-alt', label: 'Run and Debug (Ctrl+Shift+D)' },
  { id: 'snippets', icon: 'symbol-method', label: 'Snippets' },
  { id: 'stress', icon: 'beaker', label: 'Stress Tester' },
  { id: 'testcase', icon: 'checklist', label: 'Testcase Manager' },
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
  'relative w-full h-[var(--zcp-activitybar-width)] min-h-[var(--zcp-activitybar-width)] shrink-0 flex items-center justify-center cursor-pointer transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] hover:bg-[var(--zcp-hover-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcp-focus-border)]';

interface ContextMenuState {
  x: number;
  y: number;
  viewId: PanelViewId;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  setActiveTab,
  leftPanelOpen,
  onToggleLeftPanel,
  rightPanelOpen,
  setRightPanelOpen,
  onOpenSettings,
  onOpenDocs,
}) => {
  const isCalcOpen = useOverlayStore((s) =>
    s.overlays.some((o) => o.type === 'calculator' && o.isVisible && !o.isMinimized)
  );

  const { rightTabs, moveToRight, moveToLeft, setActiveRightTab } = useLayoutStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleTabClick = (tabId: PanelViewId) => {
    if (rightTabs.includes(tabId)) {
      const currentActiveRight = useLayoutStore.getState().activeRightTab;
      if (currentActiveRight === tabId && rightPanelOpen) {
        setRightPanelOpen(false);
      } else {
        setActiveRightTab(tabId);
        if (!rightPanelOpen) setRightPanelOpen(true);
      }
    } else {
      if (activeTab === tabId && leftPanelOpen) {
        onToggleLeftPanel();
      } else {
        setActiveTab(tabId);
        if (!leftPanelOpen) onToggleLeftPanel();
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, viewId: PanelViewId) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      viewId,
    });
  };

  const handleAddOverlay = (type: string) => {
    useOverlayStore.getState().addOverlay(type);
  };

  return (
    <div className="w-[var(--zcp-activitybar-width)] bg-[var(--zcp-bg-activitybar)] flex flex-col justify-between items-center border-r border-[var(--zcp-border)] select-none shrink-0 h-full font-[var(--zcp-font-ui)] overflow-hidden">
      {/* ── Top: Sidebar nav items & tools (Scrollable) ── */}
      <div className="flex flex-col w-full overflow-y-auto scrollbar-none flex-1 min-h-0 py-1">
        {SIDEBAR_ITEMS.map((item) => {
          const inRight = rightTabs.includes(item.id);
          const isActive = inRight
            ? rightPanelOpen && useLayoutStore.getState().activeRightTab === item.id
            : activeTab === item.id && leftPanelOpen;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              onContextMenu={(e) => handleContextMenu(e, item.id)}
              className={`${BAR_BTN_BASE} ${
                isActive
                  ? 'text-[var(--zcp-text-active)]'
                  : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
              }`}
              title={`${item.label}${inRight ? ' (In Right Panel)' : ''}`}
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

      {/* ── Bottom: Docs + Settings (Fixed) ── */}
      <div className="w-full flex flex-col shrink-0 pb-1">
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

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[9999] w-48 bg-[#252526] border border-[var(--zcp-border)] rounded shadow-xl py-1 text-xs text-neutral-200 font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          {rightTabs.includes(contextMenu.viewId) ? (
            <button
              onClick={() => {
                moveToLeft(contextMenu.viewId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#04395e] hover:text-white transition-colors cursor-pointer"
            >
              <span className="codicon codicon-arrow-left text-indigo-400" />
              <span>Move to Left Panel</span>
            </button>
          ) : (
            <button
              onClick={() => {
                moveToRight(contextMenu.viewId);
                if (!rightPanelOpen) setRightPanelOpen(true);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#04395e] hover:text-white transition-colors cursor-pointer"
            >
              <span className="codicon codicon-arrow-right text-indigo-400" />
              <span>Move to Right Panel</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
