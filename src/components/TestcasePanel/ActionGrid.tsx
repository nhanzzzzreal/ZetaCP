// src/components/TestcasePanel/ActionGrid.tsx

import React from 'react';

interface ActionGridProps {
  isRunning: boolean;
  showAddSubtaskForm: boolean;
  setShowAddSubtaskForm: (val: boolean) => void;
  showImportFolderForm: boolean;
  setShowImportFolderForm: (val: boolean) => void;
  activeFile: string | null;
  onAddTestcase: () => void;
  onExportTestcases: () => Promise<void>;
  isExporting: boolean;
  exportStatusText: string;
}

export const ActionGrid: React.FC<ActionGridProps> = ({
  isRunning,
  showAddSubtaskForm,
  setShowAddSubtaskForm,
  showImportFolderForm,
  setShowImportFolderForm,
  activeFile,
  onAddTestcase,
  onExportTestcases,
  isExporting,
  exportStatusText,
}) => {
  const btnClass = (active: boolean) => {
    const base = "h-[26px] rounded-[var(--zcp-radius-sm)] text-[11px] font-medium transition flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer border";
    if (isRunning) {
      return `${base} bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-muted)] border-transparent cursor-not-allowed`;
    }
    if (active) {
      return `${base} bg-[var(--zcp-hover-bg)] border-[var(--zcp-focus-border)] text-[var(--zcp-text-active)]`;
    }
    return `${base} bg-[var(--zcp-bg-editor)] border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]`;
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-1 py-0.5 shrink-0">
        <button
          onClick={onAddTestcase}
          disabled={isRunning}
          className={btnClass(false)}
          title="Add new testcase"
        >
          <span className="codicon codicon-add text-[11px] shrink-0" />
          <span className="truncate">Add TC</span>
        </button>

        <button
          onClick={() => setShowAddSubtaskForm(!showAddSubtaskForm)}
          disabled={isRunning}
          className={btnClass(showAddSubtaskForm)}
          title="Create new subtask"
        >
          <span className="codicon codicon-add text-[11px] shrink-0" />
          <span className="truncate">Subtask</span>
        </button>

        <button
          onClick={() => setShowImportFolderForm(!showImportFolderForm)}
          disabled={isRunning}
          className={btnClass(showImportFolderForm)}
          title="Batch import testcases from folder"
        >
          <span className="codicon codicon-new-folder text-[12px] shrink-0" />
          <span className="truncate">Import</span>
        </button>

        <button
          onClick={onExportTestcases}
          disabled={isRunning || isExporting || !activeFile}
          className={btnClass(false)}
          title="Export testcases to folder"
        >
          {isExporting ? (
            <>
              <span className="w-2.5 h-2.5 border-2 border-[var(--zcp-text-secondary)] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="truncate">Export...</span>
            </>
          ) : (
            <>
              <span className="codicon codicon-cloud-upload text-[12px] shrink-0" />
              <span className="truncate">Export</span>
            </>
          )}
        </button>
      </div>

      {exportStatusText && (
        <div className="p-2 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-center animate-in fade-in duration-200 shrink-0">
          <span className={`text-[10px] font-bold italic ${
            exportStatusText.toLowerCase().includes('error') || exportStatusText.toLowerCase().includes('fail')
              ? 'text-[var(--zcp-verdict-wa)]'
              : 'text-[var(--zcp-verdict-ac)]'
          }`}>
            {exportStatusText}
          </span>
        </div>
      )}
    </>
  );
};
