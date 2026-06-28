// src/components/Overlay/StandaloneOverlayWindow.tsx
//
// Child window cho overlay-widget-* windows.
// KIẾN TRÚC: Child window KHÔNG tự gọi store actions.
// Mọi nút đều emit 'floating-window-action' → Main window nhận và xử lý.
// Main window là owner duy nhất của mọi side effects (DB, IPC, state).

import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen } from '@tauri-apps/api/event';
import { Pin, Minus, Maximize2, X, Copy } from 'lucide-react';
import { useOverlayStore } from '../../stores/useOverlayStore';
import { OverlayWidgetRenderer } from './OverlayWidgetRenderer';
import { loadSession } from '../../lib/tauri-bridge';

// Kiểu action gửi về main window
export type FloatingWindowActionPayload =
  | { action: 'close'; windowLabel: string }
  | { action: 'minimize'; windowLabel: string }
  | { action: 'toggle-maximize'; windowLabel: string }
  | { action: 'toggle-pin'; windowLabel: string };

interface StandaloneOverlayWindowProps {
  overlayId: string;
}

export const StandaloneOverlayWindow: React.FC<StandaloneOverlayWindowProps> = ({ overlayId }) => {
  const appWindow = getCurrentWindow();
  const { overlays, syncOverlays } = useOverlayStore();
  const [isMaximized, setIsMaximized] = useState(false);

  // ── Init: load overlay data từ DB vào store của child window ──────────────
  useEffect(() => {
    async function init() {
      const session = await loadSession();
      if (session.activeFile) {
        await syncOverlays(session.activeFile);
      }
    }
    init();

    // Theo dõi maximize state cho icon
    const unlistenResize = appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });
    appWindow.isMaximized().then(setIsMaximized);

    // Sync khi main window cập nhật DB
    const unlistenUpdate = listen('overlays-updated', async () => {
      const session = await loadSession();
      if (session.activeFile) await syncOverlays(session.activeFile);
    });

    return () => {
      unlistenResize.then((fn) => fn());
      unlistenUpdate.then((fn) => fn());
    };
  }, [overlayId]);

  const overlay = overlays.find((o) => o.id === overlayId);

  // Sync isPinned state → apply always-on-top ngay tại child window
  useEffect(() => {
    if (overlay) {
      appWindow.setAlwaysOnTop(overlay.isPinned).catch(console.error);
    }
  }, [overlay?.isPinned]);

  // ── Helpers: emit về main window ──────────────────────────────────────────
  const sendAction = (action: FloatingWindowActionPayload['action']) => {
    emit('floating-window-action', {
      action,
      windowLabel: appWindow.label,
    } satisfies FloatingWindowActionPayload).catch(console.error);
  };

  if (!overlay) {
    return (
      <div className="flex h-screen w-screen bg-[#2a2a2a] text-neutral-500 items-center justify-center text-xs font-sans select-none">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#2a2a2a] text-neutral-100 overflow-hidden font-sans select-none rounded-sm border border-[#2b2b2b]">

      {/* ── Custom Titlebar (Drag Region) ────────────────────────────────── */}
      <div
        className="flex items-center justify-between h-8 bg-[#202020] border-b border-[#2b2b2b] shrink-0 cursor-move"
        data-tauri-drag-region
        onDoubleClick={() => sendAction('toggle-maximize')}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-2 pl-3 min-w-0 pointer-events-none" data-tauri-drag-region>
          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" data-tauri-drag-region />
          <span className="text-xs font-semibold text-neutral-200 truncate max-w-[180px]" data-tauri-drag-region>
            {overlay.title}
          </span>
        </div>

        {/* Right: control buttons — không dùng drag region */}
        <div className="flex items-stretch h-full" onDoubleClick={(e) => e.stopPropagation()}>

          {/* Pin */}
          <button
            onClick={() => sendAction('toggle-pin')}
            className={`w-9 h-full flex items-center justify-center transition-colors ${
              overlay.isPinned
                ? 'text-indigo-400 hover:bg-[#2b2d2e]'
                : 'text-neutral-500 hover:bg-[#2b2d2e] hover:text-neutral-200'
            }`}
            title={overlay.isPinned ? 'Unpin (Always on Top)' : 'Pin (Always on Top)'}
          >
            <Pin className={`w-3 h-3 ${overlay.isPinned ? 'fill-indigo-400/30' : ''}`} strokeWidth={1.5} />
          </button>

          {/* Minimize → ẩn vào OverlayTaskbar */}
          <button
            onClick={() => sendAction('minimize')}
            className="w-9 h-full flex items-center justify-center text-neutral-500 hover:bg-[#2b2d2e] hover:text-neutral-200 transition-colors"
            title="Minimize to Taskbar"
          >
            <Minus className="w-3 h-3" strokeWidth={1.5} />
          </button>

          {/* Maximize / Restore */}
          <button
            onClick={() => sendAction('toggle-maximize')}
            className="w-9 h-full flex items-center justify-center text-neutral-500 hover:bg-[#2b2d2e] hover:text-neutral-200 transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized
              ? <Copy className="w-3 h-3" strokeWidth={1.5} />
              : <Maximize2 className="w-3 h-3" strokeWidth={1.5} />
            }
          </button>

          {/* Close → xoá khỏi DB */}
          <button
            onClick={() => sendAction('close')}
            className="w-9 h-full flex items-center justify-center text-neutral-500 hover:bg-red-600 hover:text-white transition-colors"
            title="Close and delete"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Widget Content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-[#2a2a2a] text-neutral-300 relative text-sm flex flex-col">
        <OverlayWidgetRenderer overlay={overlay} />
      </div>
    </div>
  );
};
