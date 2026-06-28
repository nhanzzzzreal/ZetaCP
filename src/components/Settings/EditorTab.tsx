import React from 'react';
import { GlobalSettings } from '../../types/settings';

interface EditorTabProps {
  localSettings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
}

export const EditorTab: React.FC<EditorTabProps> = ({ localSettings, onChange }) => {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-[var(--zcp-text-primary)]">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--zcp-text-secondary)] font-semibold border-b border-[var(--zcp-border)] pb-1">Editor</h3>
      
      {/* Font Family */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Font Family</label>
        <input
          type="text"
          value={localSettings.font.editor}
          onChange={(e) => onChange({
            ...localSettings,
            font: { ...localSettings.font, editor: e.target.value }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>

      {/* Font Size */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Font Size</label>
        <input
          type="number"
          min={8}
          max={48}
          value={localSettings.font.size}
          onChange={(e) => onChange({
            ...localSettings,
            font: { ...localSettings.font, size: parseInt(e.target.value) || 14 }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>
    </div>
  );
};
