import React from 'react';
import { GlobalSettings } from '../../types/settings';

interface ShortcutsTabProps {
  localSettings: GlobalSettings;
  recordingAction: string | null;
  onRecordActionChange: (actionKey: string | null) => void;
}

const shortcutLabels: Record<string, string> = {
  run_tests: 'Run Tests',
  stop_judge: 'Stop Judge',
  new_testcase: 'New Testcase',
  open_settings: 'Open Settings'
};

export const ShortcutsTab: React.FC<ShortcutsTabProps> = ({
  localSettings,
  recordingAction,
  onRecordActionChange,
}) => {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-[var(--zcp-text-primary)]">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--zcp-text-secondary)] font-semibold border-b border-[var(--zcp-border)] pb-1">Keyboard Shortcuts</h3>
      
      <div className="border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] overflow-hidden">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-[var(--zcp-bg-editor)] text-[var(--zcp-text-secondary)] font-semibold border-b border-[var(--zcp-border)]">
              <th className="p-2.5">Action</th>
              <th className="p-2.5">Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(shortcutLabels).map((actionKey) => {
              const isRecording = recordingAction === actionKey;
              const binding = localSettings.shortcuts[actionKey] || 'None';
              
              return (
                <tr key={actionKey} className="border-b border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)]/40">
                  <td className="p-2.5 font-medium text-[var(--zcp-text-secondary)]">{shortcutLabels[actionKey]}</td>
                  <td className="p-2.5">
                    <button
                      type="button"
                      onClick={() => onRecordActionChange(isRecording ? null : actionKey)}
                      className={`w-full text-left px-2 py-1 rounded-[var(--zcp-radius-sm)] border text-xs font-mono transition-all cursor-pointer ${
                        isRecording
                          ? 'bg-[var(--zcp-hover-bg)] border-[var(--zcp-focus-border)] text-[var(--zcp-text-active)] animate-pulse font-bold'
                          : 'bg-[var(--zcp-bg-editor)] border-[var(--zcp-border)] text-[var(--zcp-text-secondary)] hover:border-[var(--zcp-focus-border)] hover:text-[var(--zcp-text-active)]'
                      }`}
                    >
                      {isRecording ? 'Press keys (Escape to cancel)...' : binding.toUpperCase()}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <span className="text-[10px] text-[var(--zcp-text-secondary)]">
        Click a cell and type the desired key combination (including Ctrl, Alt, Shift modifiers) to assign it.
      </span>
    </div>
  );
};
