// src/components/TestcasePanel/TestcasePanel.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { SubtaskGroup } from './SubtaskGroup';
import { Verdict } from '../../types/testcase';
import { selectProjectFolder, selectCheckerFile, compileChecker, exportTestcases } from '../../lib/tauri-bridge';
import { listen } from '@tauri-apps/api/event';

type TestcaseStatus = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'Running' | 'Queued' | 'Skipped' | 'Pending';

function getStatusFromVerdict(verdict: Verdict | null): TestcaseStatus {
  if (verdict === 'PENDING') return 'Running';
  if (verdict === 'QUEUED') return 'Queued';
  if (verdict === 'SKIPPED') return 'Skipped';
  if (verdict === 'AC') return 'AC';
  if (verdict === 'WA') return 'WA';
  if (verdict === 'TLE') return 'TLE';
  if (verdict === 'MLE') return 'MLE';
  if (verdict === 'RE') return 'RE';
  if (verdict === 'CE') return 'CE';
  if (verdict === null) return 'Pending';
  return 'Pending';
}

export const TestcasePanel: React.FC = () => {
  const { activeFile } = useProjectStore();
  const {
    metas,
    results,
    loadedData,
    subtasks,
    loadForFile,
    addTestcase,
    addSubtask,
    assignToSubtask,
    simulateRun,
    cancelRun,
    isCompiling,
    cancelCompile,
  } = useTestcaseStore();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAddSubtaskForm, setShowAddSubtaskForm] = useState(false);
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [newSubtaskScoreStr, setNewSubtaskScoreStr] = useState('20');
  const [isUngroupedDragOver, setIsUngroupedDragOver] = useState(false);

  // Folder Import states
  const [showImportFolderForm, setShowImportFolderForm] = useState(false);
  const [importFolderPath, setImportFolderPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusText, setImportStatusText] = useState('');

  // Folder Export states
  const [exportStatusText, setExportStatusText] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Modal Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileSettings = useTestcaseStore(state => state.fileSettings);
  const saveFileSettings = useTestcaseStore(state => state.saveFileSettings);

  const [compilerFlags, setCompilerFlags] = useState('-O2 -std=c++17');
  const [interpreterFlags, setInterpreterFlags] = useState('');
  const [ioMode, setIoMode] = useState<'stdio' | 'file'>('stdio');
  const [inputFile, setInputFile] = useState('');
  const [outputFile, setOutputFile] = useState('');
  const [timeLimitStr, setTimeLimitStr] = useState('1000');
  const [memoryLimitStr, setMemoryLimitStr] = useState('256');
  const [runMode, setRunMode] = useState<'parallel' | 'sequential'>('parallel');

  // Checker configuration states
  const [checkerType, setCheckerType] = useState('ignore_trailing_space');
  const [customCheckerPath, setCustomCheckerPath] = useState('');
  const [customCheckerBinary, setCustomCheckerBinary] = useState('');
  const [checkerCompileError, setCheckerCompileError] = useState('');
  const [checkerCompileSuccess, setCheckerCompileSuccess] = useState(false);
  const [isCompilingChecker, setIsCompilingChecker] = useState(false);

  const handleCompileChecker = async (path: string, typeOverride?: string) => {
    if (!path.trim()) return;
    setIsCompilingChecker(true);
    setCheckerCompileError('');
    setCheckerCompileSuccess(false);

    try {
      const projectRoot = useProjectStore.getState().rootPath || '';
      const type = typeOverride ?? checkerType;

      const isExe = path.toLowerCase().endsWith('.exe');
      if (isExe && type !== 'themis_checker') {
        throw new Error("Only Themis Checker accepts .exe files");
      }

      const result = await compileChecker(path, type, projectRoot);
      if (result.success) {
        setCheckerCompileSuccess(true);
        setCustomCheckerBinary(result.binaryPath);
      } else {
        setCheckerCompileError(result.stderr || 'Checker compilation failed.');
      }
    } catch (err: any) {
      setCheckerCompileError(err.message || String(err));
    } finally {
      setIsCompilingChecker(false);
    }
  };

  // Sync settings when loaded from DB
  useEffect(() => {
    if (fileSettings) {
      setCompilerFlags(fileSettings.compilerFlags);
      setInterpreterFlags(fileSettings.interpreterFlags);
      setIoMode(fileSettings.ioMode);
      setInputFile(fileSettings.inputFile);
      setOutputFile(fileSettings.outputFile);
      setTimeLimitStr(fileSettings.timeLimitMs.toString());
      setMemoryLimitStr(Math.round(fileSettings.memoryLimitKb / 1024).toString());
      setRunMode(fileSettings.runMode);
      setCheckerType(fileSettings.checkerType || 'ignore_trailing_space');
      setCustomCheckerPath(fileSettings.customCheckerPath || '');
      setCustomCheckerBinary(fileSettings.customCheckerBinary || '');
      setCheckerCompileError('');
      setCheckerCompileSuccess(false);
    }
  }, [fileSettings, isSettingsOpen]);

  // Reload testcases when active file changes
  useEffect(() => {
    if (activeFile) {
      loadForFile(activeFile);
    }
  }, [activeFile]);

  // Expand a testcase
  const handleToggleExpand = (id: string) => {
    if (!expandedIds.has(id)) {
      useTestcaseStore.getState().loadData(id);
    }
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Compile list of subtasks and ungrouped testcases
  const subtaskList = useMemo(() => {
    const list = Array.from(subtasks.values()).sort((a, b) => a.orderIndex - b.orderIndex);
    return list.map(sub => {
      const subMetas = Array.from(metas.values())
        .filter(meta => meta.subtaskId === sub.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      return {
        id: sub.id,
        name: sub.name,
        maxScore: sub.maxScore,
        testcases: subMetas,
      };
    });
  }, [subtasks, metas]);

  const ungroupedTestcases = useMemo(() => {
    return Array.from(metas.values())
      .filter(meta => meta.subtaskId === null)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [metas]);

  // Compute clean sequential indices (#1, #2, ...) based on visual rendering order
  const testcaseIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let currentIndex = 0;
    subtaskList.forEach(sub => {
      sub.testcases.forEach(tc => {
        map.set(tc.id, currentIndex++);
      });
    });
    ungroupedTestcases.forEach(tc => {
      map.set(tc.id, currentIndex++);
    });
    return map;
  }, [subtaskList, ungroupedTestcases]);

  // Aggregated status checking
  const testcasesToRun = useMemo(() => {
    return Array.from(metas.values()).filter(meta => meta.isActive);
  }, [metas]);
  const totalActiveCount = testcasesToRun.length;
  
  const runProgress = useMemo(() => {
    let pendingCount = 0;
    let completedCount = 0;
    const counts = {
      AC: 0,
      WA: 0,
      TLE: 0,
      MLE: 0,
      RE: 0,
      CE: 0,
      Running: 0,
      Queued: 0,
      Pending: 0,
      Skipped: 0
    };

    testcasesToRun.forEach(meta => {
      const res = results.get(meta.id);
      const status = getStatusFromVerdict(res?.lastStatus || null);
      if (status === 'Running' || status === 'Queued') {
        pendingCount++;
      }
      if (res?.lastStatus && res.lastStatus !== 'QUEUED' && res.lastStatus !== 'PENDING') {
        completedCount++;
      }
      counts[status]++;
    });

    const isRunning = pendingCount > 0;
    return {
      isRunning,
      completedCount,
      totalActiveCount,
      acCount: counts.AC,
      counts,
      percentage: totalActiveCount > 0 ? Math.round((completedCount / totalActiveCount) * 100) : 0,
    };
  }, [testcasesToRun, results, totalActiveCount]);

  const handleAddSubtaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskName.trim()) return;

    const score = parseInt(newSubtaskScoreStr, 10) || 0;
    await addSubtask(newSubtaskName, score);
    setNewSubtaskName('');
    setNewSubtaskScoreStr('20');
    setShowAddSubtaskForm(false);
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await selectProjectFolder();
      if (selected) {
        setImportFolderPath(selected);
      }
    } catch (err) {
      console.error("Error selecting folder:", err);
    }
  };

  const handleImportFromFolder = async () => {
    if (!importFolderPath.trim() || !activeFile) return;
    setIsImporting(true);
    setImportStatusText('Scanning directory and importing data...');
    let count = 0;

    // Register a temporary listener to count imported testcases in real-time
    const unlisten = await listen('testcase-imported', () => {
      count++;
      setImportStatusText(`Importing testcase #${count}...`);
    });

    try {
      await useTestcaseStore.getState().importFromFolder(importFolderPath);
      setImportStatusText(`Successfully imported ${count} testcases!`);
    } catch (err: any) {
      setImportStatusText(`Error importing: ${err?.message || err}`);
    } finally {
      unlisten();
      setIsImporting(false);
    }
  };

  const handleExportTestcases = async () => {
    if (!activeFile) return;
    try {
      const selected = await selectProjectFolder();
      if (!selected) return;
      setIsExporting(true);
      setExportStatusText('Exporting testcases...');
      await exportTestcases(selected, activeFile);
      setExportStatusText('All testcases successfully exported!');
      setTimeout(() => setExportStatusText(''), 4000);
    } catch (err: any) {
      setExportStatusText(`Error exporting: ${err?.message || err}`);
      setTimeout(() => setExportStatusText(''), 6000);
    } finally {
      setIsExporting(false);
    }
  };

  // Drag over main ungrouped/flat area
  const handleUngroupedDragOver = (e: React.DragEvent) => {
    if (subtasks.size === 0 || runProgress.isRunning) return;
    e.preventDefault();
  };

  const handleUngroupedDragEnter = (e: React.DragEvent) => {
    if (subtasks.size === 0 || runProgress.isRunning) return;
    e.preventDefault();
    setIsUngroupedDragOver(true);
  };

  const handleUngroupedDragLeave = () => {
    setIsUngroupedDragOver(false);
  };

  const handleUngroupedDrop = (e: React.DragEvent) => {
    if (subtasks.size === 0 || runProgress.isRunning) return;
    e.preventDefault();
    setIsUngroupedDragOver(false);
    const tcIdStr = e.dataTransfer.getData("application/x-zetacp-testcase");
    if (tcIdStr) {
      assignToSubtask(tcIdStr, null); // Assign to ungrouped
    }
  };

  if (!activeFile) {
    return (
      <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] flex flex-col items-center justify-center p-6 text-center select-none border-l border-[var(--zcp-border)]">
        <span className="codicon codicon-info text-[28px] text-[var(--zcp-text-secondary)] mb-2" />
        <span className="text-xs text-[var(--zcp-text-secondary)] font-medium font-sans">Open a C++ or Python file to configure and run testcases.</span>
      </div>
    );
  }

  const hasSubtasks = subtasks.size > 0;

  return (
    <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] flex flex-col text-[var(--zcp-text-primary)] select-none overflow-hidden border-l border-[var(--zcp-border)]">
      {/* Action Toolbar (Top) - Contains Run/Abort button & Progress */}
      <div className="py-2.5 px-3 bg-[var(--zcp-bg-sidebar)] flex flex-col gap-2 shrink-0 border-b border-[var(--zcp-border)]">
        <div className="flex items-center gap-1.5">
          <button
            onClick={
              isCompiling
                ? cancelCompile
                : runProgress.isRunning
                ? cancelRun
                : () => simulateRun()
            }
            disabled={!isCompiling && !runProgress.isRunning && totalActiveCount === 0}
            className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--zcp-radius-md)] text-xs font-bold transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] justify-center cursor-pointer ${
              isCompiling
                ? 'bg-[#cc6633] hover:brightness-[1.05] text-[var(--zcp-text-active)] shadow-sm'
                : runProgress.isRunning
                ? 'bg-[var(--zcp-hover-bg)] hover:brightness-[1.05] text-[var(--zcp-text-active)] border border-[var(--zcp-border)]'
                : totalActiveCount === 0
                ? 'bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-muted)] cursor-not-allowed border border-transparent'
                : 'bg-[var(--zcp-accent)] hover:brightness-[1.05] text-[var(--zcp-text-active)] shadow-sm'
            }`}
          >
            {isCompiling ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Compiling... (Cancel)</span>
              </>
            ) : runProgress.isRunning ? (
              <>
                <span className="codicon codicon-square text-[13px] text-[var(--zcp-verdict-wa)]" />
                <span>Abort</span>
              </>
            ) : (
              <>
                <span className="codicon codicon-play text-[13px]" />
                <span>Run all ({totalActiveCount})</span>
              </>
            )}
          </button>

          {/* Settings button next to Run button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 bg-[var(--zcp-bg-editor)] hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] text-[var(--zcp-text-secondary)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
            title="Configure limits & compiler flags"
          >
            <span className="codicon codicon-settings-gear text-[14px] flex items-center justify-center" />
          </button>
        </div>

        {/* Verdict Counts - Always Displayed */}
        <div className="mt-2 font-sans select-none">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold font-mono">
            <span className={`px-2 py-0.5 rounded-[2px] transition-all duration-150 ${
              runProgress.counts.AC > 0 
                ? "bg-[#22C55E] text-[#111827]" 
                : "bg-[rgba(34,197,94,0.15)] text-[#86efac]"
            }`}>
              {runProgress.counts.AC} AC
            </span>
            <span className={`px-2 py-0.5 rounded-[2px] transition-all duration-150 ${
              runProgress.counts.WA > 0 
                ? "bg-[#EF4444] text-[#ffffff]" 
                : "bg-[rgba(239,68,68,0.15)] text-[#fca5a5]"
            }`}>
              {runProgress.counts.WA} WA
            </span>
            <span className={`px-2 py-0.5 rounded-[2px] transition-all duration-150 ${
              runProgress.counts.TLE > 0 
                ? "bg-[#6B7280] text-[#ffffff]" 
                : "bg-[rgba(107,114,128,0.2)] text-[#d1d5db]"
            }`}>
              {runProgress.counts.TLE} TLE
            </span>
            <span className={`px-2 py-0.5 rounded-[2px] transition-all duration-150 ${
              runProgress.counts.MLE > 0 
                ? "bg-[#EAB308] text-[#111827]" 
                : "bg-[rgba(234,179,8,0.15)] text-[#fef08a]"
            }`}>
              {runProgress.counts.MLE} MLE
            </span>
            <span className={`px-2 py-0.5 rounded-[2px] transition-all duration-150 ${
              runProgress.counts.RE > 0 
                ? "bg-[#F59E0B] text-[#111827]" 
                : "bg-[rgba(245,158,11,0.15)] text-[#fde047]"
            }`}>
              {runProgress.counts.RE} RTE
            </span>
            {runProgress.counts.Running > 0 && (
              <span className="px-2 py-0.5 rounded-[2px] bg-[#007acc] text-[#ffffff] animate-pulse">
                {runProgress.counts.Running} RUN
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {hasSubtasks ? (
          <>
            {/* Render Subtask Groups */}
            {subtaskList.map(sub => (
              <SubtaskGroup
                key={sub.id}
                subtask={sub}
                results={results}
                loadedData={loadedData}
                expandedIds={expandedIds}
                testcaseIndexMap={testcaseIndexMap}
                isRunning={runProgress.isRunning}
                onToggleExpand={handleToggleExpand}
              />
            ))}

            {/* Render Ungrouped testcases directly at the bottom (flat view, no folder header) */}
            <div
              onDragOver={handleUngroupedDragOver}
              onDragEnter={handleUngroupedDragEnter}
              onDragLeave={handleUngroupedDragLeave}
              onDrop={handleUngroupedDrop}
              className={`transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] min-h-[60px] ${
                isUngroupedDragOver
                  ? 'border border-dashed border-[var(--zcp-focus-border)] bg-[var(--zcp-hover-bg)]/20 p-1'
                  : 'border border-transparent'
              }`}
            >
              <div className={isUngroupedDragOver ? "pointer-events-none" : ""}>
                <SubtaskGroup
                  subtask={{
                    id: null,
                    name: '',
                    testcases: ungroupedTestcases,
                  }}
                  results={results}
                  loadedData={loadedData}
                  expandedIds={expandedIds}
                  testcaseIndexMap={testcaseIndexMap}
                  isRunning={runProgress.isRunning}
                  isFlatView={true}
                  onToggleExpand={handleToggleExpand}
                />
              </div>
            </div>
          </>
        ) : (
          /* Subtask-less Layout (Clean Flat List) */
          <SubtaskGroup
            subtask={{
              id: null,
              name: '',
              testcases: Array.from(metas.values()),
            }}
            results={results}
            loadedData={loadedData}
            expandedIds={expandedIds}
            testcaseIndexMap={testcaseIndexMap}
            isRunning={runProgress.isRunning}
            isFlatView={true}
            onToggleExpand={handleToggleExpand}
          />
        )}
      </div>

      {/* Bottom Actions Container */}
      <div className="p-3 bg-[var(--zcp-bg-sidebar)] flex flex-col gap-2 shrink-0 border-t border-[var(--zcp-border)]">
        {/* Add Subtask Inline Form (slides open right above the buttons) */}
        {showAddSubtaskForm && (
          <form 
            onSubmit={handleAddSubtaskSubmit}
            className="p-3 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] flex flex-col gap-2 animate-in slide-in-from-bottom duration-[var(--zcp-duration)]"
          >
            <span className="text-[10px] text-[var(--zcp-text-secondary)] font-bold uppercase tracking-wider font-sans">Create New Subtask</span>
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                required
                placeholder="Subtask Name (e.g., Subtask 3...)"
                value={newSubtaskName}
                onChange={e => setNewSubtaskName(e.target.value)}
                className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] focus-visible-outline"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--zcp-text-secondary)] font-sans">Max Points:</span>
                  <input
                    type="text"
                    required
                    value={newSubtaskScoreStr}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) {
                        setNewSubtaskScoreStr(val);
                      }
                    }}
                    className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs w-14 px-1.5 py-0.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] text-center focus-visible-outline"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAddSubtaskForm(false)}
                    className="px-2.5 py-1 text-[10px] font-bold text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] hover:bg-[var(--zcp-hover-bg)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] text-[10px] font-bold transition active:scale-95 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Action Buttons Row - Single row, 4 columns */}
        <div className="grid grid-cols-4 gap-1 py-0.5 shrink-0">
          {/* Add Testcase Button */}
          <button
            onClick={() => addTestcase('', '', null)}
            disabled={runProgress.isRunning}
            className={`py-1.5 rounded-[var(--zcp-radius-sm)] text-[10px] font-bold transition flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer border ${
              runProgress.isRunning
                ? 'bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-muted)] border-transparent cursor-not-allowed'
                : 'bg-[var(--zcp-bg-editor)] border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
            }`}
            title="Add new testcase"
          >
            <span className="codicon codicon-add text-[11px] shrink-0" />
            <span className="truncate">Testcase</span>
          </button>

          {/* Add Subtask Button */}
          <button
            onClick={() => setShowAddSubtaskForm(!showAddSubtaskForm)}
            disabled={runProgress.isRunning}
            className={`py-1.5 rounded-[var(--zcp-radius-sm)] text-[10px] font-bold transition flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer border ${
              showAddSubtaskForm
                ? 'bg-[var(--zcp-hover-bg)] border-[var(--zcp-focus-border)] text-[var(--zcp-text-active)]'
                : runProgress.isRunning
                ? 'bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-muted)] border-transparent cursor-not-allowed'
                : 'bg-[var(--zcp-bg-editor)] border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
            }`}
            title="Create new subtask"
          >
            <span className="codicon codicon-add text-[11px] shrink-0" />
            <span className="truncate">Subtask</span>
          </button>

          {/* Add Testcase from Folder Button */}
          <button
            onClick={() => {
              if (runProgress.isRunning) return;
              setShowImportFolderForm(!showImportFolderForm);
            }}
            disabled={runProgress.isRunning}
            className={`py-1.5 rounded-[var(--zcp-radius-sm)] text-[10px] font-bold transition flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer border ${
              showImportFolderForm
                ? 'bg-[var(--zcp-hover-bg)] border-[var(--zcp-focus-border)] text-[var(--zcp-text-active)]'
                : runProgress.isRunning
                ? 'bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-muted)] border-transparent cursor-not-allowed'
                : 'bg-[var(--zcp-bg-editor)] border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
            }`}
            title="Batch import testcases from a problem directory"
          >
            <span className="codicon codicon-new-folder text-[12px] shrink-0" />
            <span className="truncate">Import</span>
          </button>

          {/* Export Testcases Button */}
          <button
            onClick={handleExportTestcases}
            disabled={runProgress.isRunning || isExporting || !activeFile}
            className={`py-1.5 rounded-[var(--zcp-radius-sm)] text-[10px] font-bold transition flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer border ${
              runProgress.isRunning || !activeFile
                ? 'bg-[var(--zcp-bg-tab-inactive)] text-[var(--zcp-text-muted)] border-transparent cursor-not-allowed'
                : 'bg-[var(--zcp-bg-editor)] border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)]'
            }`}
            title="Export testcases to a folder in Themis format"
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

        {/* Export Status Notification */}
        {exportStatusText && (
          <div className="p-2 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-center animate-in fade-in duration-200 shrink-0">
            <span className={`text-[10px] font-bold italic ${
              exportStatusText.toLowerCase().includes('error') || exportStatusText.toLowerCase().includes('fail') ? 'text-[var(--zcp-verdict-wa)]' : 'text-[var(--zcp-verdict-ac)]'
            }`}>
              {exportStatusText}
            </span>
          </div>
        )}

        {/* Folder Import Form */}
        {showImportFolderForm && (
          <div className="p-3 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-[var(--zcp-duration)]">
            <span className="text-[10px] text-[var(--zcp-text-secondary)] font-bold uppercase tracking-wider font-sans">Import Testcases from Folder</span>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Folder root path..."
                value={importFolderPath}
                onChange={e => setImportFolderPath(e.target.value)}
                disabled={isImporting}
                className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] flex-1 min-w-0 focus-visible-outline"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                disabled={isImporting}
                className="px-3 py-1 bg-[var(--zcp-bg-sidebar)] hover:bg-[var(--zcp-hover-bg)] disabled:opacity-50 text-[var(--zcp-text-primary)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-xs transition active:scale-95 flex items-center justify-center font-bold cursor-pointer"
                title="Choose folder"
              >
                Browse...
              </button>
            </div>
            {importStatusText && (
              <span className="text-[10px] text-[var(--zcp-text-secondary)] italic font-medium truncate">{importStatusText}</span>
            )}
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  if (!isImporting) {
                    setShowImportFolderForm(false);
                    setImportStatusText('');
                  }
                }}
                disabled={isImporting}
                className="px-2.5 py-1 text-[10px] font-bold text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] rounded-[var(--zcp-radius-sm)] transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleImportFromFolder}
                disabled={isImporting || !importFolderPath.trim()}
                className="px-3.5 py-1 bg-[var(--zcp-accent)] disabled:bg-[var(--zcp-bg-tab-inactive)] disabled:text-[var(--zcp-text-secondary)] text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] text-[10px] font-bold transition active:scale-95 flex items-center gap-1 shadow-sm cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-[var(--zcp-duration)]">
          <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-5 max-w-md w-full flex flex-col gap-4 animate-in zoom-in-95 duration-[var(--zcp-duration)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--zcp-border)] pb-2">
              <span className="text-sm font-bold text-[var(--zcp-text-primary)] flex items-center gap-1.5">
                <span className="codicon codicon-settings-gear text-[14px] text-[var(--zcp-text-secondary)]" />
                Problem Settings ({activeFile.split('/').pop()})
              </span>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] transition-colors text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 max-h-[70vh] pr-1 scrollbar-thin">
              {/* Compiler/Interpreter section */}
              {activeFile.endsWith('.py') ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Python Interpreter Flags</label>
                  <input
                    type="text"
                    value={interpreterFlags}
                    onChange={e => setInterpreterFlags(e.target.value)}
                    placeholder="e.g. -u (default empty)"
                    className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
                  />
                  <span className="text-[9px] text-[var(--zcp-text-secondary)]">Arguments passed directly to the Python interpreter.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">g++ Compiler Flags</label>
                  <input
                    type="text"
                    value={compilerFlags}
                    onChange={e => setCompilerFlags(e.target.value)}
                    placeholder="Default: -O2 -std=c++17"
                    className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
                  />
                  <span className="text-[9px] text-[var(--zcp-text-secondary)]">Compiler flags used when compiling C++ files.</span>
                </div>
              )}

              {/* Run mode (parallel vs sequential) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Judge Mode</label>
                <select
                  value={runMode}
                  onChange={e => setRunMode(e.target.value as 'parallel' | 'sequential')}
                  className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer"
                >
                  <option value="parallel">Parallel Judge</option>
                  <option value="sequential">Sequential Judge</option>
                </select>
                <span className="text-[9px] text-[var(--zcp-text-secondary)]">
                  {runMode === 'parallel' 
                    ? 'Judge multiple testcases simultaneously using computer threads (Faster).' 
                    : 'Judge testcases one by one in order (Minimizes resource conflict).'}
                </span>
              </div>

              {/* I/O Mode selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">I/O Mode</label>
                <select
                  value={ioMode}
                  onChange={e => setIoMode(e.target.value as 'stdio' | 'file')}
                  className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer"
                >
                  <option value="stdio">Standard I/O (cin/cout, stdin/stdout)</option>
                  <option value="file">File I/O (freopen file read/write)</option>
                </select>
              </div>

              {/* Custom input/output file names */}
              {ioMode === 'file' && (
                <div className="grid grid-cols-2 gap-3 p-2.5 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] animate-in slide-in-from-top-2 duration-[var(--zcp-duration)]">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Input File Name</label>
                    <input
                      type="text"
                      value={inputFile}
                      onChange={e => setInputFile(e.target.value)}
                      placeholder={`${activeFile.split(/[/\\]/).pop()?.split('.')[0] || 'solution'}.inp`}
                      className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Output File Name</label>
                    <input
                      type="text"
                      value={outputFile}
                      onChange={e => setOutputFile(e.target.value)}
                      placeholder={`${activeFile.split(/[/\\]/).pop()?.split('.')[0] || 'solution'}.out`}
                      className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
                    />
                  </div>
                  <span className="col-span-2 text-[9px] text-[var(--zcp-text-secondary)]">Default empty will auto-detect based on source file name.</span>
                </div>
              )}

              {/* Trình chấm (Checker) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Checker</label>
                <select
                  value={checkerType}
                  onChange={async (e) => {
                    const type = e.target.value;
                    setCheckerType(type);
                    
                    const isCustom = ['themis_checker', 'testlib_checker', 'cms_checker', 'coci_checker', 'peg_checker', 'dmoj_checker', 'custom'].includes(type);
                    if (isCustom && customCheckerPath.trim()) {
                      // Compile immediately on selection
                      await handleCompileChecker(customCheckerPath, type);
                    } else {
                      setCheckerCompileError('');
                      setCheckerCompileSuccess(false);
                    }
                  }}
                  className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer"
                >
                  <option value="ignore_trailing_space">Ignore Trailing Space</option>
                  <option value="strictly_the_same">Exact Match / Strict</option>
                  <option value="yes_no_ignore_case">Yes/No (Case-insensitive)</option>
                  <option value="floating_point_3">Floating point 10^-3 error</option>
                  <option value="floating_point_6">Floating point 10^-6 error</option>
                  <option value="floating_point_9">Floating point 10^-9 error</option>
                  <option value="themis_checker">Themis Checker</option>
                  <option value="testlib_checker">Testlib Checker</option>
                  <option value="cms_checker">CMS Checker</option>
                  <option value="coci_checker">COCI Checker</option>
                  <option value="peg_checker">PEG Checker</option>
                  <option value="dmoj_checker">DMOJ Checker</option>
                  <option value="custom">Custom Checker (Other)</option>
                </select>
              </div>

              {/* Custom checker configuration */}
              {['themis_checker', 'testlib_checker', 'cms_checker', 'coci_checker', 'peg_checker', 'dmoj_checker', 'custom'].includes(checkerType) && (
                <div className="p-3 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-[var(--zcp-duration)]">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Checker Path</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customCheckerPath}
                        onChange={e => {
                          setCustomCheckerPath(e.target.value);
                          setCheckerCompileError('');
                          setCheckerCompileSuccess(false);
                        }}
                        placeholder="Checker file path (.cpp, .py, .exe)..."
                        className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full flex-1 min-w-0 focus-visible-outline"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const selected = await selectCheckerFile();
                            if (selected) {
                              setCustomCheckerPath(selected);
                              await handleCompileChecker(selected);
                            }
                          } catch (err) {
                            console.error("Error selecting checker file:", err);
                          }
                        }}
                        className="px-3 py-1 bg-[var(--zcp-bg-sidebar)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-primary)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-xs transition active:scale-95 flex items-center justify-center font-bold cursor-pointer"
                      >
                        Browse...
                      </button>
                    </div>
                  </div>

                  {customCheckerPath.trim() && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-[var(--zcp-text-secondary)] font-medium truncate max-w-[200px]" title={customCheckerBinary}>
                        {customCheckerBinary ? `Binary: ${customCheckerBinary.split('/').pop()}` : 'Not compiled'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCompileChecker(customCheckerPath)}
                        disabled={isCompilingChecker}
                        className="px-3 py-1 bg-[var(--zcp-bg-sidebar)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-primary)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-[10px] font-bold transition active:scale-95 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        {isCompilingChecker ? (
                          <>
                            <span className="w-2.5 h-2.5 border-2 border-[var(--zcp-text-secondary)] border-t-transparent rounded-full animate-spin shrink-0" />
                            <span>Compiling...</span>
                          </>
                        ) : (
                          <span>Compile Checker</span>
                        )}
                      </button>
                    </div>
                  )}

                  {checkerCompileSuccess && (
                    <div className="text-[10px] text-[var(--zcp-verdict-ac)] font-medium bg-[var(--zcp-verdict-ac)]/10 border border-[var(--zcp-verdict-ac)]/25 px-2 py-1 rounded-[var(--zcp-radius-sm)]">
                      ✓ Checker compiled/copied successfully!
                    </div>
                  )}
                  {checkerCompileError && (
                    <div className="text-[10px] text-[var(--zcp-verdict-wa)] font-medium bg-[var(--zcp-verdict-wa)]/10 border border-[var(--zcp-verdict-wa)]/25 px-2 py-1 rounded-[var(--zcp-radius-sm)] max-h-[100px] overflow-y-auto font-mono whitespace-pre-wrap">
                      Error: {checkerCompileError}
                    </div>
                  )}
                </div>
              )}

              {/* Time limit & Memory limit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Time Limit (ms)</label>
                  <input
                    type="text"
                    value={timeLimitStr}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) {
                        setTimeLimitStr(val);
                      }
                    }}
                    placeholder="1000"
                    className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider font-sans">Memory Limit (MB)</label>
                  <input
                    type="text"
                    value={memoryLimitStr}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) {
                        setMemoryLimitStr(val);
                      }
                    }}
                    placeholder="256"
                    className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--zcp-border)] pt-3 mt-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-3.5 py-1.5 bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (activeFile) {
                    const parsedTime = parseInt(timeLimitStr, 10) || 1000;
                    const parsedMemory = (parseInt(memoryLimitStr, 10) * 1024) || 262144;
                    await saveFileSettings({
                      filePath: activeFile,
                      compilerFlags,
                      interpreterFlags,
                      ioMode,
                      inputFile,
                      outputFile,
                      timeLimitMs: parsedTime,
                      memoryLimitKb: parsedMemory,
                      runMode,
                      checkerType,
                      customCheckerPath,
                      customCheckerBinary,
                    });
                    setIsSettingsOpen(false);
                  }
                }}
                className="px-4 py-1.5 bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
