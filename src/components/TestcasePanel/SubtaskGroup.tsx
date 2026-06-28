// src/components/TestcasePanel/SubtaskGroup.tsx

import React, { useState } from 'react';
import { TestcaseMeta, TestcaseResult, TestcaseData } from '../../types/testcase';
import { TestcaseItem } from './TestcaseItem';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { VirtualizedWrapper } from '../Common/VirtualizedWrapper';
import { calculateSubtaskStatus, SubtaskStatusBadge } from './SubtaskStatusBadge';

interface SubtaskGroupProps {
  subtask: {
    id: string | null;
    name: string;
    maxScore?: number;
    testcases: TestcaseMeta[];
  };
  results: Map<string, TestcaseResult>;
  loadedData: Map<string, TestcaseData>;
  expandedIds: Set<string>;
  testcaseIndexMap: Map<string, number>;
  isRunning: boolean;
  onToggleExpand: (id: string) => void;
  isFlatView?: boolean;
}

export const SubtaskGroup: React.FC<SubtaskGroupProps> = React.memo(({
  subtask,
  results,
  loadedData,
  expandedIds,
  testcaseIndexMap,
  isRunning,
  onToggleExpand,
  isFlatView = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const subtaskStatus = calculateSubtaskStatus(subtask.testcases, results);

  const handleDragOver = (e: React.DragEvent) => {
    if (isFlatView || isRunning) return;
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (isFlatView || isRunning) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isFlatView || isRunning) return;
    e.preventDefault();
    setIsDragOver(false);
    const tcIdStr = e.dataTransfer.getData("application/x-zetacp-testcase");
    if (tcIdStr) {
      useTestcaseStore.getState().assignToSubtask(tcIdStr, subtask.id);
    }
  };

  const sortedTestcases = React.useMemo(() => {
    return subtask.testcases.slice().sort((a, b) => a.orderIndex - b.orderIndex);
  }, [subtask.testcases]);

  const listContent = (
    <div className={isFlatView ? "bg-transparent" : "p-1 bg-transparent border-t border-[var(--zcp-border)]"}>
      {sortedTestcases.length === 0 ? (
        <div className="text-center py-4 text-[var(--zcp-text-muted)] text-[10px] font-medium italic">
          No testcases. Drag and drop here to add.
        </div>
      ) : (
        <VirtualizedWrapper
          mode="list"
          data={sortedTestcases}
          height={Math.min(sortedTestcases.length * 52, 450)}
          itemContent={(_index, meta) => {
            const data = loadedData.get(meta.id) || null;
            const result = results.get(meta.id) || null;
            const seqIndex = testcaseIndexMap.get(meta.id) ?? 0;

            return (
              <TestcaseItem
                key={meta.id}
                meta={meta}
                data={data}
                result={result}
                seqIndex={seqIndex}
                isExpanded={expandedIds.has(meta.id)}
                isRunning={isRunning}
                onToggleExpand={onToggleExpand}
              />
            );
          }}
        />
      )}
    </div>
  );

  if (isFlatView) {
    return <div className="w-full">{listContent}</div>;
  }

  return (
    <div 
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`mb-2 overflow-hidden select-none transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] rounded-[var(--zcp-radius-none)] border border-[var(--zcp-border)] ${
        isDragOver 
          ? 'bg-[var(--zcp-hover-bg)] scale-[1.01]' 
          : 'bg-[var(--zcp-bg-sidebar)]/40'
      }`}
    >
      <div className={isDragOver ? "pointer-events-none" : ""}>
        <div 
          className={`flex items-center justify-between px-3 py-1.5 cursor-pointer group transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] ${
            isDragOver ? 'bg-[var(--zcp-hover-bg)]' : 'bg-[var(--zcp-bg-sidebar)]/80 hover:bg-[var(--zcp-hover-bg)]/30'
          }`}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--zcp-text-secondary)] group-hover:text-[var(--zcp-text-active)] flex items-center">
              <span className={`codicon codicon-chevron-right text-[12px] transition-transform duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] ${isCollapsed ? '' : 'rotate-90'}`} />
            </span>

            <span className={`codicon codicon-folder text-[14px] shrink-0 transition-colors ${isDragOver ? 'text-indigo-300' : 'text-[#e8a838]'}`} />
            
            <span className="text-xs font-bold text-[var(--zcp-text-primary)] group-hover:text-[var(--zcp-text-active)] truncate">
              {subtask.name}
            </span>

            <span className="text-[10px] text-[var(--zcp-text-secondary)] shrink-0">
              ({subtask.testcases.length})
            </span>

            {subtask.maxScore !== undefined && (
              <span className="px-1.5 py-[1px] text-[9px] font-bold bg-[var(--zcp-bg-editor)] text-[var(--zcp-text-secondary)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] shrink-0">
                {subtask.maxScore} pts
              </span>
            )}

            <SubtaskStatusBadge status={subtaskStatus} />
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {subtask.testcases.length > 0 && (
              subtaskStatus === 'PENDING' ? (
                <button
                  onClick={() => useTestcaseStore.getState().cancelRun()}
                  className="p-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-verdict-wa)] hover:bg-[var(--zcp-verdict-wa)]/10 transition-colors cursor-pointer"
                  title="Stop running this Subtask"
                >
                  <span className="codicon codicon-square text-[12px] flex items-center animate-pulse" />
                </button>
              ) : (
                <button
                  onClick={() => useTestcaseStore.getState().simulateRun(subtask.testcases.filter(t => t.isActive).map(t => t.id))}
                  disabled={isRunning || !subtask.testcases.some(t => t.isActive)}
                  className="p-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-verdict-ac)] hover:bg-[var(--zcp-hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Run all testcases in this Subtask"
                >
                  <span className="codicon codicon-play text-[12px] flex items-center" />
                </button>
              )
            )}

            {subtask.id !== null && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete this Subtask? Testcases will be kept and moved to 'Unassigned'.`)) {
                    useTestcaseStore.getState().deleteSubtask(subtask.id!);
                  }
                }}
                disabled={isRunning}
                className="p-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-verdict-wa)] hover:bg-[var(--zcp-verdict-wa)]/15 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50 cursor-pointer"
                title="Delete Subtask"
              >
                <span className="codicon codicon-trash text-[12px] flex items-center" />
              </button>
            )}
          </div>
        </div>

        {!isCollapsed && listContent}
      </div>
    </div>
  );
});
