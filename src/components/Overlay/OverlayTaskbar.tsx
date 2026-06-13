// src/components/Overlay/OverlayTaskbar.tsx
//
// Taskbar contains:
//  - Eye button: hide/show all overlay windows (managed by app state, not OS minimize)
//  - List of minimized overlays (isMinimized = true in store)
//  - Plus button: add new overlay
//
// Uses Zustand store directly — DO NOT use setInterval polling IPC.

import React from 'react';
import {
  StickyNote,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  FileCode2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useOverlayStore, Overlay } from '../../stores/useOverlayStore';
import { OverlayPlusMenu } from './OverlayPlusMenu';

export const OverlayTaskbar: React.FC = () => {
  const { overlays, showAll, toggleShowAll, restoreOverlay, closeOverlay, currentFilePath } = useOverlayStore();

  // Get list of windows minimized by the app for the current active file
  // No need to poll IPC — Zustand state is the single source of truth
  const hiddenOverlays = overlays.filter((o) => o.isMinimized && o.filePath === currentFilePath);

  const getOverlayIcon = (type: Overlay['type']) => {
    const iconClass = "w-3.5 h-3.5 text-white/80 shrink-0";
    switch (type) {
      case 'scratchpad':
        return <StickyNote className={iconClass} strokeWidth={1.5} />;
      case 'notification':
        return <MessageSquare className={iconClass} strokeWidth={1.5} />;
      case 'md':
        return <FileText className={iconClass} strokeWidth={1.5} />;
      case 'image':
        return <ImageIcon className={iconClass} strokeWidth={1.5} />;
      case 'pdf':
        return <FileCode2 className={iconClass} strokeWidth={1.5} />;
      default:
        return <FileText className={iconClass} strokeWidth={1.5} />;
    }
  };

  return (
    <div className="w-full h-[24px] bg-[#007acc] border-t border-indigo-500/20 flex items-center justify-between px-3 select-none pointer-events-auto shrink-0 font-mono text-white">
      {/* Left section: Eye toggle + hidden windows list */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Eye toggle: Hide/show all non-hidden overlays */}
        <button
          onClick={toggleShowAll}
          className="p-0.5 rounded hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer flex items-center justify-center focus-visible-outline"
          title={showAll ? 'Hide all overlays' : 'Show all overlays'}
        >
          {showAll
            ? <Eye className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
            : <EyeOff className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
          }
        </button>

        {/* Divider */}
        <div className="w-px h-3.5 bg-white/20" />

        {/* Hidden overlay chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[calc(100%-80px)] py-0 scrollbar-none">
          {hiddenOverlays.length === 0 ? (
            <span className="text-[10px] text-white/45 font-bold uppercase tracking-wider pl-1 select-none">
              No hidden windows
            </span>
          ) : (
            hiddenOverlays.map((overlay) => (
              <div
                key={overlay.id}
                onClick={() => restoreOverlay(overlay.id)}
                className="group flex items-center gap-1 px-1.5 py-0.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-sm cursor-pointer transition-all duration-150 select-none h-[18px]"
                title={`Click to restore: ${overlay.title}`}
              >
                {getOverlayIcon(overlay.type)}
                <span className="text-[9px] font-bold text-white/90 max-w-[90px] truncate leading-none">
                  {overlay.title}
                </span>

                {/* Close (remove permanently) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeOverlay(overlay.id);
                  }}
                  className="p-px rounded hover:bg-red-500/25 text-white/40 hover:text-red-200 transition-colors cursor-pointer"
                  title="Close overlay"
                >
                  <X className="w-2.5 h-2.5" strokeWidth={1.5} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right section: Plus add button */}
      <div className="flex items-center pl-2 shrink-0">
        <OverlayPlusMenu />
      </div>
    </div>
  );
};
