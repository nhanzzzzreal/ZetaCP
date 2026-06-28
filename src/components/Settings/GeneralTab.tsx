import React from 'react';
import { GlobalSettings } from '../../types/settings';

interface GeneralTabProps {
  localSettings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ localSettings, onChange }) => {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-[var(--zcp-text-primary)]">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--zcp-text-secondary)] font-semibold border-b border-[var(--zcp-border)] pb-1">General</h3>
      
      {/* Theme */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Theme</label>
        <select
          value={localSettings.theme}
          onChange={(e) => onChange({ ...localSettings, theme: e.target.value as any })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer"
        >
          <option value="dark">Dark Theme</option>
          <option value="light">Light Theme</option>
          <option value="system">System Default</option>
        </select>
      </div>

      {/* Diff Layout */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Diff Layout</label>
        <select
          value={localSettings.diff.layout}
          onChange={(e) => onChange({
            ...localSettings,
            diff: { ...localSettings.diff, layout: e.target.value as any }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer"
        >
          <option value="horizontal">Horizontal Side-by-Side</option>
          <option value="vertical">Vertical Top-and-Bottom</option>
        </select>
      </div>
    </div>
  );
};
