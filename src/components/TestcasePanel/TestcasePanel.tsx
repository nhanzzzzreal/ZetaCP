// src/components/TestcasePanel/TestcasePanel.tsx

import React from 'react';
import { SubtaskForm } from './SubtaskForm';
import { BulkImporter } from './BulkImporter';
import { VerdictCountsRow } from './VerdictCountsRow';
import { ControlButtons } from './ControlButtons';
import { ActionGrid } from './ActionGrid';
import { SettingsModal } from './SettingsModal';
import { TestcaseListView } from './TestcaseListView';
import { useTestcasePanelData } from './useTestcasePanelData';

export const TestcasePanel: React.FC = () => {
  const {
    activeFile,
    store,
    expandedIds,
    showAddSubtaskForm,
    setShowAddSubtaskForm,
    showImportFolderForm,
    setShowImportFolderForm,
    isSettingsOpen,
    setIsSettingsOpen,
    exportStatusText,
    isExporting,
    handleToggleExpand,
    subtaskList,
    ungroupedTestcases,
    testcaseIndexMap,
    totalActiveCount,
    runProgress,
    handleExportTestcases,
  } = useTestcasePanelData();

  const {
    results,
    loadedData,
    subtasks,
    addTestcase,
    addSubtask,
    assignToSubtask,
    simulateRun,
    cancelRun,
    isCompiling,
    cancelCompile,
    fileSettings,
    saveFileSettings,
    importFromFolder,
    metas,
  } = store;

  if (!activeFile) {
    return (
      <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] flex flex-col items-center justify-center p-6 text-center select-none">
        <span className="codicon codicon-info text-[28px] text-[var(--zcp-text-secondary)] mb-2" />
        <span className="text-xs text-[var(--zcp-text-secondary)] font-medium font-sans">Open a C++ or Python file to configure and run testcases.</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] flex flex-col text-[var(--zcp-text-primary)] select-none overflow-hidden">
      <TestcaseListView
        hasSubtasks={subtasks.size > 0}
        subtaskList={subtaskList}
        results={results}
        loadedData={loadedData}
        expandedIds={expandedIds}
        testcaseIndexMap={testcaseIndexMap}
        isRunning={runProgress.isRunning}
        onToggleExpand={handleToggleExpand}
        ungroupedTestcases={ungroupedTestcases}
        assignToSubtask={assignToSubtask}
        metas={metas}
      />

      <div className="p-3 bg-[var(--zcp-bg-sidebar)] flex flex-col gap-2 shrink-0 border-t border-[var(--zcp-border)]">
        {showAddSubtaskForm && (
          <SubtaskForm
            onAddSubtask={addSubtask}
            onClose={() => setShowAddSubtaskForm(false)}
          />
        )}

        {showImportFolderForm && (
          <BulkImporter
            activeFile={activeFile}
            onImportFromFolder={importFromFolder}
            onClose={() => setShowImportFolderForm(false)}
          />
        )}

        <VerdictCountsRow
          counts={runProgress.counts}
          totalActiveCount={totalActiveCount}
          isRunning={runProgress.isRunning}
        />

        <ControlButtons
          isCompiling={isCompiling}
          isRunning={runProgress.isRunning}
          totalActiveCount={totalActiveCount}
          onCancelCompile={cancelCompile}
          onCancelRun={cancelRun}
          onSimulateRun={simulateRun}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <ActionGrid
          isRunning={runProgress.isRunning}
          showAddSubtaskForm={showAddSubtaskForm}
          setShowAddSubtaskForm={setShowAddSubtaskForm}
          showImportFolderForm={showImportFolderForm}
          setShowImportFolderForm={setShowImportFolderForm}
          activeFile={activeFile}
          onAddTestcase={() => addTestcase('', '', null)}
          onExportTestcases={handleExportTestcases}
          isExporting={isExporting}
          exportStatusText={exportStatusText}
        />
      </div>

      {isSettingsOpen && (
        <SettingsModal
          activeFile={activeFile}
          fileSettings={fileSettings}
          onSave={saveFileSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};
