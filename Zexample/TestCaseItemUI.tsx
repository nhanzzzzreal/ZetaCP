import React, { useState, useEffect } from 'react';
import { CodeMirrorUI } from './CodeMirrorUI';
import { TestcaseId, TestcaseStatus } from '@/types';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Play, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

// --- Status helpers (Tier 1: no store, no API) ---

export function getStatusColor(status: TestcaseStatus): string {
  switch (status) {
    case 'AC': return '#22c55e';
    case 'WA': return '#ef4444';
    case 'TLE': return '#6b7280';
    case 'MLE': return '#f59e0b';
    case 'RE': return '#eab308';
    case 'CE': return '#ef4444';
    case 'Running': return '#60a5fa';
    case 'Skipped': return '#6b7280';
    default: return '#555';
  }
}

export function StatusBadge({ status }: { status: TestcaseStatus }) {
  switch (status) {
    case 'AC': return <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20"><CheckCircle2 size={10} /> AC</span>;
    case 'WA': return <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20"><XCircle size={10} /> WA</span>;
    case 'TLE': return <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-500/10 px-1.5 py-0.5 rounded border border-gray-500/20"><Clock size={10} /> TLE</span>;
    case 'MLE': return <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20"><Clock size={10} /> MLE</span>;
    case 'RE': return <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20"><AlertTriangle size={10} /> RE</span>;
    case 'CE': return <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20"><AlertTriangle size={10} /> CE</span>;
    case 'Running': return <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 animate-pulse bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">Running...</span>;
    default: return <span className="text-[10px] font-bold text-gray-600 bg-gray-600/10 px-1.5 py-0.5 rounded border border-gray-600/20">Pending</span>;
  }
}

// --- TestCaseItemUI ---

export interface TestCaseItemUIProps {
  id: TestcaseId;
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  errorOutput?: string;
  status: TestcaseStatus;
  timeMs: number;
  memoryKb: number;
  isExpanded: boolean;
  isDisabled: boolean;
  isRunning: boolean; // global run status

  onToggleExpand: () => void;
  onToggleDisabled: () => void;
  onUpdateInput: (val: string) => void;
  onUpdateExpected: (val: string) => void;
  onRun: () => void;
  onDelete: () => void;
}

const TestCaseItemInner: React.FC<TestCaseItemUIProps> = ({
  index,
  input,
  expectedOutput,
  actualOutput,
  status,
  timeMs,
  memoryKb,
  isExpanded,
  isDisabled,
  isRunning,
  onToggleExpand,
  onToggleDisabled,
  onUpdateInput,
  onUpdateExpected,
  onRun,
  onDelete,
}) => {
  // Local state chỉ dùng khi expanded (tránh tràn RAM khi hàng trăm testcase)
  const [localInput, setLocalInput] = useState('');
  const [localExpected, setLocalExpected] = useState('');

  useEffect(() => {
    if (isExpanded) setLocalInput(input);
  }, [input, isExpanded]);

  useEffect(() => {
    if (isExpanded) setLocalExpected(expectedOutput);
  }, [expectedOutput, isExpanded]);

  const hasResult = status !== 'Pending' && status !== 'Running' && status !== 'Skipped';

  return (
    <div
      className={`relative group border-l-2 pl-3 py-1 mb-1 transition-opacity ${isDisabled ? 'opacity-30' : ''}`}
      style={{ borderColor: getStatusColor(status) }}
    >
      {/* Header row */}
      <div
        className="flex items-center cursor-pointer w-full min-h-[28px] pr-2"
        onClick={onToggleDisabled}
      >
        {/* Expand/Collapse chevron */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="p-1 hover:bg-[#333] rounded transition-colors text-gray-400 shrink-0 mr-2"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Info row with hover actions */}
        <div className="flex flex-row-reverse flex-wrap content-start h-[28px] overflow-hidden flex-1 min-w-0">
          {/* Hover actions */}
          <div className="hidden group-hover:flex items-center gap-1 shrink-0 h-[28px] ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              disabled={isRunning}
              className="p-1.5 rounded hover:bg-[#333] text-gray-500 hover:text-green-400 disabled:opacity-50 transition-colors"
              title="Run this testcase"
            >
              <Play size={12} fill="currentColor" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded hover:bg-[#333] text-gray-500 hover:text-red-400 transition-colors"
              title="Delete testcase"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Name + Status + Time */}
          <div className="flex items-center gap-2 max-w-full mr-auto shrink-0 h-[28px]">
            <span className="text-xs font-bold text-gray-500 truncate min-w-0 shrink">#{index + 1}</span>
            <StatusBadge status={status} />
            {hasResult && timeMs >= 0 && (
              <span className="text-xs font-mono text-gray-500 whitespace-nowrap shrink-0">
                ({status === 'TLE' ? `${timeMs}+` : timeMs}ms{memoryKb > 0 ? `, ${Math.round(memoryKb / 1024)}MB` : ''})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3 mt-2 border-t border-[#333] pt-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Input</label>
            <CodeMirrorUI
              value={localInput}
              onChange={setLocalInput}
              onBlur={(val) => { if (val !== input) onUpdateInput(val); }}
              className="w-full h-24 border border-[#3c3c3c] rounded focus-within:border-blue-500 overflow-hidden"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Expected Answer</label>
            <CodeMirrorUI
              value={localExpected}
              onChange={setLocalExpected}
              onBlur={(val) => { if (val !== expectedOutput) onUpdateExpected(val); }}
              className="w-full h-24 border border-[#3c3c3c] rounded focus-within:border-blue-500 overflow-hidden"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Actual Output</label>
            <CodeMirrorUI
              readOnly
              value={actualOutput}
              placeholder="No output yet"
              className="w-full h-24 border border-[#3c3c3c] rounded overflow-hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize: chỉ re-render khi data thực sự thay đổi
export const TestCaseItemUI = React.memo(TestCaseItemInner, (prev, next) => {
  return prev.id === next.id &&
         prev.index === next.index &&
         prev.input === next.input &&
         prev.expectedOutput === next.expectedOutput &&
         prev.actualOutput === next.actualOutput &&
         prev.status === next.status &&
         prev.timeMs === next.timeMs &&
         prev.memoryKb === next.memoryKb &&
         prev.isExpanded === next.isExpanded &&
         prev.isDisabled === next.isDisabled &&
         prev.isRunning === next.isRunning;
});
