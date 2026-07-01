// src/components/RightPanel/RightPanelTabs.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { PanelViewId, PANEL_VIEW_LABELS } from '../../types/panelLayout';
import { getPanelContent } from './getPanelContent';

const TAB_ICONS: Record<PanelViewId, string> = {
  explorer: 'files',
  snippets: 'symbol-method',
  stress: 'beaker',
  debug: 'debug-alt',
  testcase: 'checklist',
  codeforces: 'broadcast',
};

interface ContextMenuState {
  x: number;
  y: number;
  viewId: PanelViewId;
}

export const RightPanelTabs: React.FC = () => {
  const { rightTabs, activeRightTab, setActiveRightTab, moveToLeft } = useLayoutStore();
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

  const handleContextMenu = (e: React.MouseEvent, viewId: PanelViewId) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      viewId,
    });
  };

  const handleMoveToLeft = (viewId: PanelViewId) => {
    moveToLeft(viewId);
    setContextMenu(null);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-[var(--zcp-bg-sidebar)] select-none">
      {/* Tab bar header */}
      <div className="h-[30px] min-h-[30px] bg-[var(--zcp-bg-activitybar)] border-b border-[var(--zcp-border)] flex items-center px-1 overflow-x-auto scrollbar-none shrink-0">
        {rightTabs.map((viewId) => {
          const isActive = viewId === activeRightTab;
          const icon = TAB_ICONS[viewId] || 'symbol-property';
          const label = PANEL_VIEW_LABELS[viewId] || viewId;

          return (
            <div
              key={viewId}
              onClick={() => setActiveRightTab(viewId)}
              onContextMenu={(e) => handleContextMenu(e, viewId)}
              className={`relative h-[24px] px-2.5 mr-1 flex items-center gap-1.5 rounded-sm text-xs cursor-pointer transition-colors shrink-0 ${
                isActive
                  ? 'bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-text-active)] font-medium shadow-sm'
                  : 'text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)]'
              }`}
              title={`${label} (Right-click for options)`}
            >
              <span className={`codicon codicon-${icon} text-[13px]`} />
              <span>{label}</span>

              {/* Close tab button (if more than 1 tab) */}
              {rightTabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveToLeft(viewId);
                  }}
                  className="p-0.5 rounded hover:bg-neutral-700/60 text-[var(--zcp-text-secondary)] hover:text-white transition-colors ml-1"
                  title="Move back to Left Panel"
                >
                  <span className="codicon codicon-close text-[10px]" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {getPanelContent(activeRightTab)}
      </div>

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[9999] w-48 bg-[#252526] border border-[var(--zcp-border)] rounded shadow-xl py-1 text-xs text-neutral-200 font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] text-neutral-500 font-semibold uppercase tracking-wider border-b border-neutral-700/50 mb-1">
            {PANEL_VIEW_LABELS[contextMenu.viewId]}
          </div>
          <button
            onClick={() => handleMoveToLeft(contextMenu.viewId)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#04395e] hover:text-white transition-colors cursor-pointer"
          >
            <span className="codicon codicon-arrow-left text-indigo-400" />
            <span>Move to Left Panel</span>
          </button>
        </div>
      )}
    </div>
  );
};
