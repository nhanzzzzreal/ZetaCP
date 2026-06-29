// src/components/StatusBar/StatusBar.tsx

import React from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useOverlayStore } from '../../stores/useOverlayStore';
import { NotificationBell } from '../Notifications/NotificationCenter';

export const StatusBar: React.FC = () => {
  const activeFile = useProjectStore((s) => s.activeFile);
  const cursorPos = useProjectStore((s) => s.cursorPos);
  const {
    overlays,
    showAll,
    toggleShowAll,
    restoreOverlay,
    closeOverlay,
    currentFilePath,
  } = useOverlayStore();

  const activePath = currentFilePath || activeFile;
  const hiddenOverlays = overlays.filter((o) => o.isMinimized && o.filePath === activePath);

  // Simple language mapping based on file extension
  const getLanguageLabel = (file: string | null) => {
    if (!file) return 'Plain Text';
    const ext = file.split('.').pop()?.toLowerCase();
    if (ext === 'cpp' || ext === 'cc' || ext === 'h') return 'C++';
    if (ext === 'py') return 'Python';
    if (ext === 'txt') return 'Plain Text';
    if (ext === 'md') return 'Markdown';
    return ext ? ext.toUpperCase() : 'Plain Text';
  };

  const getOverlayIconClass = (type: string) => {
    switch (type) {
      case 'scratchpad':
        return 'codicon-brush';
      case 'notes':
      case 'notification':
        return 'codicon-notebook';
      case 'md':
        return 'codicon-markdown';
      case 'image':
        return 'codicon-image';
      case 'pdf':
        return 'codicon-file-pdf';
      case 'calculator':
        return 'codicon-calculator';
      default:
        return 'codicon-book';
    }
  };

  return (
    <div className="h-[var(--zcp-statusbar-height)] bg-[var(--zcp-bg-statusbar)] text-[var(--zcp-text-active)] flex justify-between items-center px-3 select-none text-[12px] font-ui z-50 shrink-0">
      {/* Left side: Minimized Overlays list */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Eye toggle: Hide/show all non-hidden overlays */}
        <button
          onClick={toggleShowAll}
          className="p-0.5 rounded hover:bg-[rgba(255,255,255,0.15)] text-[var(--zcp-text-active)]/80 hover:text-[var(--zcp-text-active)] transition-all cursor-pointer flex items-center justify-center focus-visible-outline shrink-0"
          title={showAll ? 'Hide all overlays' : 'Show all overlays'}
        >
          <span className={`codicon ${showAll ? 'codicon-eye' : 'codicon-eye-closed'} text-[13px]`} />
        </button>

        {/* Minimized Overlays List */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[calc(100%-180px)] py-0 scrollbar-none">
          {hiddenOverlays.length === 0 ? (
            <span className="text-[10px] text-[var(--zcp-text-active)]/45 font-medium uppercase tracking-wider pl-1 select-none">
              No hidden windows
            </span>
          ) : (
            hiddenOverlays.map((overlay) => (
              <div
                key={overlay.id}
                onClick={() => restoreOverlay(overlay.id)}
                className="group flex items-center gap-1 px-1.5 py-0.5 bg-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.25)] border border-[rgba(255,255,255,0.2)] rounded-sm cursor-pointer transition-all duration-150 select-none h-[18px] shrink-0"
                title={`Click to restore: ${overlay.title}`}
              >
                <span className={`codicon ${getOverlayIconClass(overlay.type)} text-[12px] shrink-0 flex items-center`} />
                <span className="text-[10px] font-normal text-[var(--zcp-text-active)]/90 max-w-[90px] truncate leading-none">
                  {overlay.title}
                </span>

                {/* Close (remove permanently) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeOverlay(overlay.id);
                  }}
                  className="p-px rounded hover:bg-red-500/25 text-[var(--zcp-text-active)]/45 hover:text-red-200 transition-colors cursor-pointer flex items-center justify-center"
                  title="Close overlay"
                >
                  <span className="codicon codicon-close text-[10px]" />
                </button>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Right side: cursor pos, spaces, encoding, language */}
      <div className="flex items-center gap-3 shrink-0">
        {activeFile && (
          <>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
            </div>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>Spaces: 4</span>
            </div>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>UTF-8</span>
            </div>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>{getLanguageLabel(activeFile)}</span>
            </div>
          </>
        )}
        <NotificationBell />
      </div>
    </div>
  );
};

