// src/components/TestcasePanel/ControlButtons.tsx

import React from 'react';

interface ControlButtonsProps {
  isCompiling: boolean;
  isRunning: boolean;
  totalActiveCount: number;
  onCancelCompile: () => void;
  onCancelRun: () => void;
  onSimulateRun: () => Promise<void>;
  onOpenSettings: () => void;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  isCompiling,
  isRunning,
  totalActiveCount,
  onCancelCompile,
  onCancelRun,
  onSimulateRun,
  onOpenSettings,
}) => {
  const handleClick = () => {
    if (isCompiling) {
      onCancelCompile();
      return;
    }
    if (isRunning) {
      onCancelRun();
      return;
    }
    onSimulateRun();
  };

  const getButtonClass = () => {
    const base = "flex-1 h-[26px] px-3 text-[11px] font-bold text-white flex items-center justify-center gap-1.5 rounded-[var(--zcp-radius-sm)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer disabled:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed";
    if (isCompiling) {
      return `${base} bg-[#cc6633] hover:brightness-[1.15] shadow-sm`;
    }
    if (isRunning) {
      return `${base} bg-[#b0203d] hover:brightness-[1.15] shadow-sm animate-pulse`;
    }
    if (totalActiveCount === 0) {
      return `${base} bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-muted)] border border-transparent cursor-not-allowed`;
    }
    return `${base} bg-[var(--zcp-accent)] hover:brightness-[1.15] shadow-sm`;
  };

  const getButtonTitle = () => {
    if (isCompiling) {
      return 'Compiling... Click to Cancel';
    }
    if (isRunning) {
      return 'Abort Test Execution';
    }
    return `Run all ${totalActiveCount} testcases`;
  };

  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <button
        onClick={handleClick}
        disabled={!isCompiling && !isRunning && totalActiveCount === 0}
        className={getButtonClass()}
        title={getButtonTitle()}
      >
        {isCompiling ? (
          <>
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Compiling</span>
          </>
        ) : isRunning ? (
          <>
            <span className="codicon codicon-terminate text-[11px] shrink-0" />
            <span>Abort</span>
          </>
        ) : (
          <>
            <span className="codicon codicon-play text-[11px] shrink-0" />
            <span>Run all ({totalActiveCount})</span>
          </>
        )}
      </button>

      <button
        onClick={onOpenSettings}
        className="h-[26px] px-2.5 bg-[#3e3e42] hover:bg-[#4e4e52] text-white flex items-center justify-center rounded-[var(--zcp-radius-sm)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
        title="Configure limits & compiler flags"
      >
        <span className="codicon codicon-settings-gear text-[12px]" />
      </button>
    </div>
  );
};
