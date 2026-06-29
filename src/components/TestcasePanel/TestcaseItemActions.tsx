import React from 'react';
import { TestcaseMeta } from '../../types/testcase';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { TestcaseStatus } from './TestcaseStatusBadge';

interface TestcaseItemActionsProps {
  meta: TestcaseMeta;
  status: TestcaseStatus;
  isRunning: boolean;
  onOpenDiff: () => void;
  onOpenEdit: () => void;
}

export const TestcaseItemActions: React.FC<TestcaseItemActionsProps> = ({
  meta,
  status,
  isRunning,
  onOpenDiff,
  onOpenEdit,
}) => {
  return (
    <div 
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
    >
      {status === 'WA' && (
        <button
          onClick={onOpenDiff}
          className="w-6 h-6 bg-[#cc6633] hover:brightness-[1.15] text-white transition-all duration-[var(--zcp-duration)] focus-visible-outline rounded-[2px] cursor-pointer flex items-center justify-center"
          title="Show Diff"
        >
          <span className="codicon codicon-diff text-[11px]" />
        </button>
      )}
      <button
        onClick={onOpenEdit}
        className="w-6 h-6 bg-[#007acc] hover:brightness-[1.15] text-white transition-all duration-[var(--zcp-duration)] focus-visible-outline rounded-[2px] cursor-pointer flex items-center justify-center"
        title="View Fullscreen Editor"
      >
        <span className="codicon codicon-screen-full text-[11px]" />
      </button>
      <button
        onClick={() => {
          import('./graphHelper').then((m) => m.openTestcaseInGraph(meta.id));
        }}
        className="w-6 h-6 bg-[#8b5cf6] hover:brightness-[1.15] text-white transition-all duration-[var(--zcp-duration)] focus-visible-outline rounded-[2px] cursor-pointer flex items-center justify-center"
        title="Visualize Graph Input"
      >
        <span className="codicon codicon-type-hierarchy text-[11px]" />
      </button>
      <button
        onClick={() => useTestcaseStore.getState().simulateRun([meta.id])}
        disabled={isRunning || !meta.isActive}
        className="w-6 h-6 bg-[#5c8b2d] hover:brightness-[1.15] text-white disabled:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-[var(--zcp-duration)] focus-visible-outline rounded-[2px] cursor-pointer flex items-center justify-center"
        title="Run this testcase"
      >
        <span className="codicon codicon-play text-[11px]" />
      </button>
      <button
        onClick={() => useTestcaseStore.getState().deleteTestcase(meta.id)}
        className="w-6 h-6 bg-[#b0203d] hover:brightness-[1.15] text-white transition-all duration-[var(--zcp-duration)] focus-visible-outline rounded-[2px] cursor-pointer flex items-center justify-center"
        title="Delete testcase"
      >
        <span className="codicon codicon-trash text-[11px]" />
      </button>
    </div>
  );
};
