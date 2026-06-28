// src/components/TestcasePanel/TestcaseListView.tsx

import React, { useState } from 'react';
import { SubtaskGroup } from './SubtaskGroup';
import { TestcaseItem } from './TestcaseItem';
import { VirtualizedWrapper } from '../Common/VirtualizedWrapper';
import { TestcaseMeta, TestcaseResult, TestcaseData } from '../../types/testcase';

interface TestcaseListViewProps {
  hasSubtasks: boolean;
  subtaskList: Array<{
    id: string | null;
    name: string;
    maxScore?: number;
    testcases: TestcaseMeta[];
  }>;
  results: Map<string, TestcaseResult>;
  loadedData: Map<string, TestcaseData>;
  expandedIds: Set<string>;
  testcaseIndexMap: Map<string, number>;
  isRunning: boolean;
  onToggleExpand: (id: string) => void;
  ungroupedTestcases: TestcaseMeta[];
  assignToSubtask: (testcaseId: string, subtaskId: string | null) => Promise<void>;
  metas: Map<string, TestcaseMeta>;
}

export const TestcaseListView: React.FC<TestcaseListViewProps> = ({
  hasSubtasks,
  subtaskList,
  results,
  loadedData,
  expandedIds,
  testcaseIndexMap,
  isRunning,
  onToggleExpand,
  ungroupedTestcases,
  assignToSubtask,
  metas,
}) => {
  const [isUngroupedDragOver, setIsUngroupedDragOver] = useState(false);

  const handleUngroupedDragOver = (e: React.DragEvent) => {
    if (subtaskList.length === 0 || isRunning) return;
    e.preventDefault();
  };

  const handleUngroupedDragEnter = (e: React.DragEvent) => {
    if (subtaskList.length === 0 || isRunning) return;
    e.preventDefault();
    setIsUngroupedDragOver(true);
  };

  const handleUngroupedDragLeave = () => {
    setIsUngroupedDragOver(false);
  };

  const handleUngroupedDrop = (e: React.DragEvent) => {
    if (subtaskList.length === 0 || isRunning) return;
    e.preventDefault();
    setIsUngroupedDragOver(false);
    const tcIdStr = e.dataTransfer.getData("application/x-zetacp-testcase");
    if (tcIdStr) {
      assignToSubtask(tcIdStr, null);
    }
  };

  return (
    <div className={hasSubtasks ? "flex-1 overflow-y-auto py-2 scrollbar-thin" : "flex-1 overflow-hidden py-2"}>
      {hasSubtasks ? (
        <>
          {subtaskList.map(sub => (
            <SubtaskGroup
              key={sub.id || 'ungrouped'}
              subtask={sub}
              results={results}
              loadedData={loadedData}
              expandedIds={expandedIds}
              testcaseIndexMap={testcaseIndexMap}
              isRunning={isRunning}
              onToggleExpand={onToggleExpand}
            />
          ))}

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
                isRunning={isRunning}
                isFlatView={true}
                onToggleExpand={onToggleExpand}
              />
            </div>
          </div>
        </>
      ) : (
        <VirtualizedWrapper
          mode="list"
          data={Array.from(metas.values())}
          height="100%"
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
};
