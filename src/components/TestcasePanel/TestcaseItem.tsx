// src/components/TestcasePanel/TestcaseItem.tsx

import React, { useState, useEffect, useRef } from 'react';
import { TestcaseMeta, TestcaseResult, TestcaseData, Verdict } from '../../types/testcase';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { TestcaseEditModal } from './TestcaseEditModal';
import { useOverlayStore } from '../../stores/useOverlayStore';

interface TestcaseItemProps {
  meta: TestcaseMeta;
  data: TestcaseData | null;
  result: TestcaseResult | null;
  seqIndex: number;
  isExpanded: boolean;
  isRunning: boolean;
  onToggleExpand: (id: string) => void;
}

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

function getStatusBorderColor(status: TestcaseStatus): string {
  switch (status) {
    case 'AC': return 'border-l-[var(--zcp-verdict-ac)]';
    case 'WA': return 'border-l-[var(--zcp-verdict-wa)]';
    case 'TLE': return 'border-l-[var(--zcp-verdict-tle)]';
    case 'CE': return 'border-l-[var(--zcp-verdict-ce)]';
    case 'MLE': return 'border-l-[var(--zcp-verdict-mle)]';
    case 'RE': return 'border-l-[var(--zcp-verdict-re)]';
    case 'Running': return 'border-l-[var(--zcp-accent)]';
    case 'Queued': return 'border-l-[var(--zcp-text-secondary)]';
    default: return 'border-l-[var(--zcp-border)]';
  }
}

function StatusBadge({ status }: { status: TestcaseStatus }) {
  const getBadgeStyle = (status: TestcaseStatus) => {
    switch (status) {
      case 'AC': return 'text-[var(--zcp-verdict-ac)] bg-[rgba(34,197,94,0.18)]';
      case 'WA': return 'text-[var(--zcp-verdict-wa)] bg-[rgba(239,68,68,0.18)]';
      case 'TLE': return 'text-[var(--zcp-verdict-tle)] bg-[rgba(107,114,128,0.18)]';
      case 'MLE': return 'text-[var(--zcp-verdict-mle)] bg-[rgba(234,179,8,0.18)]';
      case 'RE': return 'text-[var(--zcp-verdict-re)] bg-[rgba(245,158,11,0.18)]';
      case 'CE': return 'text-[var(--zcp-verdict-ce)] bg-[rgba(107,114,128,0.18)]';
      case 'Running': return 'text-[var(--zcp-accent)] bg-[rgba(0,122,204,0.18)] animate-pulse';
      case 'Queued': return 'text-[var(--zcp-text-secondary)] bg-[rgba(133,133,133,0.15)]';
      default: return 'text-[var(--zcp-text-secondary)] bg-[rgba(133,133,133,0.12)]';
    }
  };

  const label = status === 'RE' ? 'RTE' : status.toUpperCase();

  return (
    <span className={`inline-flex items-center text-[10px] font-bold font-sans px-1.5 py-0.5 rounded-[2px] select-none shrink-0 ${getBadgeStyle(status)}`}>
      {label}
    </span>
  );
}

export const TestcaseItem: React.FC<TestcaseItemProps> = React.memo(({
  meta,
  data,
  result,
  seqIndex,
  isExpanded,
  isRunning,
  onToggleExpand,
}) => {
  const status = getStatusFromVerdict(result?.lastStatus || null);
  const hasResult = status !== 'Pending' && status !== 'Running' && status !== 'Skipped';
  const timeMs = result?.execTimeMs ?? -1;
  const memoryKb = result?.memoryKb ?? 0;

  const [localInput, setLocalInput] = useState('');
  const [localExpected, setLocalExpected] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const dataRef = useRef(data);
  const resultRef = useRef(result);
  useEffect(() => {
    dataRef.current = data;
    resultRef.current = result;
  }, [data, result]);

  const handleOpenDiff = async () => {
    try {
      let currentData = dataRef.current;
      if (!currentData) {
        await useTestcaseStore.getState().loadData(meta.id);
        currentData = useTestcaseStore.getState().loadedData.get(meta.id) || null;
      }

      const expected = currentData?.expectedOutput || '';
      const actual = resultRef.current?.actualOutput || '';

      const limit = 100000; // 100KB
      if (expected.length > limit || actual.length > limit) {
        const proceed = window.confirm(
          `Warning: Comparison data size is very large (Expected: ${(expected.length / 1024).toFixed(1)}KB, Actual: ${(actual.length / 1024).toFixed(1)}KB).\nDisplaying Diff might cause lag or freeze the application. Are you sure you want to proceed?`
        );
        if (!proceed) return;
      }

      const store = useOverlayStore.getState();
      const existing = store.overlays.find(o => {
        if (o.type !== 'diff') return false;
        try {
          const parsed = JSON.parse(o.content);
          return parsed.testcaseId === meta.id;
        } catch {
          return false;
        }
      });

      if (existing) {
        if (existing.isMinimized) {
          await store.restoreOverlay(existing.id);
        }
        store.bringToFront(existing.id);
      } else {
        await store.addOverlay(
          'diff',
          `Diff — ${meta.name}`,
          JSON.stringify({ testcaseId: meta.id, expected, actual })
        );
      }
    } catch (err) {
      console.error("Error computing diff (compute_diff):", err);
      alert("Failed to compute diff: " + err);
    }
  };

  const handleOpenEdit = async () => {
    try {
      let currentData = dataRef.current;
      if (!currentData) {
        await useTestcaseStore.getState().loadData(meta.id);
        currentData = useTestcaseStore.getState().loadedData.get(meta.id) || null;
      }
      if (currentData) {
        setLocalInput(currentData.input || '');
        setLocalExpected(currentData.expectedOutput || '');
      }
      setIsEditOpen(true);
    } catch (err) {
      console.error("Error loading testcase data:", err);
      alert("Cannot open editor: " + err);
    }
  };

  // Synchronize local states when values change from outside
  useEffect(() => {
    setLocalInput(data?.input || '');
  }, [data?.input]);

  useEffect(() => {
    setLocalExpected(data?.expectedOutput || '');
  }, [data?.expectedOutput]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", "");
    e.dataTransfer.setData("application/x-zetacp-testcase", meta.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const borderClass = getStatusBorderColor(status);

  return (
    <div
      className={`relative group border-l-4 bg-[var(--zcp-bg-card)] pl-2.5 py-1.5 mb-0.5 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] rounded-none ${
        !meta.isActive ? 'opacity-30' : ''
      } ${borderClass}`}
    >
      {/* Draggable Header row */}
      <div
        draggable={!isRunning}
        onDragStart={handleDragStart}
        onClick={() => onToggleExpand(meta.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(meta.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault(); // Block default browser right-click menu
          useTestcaseStore.getState().toggleTestcaseActive(meta.id); // Toggle enable/disable
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        className="flex items-center cursor-pointer w-full min-h-[26px] pr-2 select-none hover:bg-[var(--zcp-hover-bg)]/20 rounded-[var(--zcp-radius-none)] px-1 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline"
        title="Left-click: Expand/Collapse | Right-click: Enable/Disable | Drag and drop to move into Subtask"
      >
        {/* Info row with hover actions */}
        <div className="flex items-center justify-between w-full h-[26px] overflow-hidden flex-1 min-w-0">
          {/* Left side: sequence index + Status + Time/Memory */}
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
            <span className="text-[11px] font-mono text-[var(--zcp-text-primary)] shrink-0">
              #{seqIndex + 1}
            </span>
            <StatusBadge status={status} />
            {hasResult && timeMs >= 0 && (
              <span className="text-[10px] font-mono text-[var(--zcp-text-secondary)] whitespace-nowrap truncate">
                ({status === 'TLE' ? `${Math.round(timeMs)}+` : Math.round(timeMs)}ms{memoryKb > 0 ? `, ${Math.round(memoryKb / 1024)}MB` : ''})
              </span>
            )}
          </div>

          {/* Right side: Hover Actions - expands width and fades in on hover */}
          <div 
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()} // Prevent triggering disable on hover buttons right-click
            className="flex items-center gap-1 overflow-hidden transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] opacity-0 max-w-0 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:max-w-[130px] group-focus-within:max-w-[130px] shrink-0"
          >
            {status === 'WA' && (
              <button
                onClick={() => handleOpenDiff()}
                className="w-6 h-6 flex items-center justify-center bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-verdict-wa)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline rounded-[var(--zcp-radius-sm)] cursor-pointer"
                title="Diff output comparison"
              >
                <span className="codicon codicon-split-horizontal text-[12px] flex items-center justify-center" />
              </button>
            )}
            <button
              onClick={handleOpenEdit}
              className="w-6 h-6 flex items-center justify-center bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-accent)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline rounded-[var(--zcp-radius-sm)] cursor-pointer"
              title="Maximize to edit Input & Output"
            >
              <span className="codicon codicon-screen-full text-[12px] flex items-center justify-center" />
            </button>
            <button
              onClick={() => useTestcaseStore.getState().simulateRun([meta.id])}
              disabled={isRunning || !meta.isActive}
              className="w-6 h-6 flex items-center justify-center bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-verdict-ac)] disabled:opacity-50 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline rounded-[var(--zcp-radius-sm)] cursor-pointer"
              title="Run this testcase"
            >
              <span className="codicon codicon-play text-[12px] flex items-center justify-center" />
            </button>
            <button
              onClick={() => useTestcaseStore.getState().deleteTestcase(meta.id)}
              className="w-6 h-6 flex items-center justify-center bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-verdict-wa)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline rounded-[var(--zcp-radius-sm)] cursor-pointer"
              title="Delete testcase"
            >
              <span className="codicon codicon-trash text-[12px] flex items-center justify-center" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content with sliding animation */}
      {isExpanded && (
        <div 
          className="space-y-2 mt-1.5 border-t border-[var(--zcp-border)] pt-1.5 pr-2 animate-slide-down"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <label className="block text-[10px] text-[var(--zcp-text-secondary)] mb-0.5 uppercase tracking-wider font-sans">Input</label>
            <CodeMirrorEditor
              key={`${meta.id}-input`}
              value={localInput}
              onChange={setLocalInput}
              onBlur={(val) => {
                if (val !== (data?.input || '')) {
                  useTestcaseStore.getState().updateTestcaseData(meta.id, val, data?.expectedOutput || '');
                }
              }}
              className="w-full h-24 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
              readOnly={isRunning}
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--zcp-text-secondary)] mb-0.5 uppercase tracking-wider font-sans">Expected Answer</label>
            <CodeMirrorEditor
              key={`${meta.id}-expected`}
              value={localExpected}
              onChange={setLocalExpected}
              onBlur={(val) => {
                if (val !== (data?.expectedOutput || '')) {
                  useTestcaseStore.getState().updateTestcaseData(meta.id, data?.input || '', val);
                }
              }}
              className="w-full h-24 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
              readOnly={isRunning}
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--zcp-text-secondary)] mb-0.5 uppercase tracking-wider font-sans">Actual Output</label>
            <CodeMirrorEditor
              key={`${meta.id}-actual`}
              readOnly
              value={result?.actualOutput || ''}
              placeholder="No output yet"
              className="w-full h-24 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
            />
          </div>
        </div>
      )}

      <TestcaseEditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        testcaseName={meta.name}
        initialInput={localInput}
        initialExpected={localExpected}
        actualOutput={result?.actualOutput || ''}
        onSave={(newInput, newExpected) => {
          setLocalInput(newInput);
          setLocalExpected(newExpected);
          if (newInput !== (data?.input || '') || newExpected !== (data?.expectedOutput || '')) {
            useTestcaseStore.getState().updateTestcaseData(meta.id, newInput, newExpected);
          }
          setIsEditOpen(false);
        }}
        isRunning={isRunning}
      />
    </div>
  );
});
