import React from 'react';
import { GlobalSettings } from '../../types/settings';

interface CompilerTabProps {
  localSettings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
}

export const CompilerTab: React.FC<CompilerTabProps> = ({ localSettings, onChange }) => {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-[var(--zcp-text-primary)]">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--zcp-text-secondary)] font-semibold border-b border-[var(--zcp-border)] pb-1">Compiler</h3>
      
      {/* g++ Path */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">g++ Path</label>
        <input
          type="text"
          value={localSettings.compiler.gppPath}
          onChange={(e) => onChange({
            ...localSettings,
            compiler: { ...localSettings.compiler, gppPath: e.target.value }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>

      {/* Python Path */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Python Path</label>
        <input
          type="text"
          value={localSettings.compiler.pythonPath}
          onChange={(e) => onChange({
            ...localSettings,
            compiler: { ...localSettings.compiler, pythonPath: e.target.value }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>

      {/* Default Compiler Flags */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Default Compiler Flags</label>
        <input
          type="text"
          value={localSettings.compiler.defaultFlags}
          onChange={(e) => onChange({
            ...localSettings,
            compiler: { ...localSettings.compiler, defaultFlags: e.target.value }
          })}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
        />
      </div>
    </div>
  );
};
