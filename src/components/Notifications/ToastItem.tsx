import React from 'react';
import { Notification, NotificationLevel } from '../../stores/useNotificationStore';

const LEVEL_CONFIG: Record<NotificationLevel, {
  icon: string;
  borderColor: string;
  iconColor: string;
  bgColor: string;
  badgeBg: string;
}> = {
  error: {
    icon: 'codicon-error',
    borderColor: 'border-l-red-500',
    iconColor: 'text-red-400',
    bgColor: 'bg-[#2a1a1a]',
    badgeBg: 'bg-red-500',
  },
  warn: {
    icon: 'codicon-warning',
    borderColor: 'border-l-yellow-500',
    iconColor: 'text-yellow-400',
    bgColor: 'bg-[#231f10]',
    badgeBg: 'bg-yellow-500',
  },
  success: {
    icon: 'codicon-pass-filled',
    borderColor: 'border-l-green-500',
    iconColor: 'text-green-400',
    bgColor: 'bg-[#0f1f10]',
    badgeBg: 'bg-green-500',
  },
  info: {
    icon: 'codicon-info',
    borderColor: 'border-l-blue-400',
    iconColor: 'text-blue-400',
    bgColor: 'bg-[#111a2a]',
    badgeBg: 'bg-blue-500',
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5)  return 'vừa xong';
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m trước`;
  return formatTime(ts);
}

interface ToastItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  inPanel?: boolean;
}

export const ToastItem: React.FC<ToastItemProps> = ({ notification: n, onDismiss, inPanel = false }) => {
  const cfg = LEVEL_CONFIG[n.level];

  return (
    <div
      className={`
        relative flex gap-2.5 p-3 border border-white/10 border-l-2 ${cfg.borderColor} ${cfg.bgColor}
        rounded-[var(--zcp-radius-sm)] shadow-xl backdrop-blur-md
        text-xs font-mono text-[var(--zcp-text-primary)]
        animate-in slide-in-from-right-4 fade-in duration-200
        ${inPanel ? 'w-full' : 'w-[320px]'}
      `}
    >
      {/* Icon */}
      <span className={`codicon ${cfg.icon} ${cfg.iconColor} text-[14px] shrink-0 mt-px`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-[var(--zcp-text-active)] leading-tight truncate">
            {n.title}
          </span>
          <span className="text-[10px] text-white/30 shrink-0 mt-0.5 tabular-nums">
            {relativeTime(n.timestamp)}
          </span>
        </div>

        <p className="mt-0.5 text-[11px] text-white/70 leading-relaxed break-words line-clamp-3">
          {n.message}
        </p>

        {n.hint && (
          <p className="mt-1 text-[10px] text-white/40 italic leading-relaxed break-words">
            💡 {n.hint}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
        className="absolute top-2 right-2 p-px rounded hover:bg-white/15 text-white/30 hover:text-white/80 transition-colors cursor-pointer"
        title="Đóng"
      >
        <span className="codicon codicon-close text-[11px]" />
      </button>
    </div>
  );
};
