// src/components/Notifications/NotificationCenter.tsx

import React, { useEffect, useRef } from 'react';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { ToastItem } from './ToastItem';

// ── Z-index: dưới pinned overlay (zIndex+10000 ≈ 10001+), trên mọi thứ còn lại
const Z_NOTIFICATION = 9000;

// ── History Panel ─────────────────────────────────────────────────────────────
const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notifications, dismiss, dismissAll } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside đóng panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay nhỏ để tránh click mở ngay đóng luôn
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full right-0 mb-1 w-[340px] max-h-[480px] flex flex-col
                 bg-[#1e1e1e]/98 border border-white/10 rounded-[var(--zcp-radius-sm)]
                 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden
                 animate-in slide-in-from-bottom-2 fade-in duration-200"
      style={{ zIndex: Z_NOTIFICATION }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider font-mono">
          Notifications
        </span>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              onClick={dismissAll}
              className="text-[10px] text-white/40 hover:text-white/80 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer font-mono"
              title="Xóa tất cả"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
          >
            <span className="codicon codicon-close text-[12px]" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 p-2 flex flex-col gap-1.5">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25 select-none">
            <span className="codicon codicon-bell-slash text-[28px]" />
            <span className="text-[11px] font-mono">Không có thông báo</span>
          </div>
        ) : (
          notifications.map((n) => (
            <ToastItem key={n.id} notification={n} onDismiss={dismiss} inPanel />
          ))
        )}
      </div>
    </div>
  );
};

// ── Toast Stack (floating, bottom-right) ──────────────────────────────────────
const ToastStack: React.FC = () => {
  const { notifications, dismiss } = useNotificationStore();

  // Chỉ hiện toast chưa read và autoDismiss (info/success) hoặc mới xuất hiện (<6s)
  const visibleToasts = notifications.filter((n) => {
    if (n.read) return false;
    const age = Date.now() - n.timestamp;
    // error/warn: hiện 8s đầu, sau đó dùng panel
    // info/success: autoDismiss lo, nhưng vẫn lọc age
    return age < 8000;
  });

  if (visibleToasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-[calc(var(--zcp-statusbar-height,22px)+8px)] right-3 flex flex-col-reverse gap-2 pointer-events-none"
      style={{ zIndex: Z_NOTIFICATION }}
    >
      {visibleToasts.slice(0, 4).map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <ToastItem notification={n} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
};

// ── Bell Trigger (dùng trong StatusBar) ───────────────────────────────────────
export const NotificationBell: React.FC = () => {
  const { panelOpen, togglePanel, unreadCount, notifications } = useNotificationStore();
  const count = unreadCount();
  const hasError = notifications.some((n) => !n.read && n.level === 'error');
  const hasWarn  = notifications.some((n) => !n.read && n.level === 'warn');

  const badgeColor = hasError ? 'bg-red-500' : hasWarn ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div className="relative flex items-center">
      <button
        onClick={togglePanel}
        className={`
          flex items-center justify-center hover:bg-white/15 px-1.5 py-0.5
          transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer
          rounded-sm relative
          ${panelOpen ? 'bg-white/15' : ''}
        `}
        title="Notifications"
      >
        <span className={`codicon codicon-bell text-[12px] flex items-center ${count > 0 ? 'text-white' : 'text-white/60'}`} />
        {count > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] ${badgeColor}
                        rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5
                        tabular-nums leading-none`}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Panel gắn trực tiếp vào bell */}
      {panelOpen && (
        <NotificationPanel onClose={() => useNotificationStore.getState().closePanel()} />
      )}
    </div>
  );
};

// ── Root component — mount 1 lần ở App.tsx ───────────────────────────────────
export const NotificationCenter: React.FC = () => {
  return <ToastStack />;
};
