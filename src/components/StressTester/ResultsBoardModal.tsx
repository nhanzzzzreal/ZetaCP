import React, { useState } from 'react';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { notify } from '../../stores/useNotificationStore';
import { computeDiff } from '../../lib/tauri-bridge';
import { DiffViewerModal } from '../TestcasePanel/DiffViewerModal';
import { VirtualizedWrapper } from '../Common/VirtualizedWrapper';
import type { DiffLine } from '../../types/testcase';
import type { ProgressData } from '../../types/stress';

interface ResultsBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRunning: boolean;
  isPaused: boolean;
  pausedIteration: number | null;
  statusText: string;
  runs: ProgressData[];
  testCount: number | '';
  selectedRun: ProgressData | null;
  setSelectedRun: (run: ProgressData | null) => void;
  onResume: () => Promise<void>;
}

export const ResultsBoardModal: React.FC<ResultsBoardModalProps> = ({
  isOpen,
  onClose,
  isRunning,
  isPaused,
  pausedIteration,
  statusText,
  runs,
  testCount,
  selectedRun,
  setSelectedRun,
  onResume,
}) => {
  const [hideAC, setHideAC] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);

  const displayedRuns = hideAC ? runs.filter((r) => r.status !== 'passed') : runs;

  if (!isOpen) return null;

  const handleAddToTestcaseManager = async () => {
    const activeRun = selectedRun || runs.find((r) => r.iteration === pausedIteration);
    if (!activeRun) {
      notify.error('Cannot add testcase', 'No run data found.');
      return;
    }
    const activeFilePath = useTestcaseStore.getState().activeFilePath;
    if (!activeFilePath) {
      notify.error('Cannot add testcase', 'No active file selected in the Testcase Manager.');
      return;
    }
    try {
      await useTestcaseStore.getState().addTestcase(activeRun.input, activeRun.bruteOutput);
      notify.success('Testcase Added', `Saved iteration ${activeRun.iteration} output mismatch as testcase.`);
    } catch (err) {
      notify.fromTauriError('Failed to add testcase', err);
    }
  };

  const handleViewDiff = async () => {
    const activeRun = selectedRun || runs.find((r) => r.iteration === pausedIteration);
    if (!activeRun) {
      notify.error('No run selected', 'Please select a run to view diff.');
      return;
    }
    try {
      const lines = await computeDiff(activeRun.bruteOutput, activeRun.solOutput);
      setDiffLines(lines);
      setIsDiffOpen(true);
    } catch (err) {
      notify.fromTauriError('Failed to compute diff', err);
    }
  };

  const handleCopyText = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    notify.success('Copied', `${title} copied to clipboard.`);
  };

  return (
    <div className="fixed inset-0 bg-[#000000]/60 flex items-center justify-center z-[1000] p-6 animate-in fade-in duration-200">
      <div className="w-[90vw] h-[90vh] bg-[#1e1e1e] border border-[#3c3c3c] rounded-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-10 bg-[#252526] px-4 border-b border-[#3c3c3c] flex items-center justify-between text-xs text-[#cccccc] shrink-0 font-medium select-none">
          <span className="flex items-center gap-2 font-bold text-white text-sm">
            <span className="codicon codicon-beaker text-[16px] text-[#007acc]" />
            Stress Test Results Board
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-blue-500 animate-pulse' : isPaused ? 'bg-amber-500 animate-ping' : 'bg-green-500'}`} />
              Status: <span className="font-semibold text-white">{statusText}</span>
            </span>
            {runs.length > 0 && (
              <span className="text-[#858585] font-mono text-xs">
                Runs: {runs.length} / {testCount} | Failures: {runs.filter(r => r.status === 'failed').length}
              </span>
            )}
            {runs.length > 0 && (
              <button
                onClick={() => setHideAC(!hideAC)}
                className={`flex items-center gap-1.5 py-0.5 px-2 rounded text-[11px] border cursor-pointer transition-colors ${
                  hideAC ? 'bg-amber-600/30 border-amber-500/50 text-amber-400 hover:bg-amber-600/45 font-medium' : 'bg-[#3a3d3e] border-[#555555] text-neutral-300 hover:bg-[#4e5254] hover:text-white'
                }`}
                title={hideAC ? "Show AC testcases" : "Hide AC testcases"}
              >
                <span className={`codicon ${hideAC ? 'codicon-eye' : 'codicon-eye-closed'} text-[12px]`} />
                <span>{hideAC ? "Show AC" : "Hide AC"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#3c3c3c] rounded text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              title="Close Results Board"
            >
              <span className="codicon codicon-close text-[16px]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table */}
          <div className="h-[32vh] min-h-[140px] bg-[#1e1e1e] border-b border-[#3c3c3c] flex flex-col">
            {displayedRuns.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[#858585] py-8 select-none">
                {runs.length === 0 ? "No iterations run yet." : "No failed iterations found."}
              </div>
            ) : (
              <VirtualizedWrapper
                mode="table"
                data={displayedRuns}
                height="100%"
                followOutput={isRunning}
                fixedHeaderContent={() => (
                  <tr className="bg-[#252526] text-[#858585] font-semibold border-b border-[#3c3c3c] select-none uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-2 w-20">Iteration</th>
                    <th className="px-4 py-2 w-28">Verdict</th>
                    <th className="px-4 py-2 w-24">Time (ms)</th>
                    <th className="px-4 py-2 w-28">Memory (MB)</th>
                    <th className="px-4 py-2">Message</th>
                  </tr>
                )}
                tableRowClassName={(run) => {
                  const isSelected = selectedRun?.iteration === run.iteration;
                  return `hover:bg-[#2a2d2e] cursor-pointer transition-colors duration-100 ${isSelected ? 'bg-[#37373d]' : ''}`;
                }}
                onRowClick={(run) => setSelectedRun(run)}
                itemContent={(_index, run) => (
                  <>
                    <td className="px-4 py-1.5 text-white">#{run.iteration}</td>
                    <td className="px-4 py-1.5 font-bold">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${run.status === 'failed' ? 'bg-red-950/40 text-[#f44336] border border-red-500/20' : 'bg-green-950/40 text-[#4caf50] border border-green-500/20'}`}>
                        {run.verdict}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-[#cccccc]">{run.timeMs !== null ? `${Math.round(run.timeMs)} ms` : '-'}</td>
                    <td className="px-4 py-1.5 text-[#cccccc]">{run.memoryKb !== null ? `${Math.round(run.memoryKb / 1024)} MB` : '-'}</td>
                    <td className="px-4 py-1.5 text-[#858585] max-w-xs truncate">{run.status === 'failed' ? 'Verification Mismatch' : 'Passed'}</td>
                  </>
                )}
              />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
            {isPaused && (
              <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top-2 duration-200 shrink-0">
                <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs">
                  <span className="codicon codicon-warning text-[14px]" />
                  <span>PAUSED: Verification Mismatch Detected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleAddToTestcaseManager} className="flex items-center gap-1.5 px-3 py-1 bg-[#0e639c] hover:bg-[#1177bb] text-white text-[11px] font-semibold rounded cursor-pointer transition-colors">
                    <span className="codicon codicon-add" /> Add to Testcase Manager
                  </button>
                  <button onClick={onResume} className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded cursor-pointer transition-colors">
                    <span className="codicon codicon-play" /> Skip / Continue
                  </button>
                  <button onClick={handleViewDiff} className="flex items-center gap-1.5 px-3 py-1 bg-[#3c3c3c] hover:bg-[#4d4d4d] text-white text-[11px] font-semibold rounded cursor-pointer transition-colors border border-[#555555]">
                    <span className="codicon codicon-diff" /> View Diff
                  </button>
                </div>
              </div>
            )}

            {selectedRun ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="h-7 bg-[#252526] px-4 border-b border-[#3c3c3c] flex items-center justify-between text-xs text-[#858585] shrink-0 font-medium select-none">
                  <span>DETAILS OF RUN #{selectedRun.iteration} ({selectedRun.verdict})</span>
                  <button onClick={handleViewDiff} className="text-blue-400 hover:underline hover:text-blue-300 font-semibold flex items-center gap-1">
                    <span className="codicon codicon-diff text-[12px]" /> Compare Outputs
                  </button>
                </div>

                <div className="flex-1 grid grid-cols-3 divide-x divide-[#3c3c3c] min-h-0">
                  <div className="flex flex-col h-full min-h-0 bg-[#1e1e1e]">
                    <div className="h-7 px-3 bg-[#2d2d2d] flex items-center justify-between border-b border-[#3c3c3c] shrink-0 select-none">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#858585]">Input</span>
                      <button onClick={() => handleCopyText(selectedRun.input, 'Input')} className="p-1 hover:bg-[#3c3c3c] rounded text-neutral-400 hover:text-white"><span className="codicon codicon-copy text-[12px]" /></button>
                    </div>
                    <pre className="flex-1 p-3 overflow-auto text-xs font-mono text-[#d4d4d4] select-text whitespace-pre-wrap break-all bg-[#1e1e1e]">{selectedRun.input}</pre>
                  </div>
                  <div className="flex flex-col h-full min-h-0 bg-[#1e1e1e]">
                    <div className="h-7 px-3 bg-[#2d2d2d] flex items-center justify-between border-b border-[#3c3c3c] shrink-0 select-none">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#858585]">Actual Output</span>
                      <button onClick={() => handleCopyText(selectedRun.solOutput, 'Solution Output')} className="p-1 hover:bg-[#3c3c3c] rounded text-neutral-400 hover:text-white"><span className="codicon codicon-copy text-[12px]" /></button>
                    </div>
                    <pre className="flex-1 p-3 overflow-auto text-xs font-mono text-[#d4d4d4] select-text whitespace-pre-wrap break-all bg-[#1e1e1e]">{selectedRun.solOutput}</pre>
                  </div>
                  <div className="flex flex-col h-full min-h-0 bg-[#1e1e1e]">
                    <div className="h-7 px-3 bg-[#2d2d2d] flex items-center justify-between border-b border-[#3c3c3c] shrink-0 select-none">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#858585]">Expected Output</span>
                      <button onClick={() => handleCopyText(selectedRun.bruteOutput, 'Brute Output')} className="p-1 hover:bg-[#3c3c3c] rounded text-neutral-400 hover:text-white"><span className="codicon codicon-copy text-[12px]" /></button>
                    </div>
                    <pre className="flex-1 p-3 overflow-auto text-xs font-mono text-[#d4d4d4] select-text whitespace-pre-wrap break-all bg-[#1e1e1e]">{selectedRun.bruteOutput}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#858585] select-none py-8">Select a run above to view detailed inputs and outputs.</div>
            )}
          </div>
        </div>
      </div>

      {isDiffOpen && (
        <DiffViewerModal
          isOpen={isDiffOpen}
          onClose={() => setIsDiffOpen(false)}
          testcaseId={selectedRun ? `stress-run-${selectedRun.iteration}` : `stress-run-${pausedIteration || 0}`}
          testcaseName={selectedRun ? `Stress Run Iteration #${selectedRun.iteration}` : `Stress Run Iteration #${pausedIteration || 0}`}
          diffLines={diffLines}
        />
      )}
    </div>
  );
};
