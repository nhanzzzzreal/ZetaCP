// src/components/Overlay/FloatingPinBar.tsx
//
// Thin toolbar (32px) located right below the native OS titlebar.
// Shared across all floating window types with hasPinBar = true.
//
// Communicates with main window via "floating-window-action" event
// for main window to execute store actions — child windows do not
// call store actions with side effects themselves.

import React, { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { Pin } from 'lucide-react';

export type FloatingWindowAction =
  | { action: 'toggle-pin'; windowLabel: string }
  | { action: 'close'; windowLabel: string };

interface FloatingPinBarProps {
  /** isPinned current state — received from store or local state */
  isPinned: boolean;
  /** Label displayed on the left side of the bar (optional) */
  label?: string;
  /** Extra controls on the right (e.g., Diff Viewer layout switcher) */
  rightSlot?: React.ReactNode;
  /** Called when toggling pin — used to update local/store state */
  onPinChange?: (next: boolean) => void;
}

export const FloatingPinBar: React.FC<FloatingPinBarProps> = ({
  isPinned,
  label,
  rightSlot,
  onPinChange,
}) => {
  const appWindow = getCurrentWindow();

  const handleTogglePin = async () => {
    const next = !isPinned;
    // Update always-on-top locally in child window (instant, no round-trip needed)
    await appWindow.setAlwaysOnTop(next).catch(console.error);
    // Notify main window to persist to DB
    await emit('floating-window-action', {
      action: 'toggle-pin',
      windowLabel: appWindow.label,
    } satisfies FloatingWindowAction);
    onPinChange?.(next);
  };

  return (
    <div className="floating-pin-bar flex items-center justify-between h-8 bg-[#121212] px-2 shrink-0 select-none font-mono">
      {/* Left: label */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
        {label && (
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider truncate">
            {label}
          </span>
        )}
      </div>

      {/* Right: rightSlot + pin button */}
      <div className="flex items-center gap-1">
        {rightSlot}

        <button
          onClick={handleTogglePin}
          className={`w-7 h-6 flex items-center justify-center rounded transition-colors text-xs focus-visible-outline ${
            isPinned
              ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20'
              : 'text-neutral-500 hover:text-neutral-200 hover:bg-[#222222]'
          }`}
          title={isPinned ? 'Unpin (Always on Top)' : 'Pin window (Always on Top)'}
        >
          <Pin className={`w-3 h-3 ${isPinned ? 'fill-indigo-400/30' : ''}`} />
        </button>
      </div>
    </div>
  );
};

// ─── Utility hook: sync isPinned with Tauri window state ─────────────────────
// Used in child window to keep local isPinned synced.

export function useWindowPinState(initial = false): [boolean, (v: boolean) => void] {
  const [isPinned, setIsPinned] = useState(initial);
  return [isPinned, setIsPinned];
}
