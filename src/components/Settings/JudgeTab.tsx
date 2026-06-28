import React from 'react';
import { GlobalSettings } from '../../types/settings';

interface JudgeTabProps {
  localSettings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
}

export const JudgeTab: React.FC<JudgeTabProps> = ({ localSettings, onChange }) => {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-[var(--zcp-text-primary)]">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--zcp-text-secondary)] font-semibold border-b border-[var(--zcp-border)] pb-1">Judge</h3>
      
      {/* Threads Count */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Threads Count</label>
        <input
          type="number"
          min={1}
          max={32}
          value={localSettings.judge.threads}
          onChange={(e) => onChange({
            ...localSettings,
            judge: { ...localSettings.judge, threads: parseInt(e.target.value) || 4 }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>

      {/* Default Time Limit (ms) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Default Time Limit (ms)</label>
        <input
          type="number"
          min={50}
          max={60000}
          value={localSettings.judge.defaultTimeLimitMs}
          onChange={(e) => onChange({
            ...localSettings,
            judge: { ...localSettings.judge, defaultTimeLimitMs: parseInt(e.target.value) || 1000 }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>

      {/* Default Memory Limit (MB) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Default Memory Limit (MB)</label>
        <input
          type="number"
          min={1}
          max={2048}
          value={Math.round(localSettings.judge.defaultMemoryLimitKb / 1024)}
          onChange={(e) => onChange({
            ...localSettings,
            judge: { ...localSettings.judge, defaultMemoryLimitKb: (parseInt(e.target.value) || 256) * 1024 }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>
    </div>
  );
};
