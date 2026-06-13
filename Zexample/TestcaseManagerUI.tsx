import React from 'react';
import { TestCaseItemUI } from '@/components/ui/TestCaseItemUI';
import { VirtualListUI } from '@/components/ui/VirtualListUI';
import { TestcaseId, TestcaseData, TestcaseResult } from '@/types';
import { Play, Square, FolderPlus, Plus, Settings } from 'lucide-react';

export interface TestcaseManagerUIProps {
  testcaseList: TestcaseData[];
  results: Record<TestcaseId, TestcaseResult>;
  expandedIds: Set<TestcaseId>;
  status: 'idle' | 'compiling' | 'running' | 'done' | 'aborted';
  completedTests: number;
  totalTests: number;

  onRunAll: () => void;
  onCancel: () => void;
  onAddTestcase: () => void;
  onToggleExpand: (id: TestcaseId) => void;
  onToggleDisabled: (id: TestcaseId) => void;
  onUpdateInput: (id: TestcaseId, val: string) => void;
  onUpdateExpected: (id: TestcaseId, val: string) => void;
  onRunSingle: (id: TestcaseId) => void;
  onDelete: (id: TestcaseId) => void;
  onLoadFolderTestcases: () => void;
  onOpenSettings: () => void;
}

export const TestcaseManagerUI: React.FC<TestcaseManagerUIProps> = ({
  testcaseList,
  results,
  expandedIds,
  status,
  completedTests,
  totalTests,
  onRunAll,
  onCancel,
  onAddTestcase,
  onToggleExpand,
  onToggleDisabled,
  onUpdateInput,
  onUpdateExpected,
  onRunSingle,
  onDelete,
  onLoadFolderTestcases,
  onOpenSettings,
}) => {
  const isRunning = status === 'compiling' || status === 'running';
  return (
    <div className="p-3 h-full flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 w-full shrink-0">
        <button 
          onClick={isRunning ? onCancel : onRunAll}
          className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition active:scale-95 flex-1 justify-center ${
            !isRunning ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {!isRunning ? (
            <>
              <Play size={14} fill="currentColor" />
              Run Code
            </>
          ) : (
            <>
              <Square size={12} fill="currentColor" />
              Abort ({status === 'compiling' ? 'Compiling...' : `Running ${completedTests}/${totalTests}`})
            </>
          )}
        </button>
        
        <button 
          onClick={onOpenSettings}
          disabled={isRunning}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors flex-shrink-0 ${
            !isRunning ? "bg-[#333] hover:bg-[#444] text-white" : "bg-[#333]/50 text-gray-500 cursor-not-allowed"
          }`}
          title="Problem Settings"
        >
          <Settings size={14} />
        </button>

        <button
          onClick={onLoadFolderTestcases}
          disabled={isRunning}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors flex-shrink-0 ${
            !isRunning ? "bg-[#333] hover:bg-[#444] text-white" : "bg-[#333]/50 text-gray-500 cursor-not-allowed"
          }`}
          title="Load testcases from problem folder"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      {/* Testcase list */}
      <div className="flex-1 min-h-0">
        <VirtualListUI
          items={testcaseList}
          emptyMessage="No testcases yet."
          renderItem={(tc: TestcaseData, index: number) => {
            const result = results[tc.id];
            return (
              <div className="pr-2 pb-1">
                <TestCaseItemUI
                  id={tc.id}
                  index={index}
                  input={tc.input ?? ''}
                  expectedOutput={tc.expectedOutput ?? ''}
                  actualOutput={result?.output ?? ''}
                  errorOutput={result?.errorOutput}
                  status={result?.status ?? 'Pending'}
                  timeMs={result?.timeMs ?? -1}
                  memoryKb={result?.memoryKb ?? 0}
                  isExpanded={expandedIds.has(tc.id)}
                  isDisabled={tc.isDisabled}
                  isRunning={isRunning}
                  onToggleExpand={() => onToggleExpand(tc.id)}
                  onToggleDisabled={() => onToggleDisabled(tc.id)}
                  onUpdateInput={(val) => onUpdateInput(tc.id, val)}
                  onUpdateExpected={(val) => onUpdateExpected(tc.id, val)}
                  onRun={() => onRunSingle(tc.id)}
                  onDelete={() => onDelete(tc.id)}
                />
              </div>
            );
          }}
          footer={
            <div className="pr-2 pt-2 pb-6">
              <button
                onClick={onAddTestcase}
                className="w-full py-3 border-2 border-dashed border-[#3c3c3c] rounded-lg text-gray-500 hover:text-gray-300 hover:border-[#555] transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus size={16} /> Add Testcase
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
};
