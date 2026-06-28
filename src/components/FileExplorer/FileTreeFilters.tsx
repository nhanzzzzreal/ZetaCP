import React from 'react';

interface FileTreeFiltersProps {
  isOpen: boolean;
  rootPath: string | null;
  showCpp: boolean;
  setShowCpp: (val: boolean) => void;
  showPy: boolean;
  setShowPy: (val: boolean) => void;
  showTxt: boolean;
  setShowTxt: (val: boolean) => void;
  showInpOut: boolean;
  setShowInpOut: (val: boolean) => void;
}

export const FileTreeFilters: React.FC<FileTreeFiltersProps> = ({
  isOpen,
  rootPath,
  showCpp,
  setShowCpp,
  showPy,
  setShowPy,
  showTxt,
  setShowTxt,
  showInpOut,
  setShowInpOut,
}) => {
  if (!isOpen || !rootPath) return null;

  return (
    <div className="absolute right-2 top-9 z-50 w-44 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-3 flex flex-col gap-2 select-none">
      <span className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider border-b border-[var(--zcp-border)] pb-1">
        Filter Extensions
      </span>
      <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
        <input
          type="checkbox"
          checked={showCpp}
          onChange={(e) => setShowCpp(e.target.checked)}
          className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
        />
        <span>.cpp (C++)</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
        <input
          type="checkbox"
          checked={showPy}
          onChange={(e) => setShowPy(e.target.checked)}
          className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
        />
        <span>.py (Python)</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
        <input
          type="checkbox"
          checked={showTxt}
          onChange={(e) => setShowTxt(e.target.checked)}
          className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
        />
        <span>.txt (Text File)</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
        <input
          type="checkbox"
          checked={showInpOut}
          onChange={(e) => setShowInpOut(e.target.checked)}
          className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
        />
        <span>Testcases (.inp/.out)</span>
      </label>
    </div>
  );
};
