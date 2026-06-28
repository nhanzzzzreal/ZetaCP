// src/stores/useNotificationStore.ts

import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationLevel = 'error' | 'warn' | 'info' | 'success';

export interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  hint?: string;          // Từ ZetaError.hint
  timestamp: number;      // Unix ms
  read: boolean;
  autoDismiss: boolean;   // true = info/success tự mất sau 4s
}

interface NotificationStoreState {
  notifications: Notification[];
  panelOpen: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────────
  push: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  markAllRead: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // ── Convenience shortcuts ────────────────────────────────────────────────────
  error: (title: string, message: string, hint?: string) => string;
  warn:  (title: string, message: string, hint?: string) => string;
  info:  (title: string, message: string) => string;
  success: (title: string, message: string) => string;

  // ── Computed ─────────────────────────────────────────────────────────────────
  unreadCount: () => number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  panelOpen: false,

  push: (n) => {
    const id = `noti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const notification: Notification = {
      ...n,
      id,
      timestamp: Date.now(),
      read: false,
    };

    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 100), // max 100
    }));

    // Auto-dismiss info/success sau 4s
    if (notification.autoDismiss) {
      setTimeout(() => get().dismiss(id), 4000);
    }

    return id;
  },

  dismiss: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  dismissAll: () => set({ notifications: [] }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  togglePanel: () =>
    set((s) => {
      const next = !s.panelOpen;
      if (next) {
        // Mark all read khi mở panel
        setTimeout(() => get().markAllRead(), 300);
      }
      return { panelOpen: next };
    }),

  openPanel: () => {
    set({ panelOpen: true });
    setTimeout(() => get().markAllRead(), 300);
  },

  closePanel: () => set({ panelOpen: false }),

  // ── Shortcuts ──────────────────────────────────────────────────────────────
  error: (title, message, hint) =>
    get().push({ level: 'error', title, message, hint, autoDismiss: false }),

  warn: (title, message, hint) =>
    get().push({ level: 'warn', title, message, hint, autoDismiss: false }),

  info: (title, message) =>
    get().push({ level: 'info', title, message, autoDismiss: true }),

  success: (title, message) =>
    get().push({ level: 'success', title, message, autoDismiss: true }),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));

// ── Global helper — dùng được ở bất kỳ đâu không cần hook ────────────────────
// Ví dụ: notify.error('Lỗi biên dịch', err.message, err.hint)
//        notify.info('Đã lưu', 'File settings saved')

export const notify = {
  error:   (title: string, message: string, hint?: string) =>
    useNotificationStore.getState().error(title, message, hint),
  warn:    (title: string, message: string, hint?: string) =>
    useNotificationStore.getState().warn(title, message, hint),
  info:    (title: string, message: string) =>
    useNotificationStore.getState().info(title, message),
  success: (title: string, message: string) =>
    useNotificationStore.getState().success(title, message),
  dismiss: (id: string) =>
    useNotificationStore.getState().dismiss(id),

  /** Parse ZetaError object từ tauri invoke catch */
  fromTauriError: (title: string, err: unknown) => {
    if (err && typeof err === 'object') {
      const e = err as { code?: string; message?: string; hint?: string };
      const msg = e.message ?? String(err);
      const hint = e.hint;
      return useNotificationStore.getState().error(title, msg, hint);
    }
    return useNotificationStore.getState().error(title, String(err));
  },
};
