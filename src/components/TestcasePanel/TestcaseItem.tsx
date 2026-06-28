import React, { useState, useEffect, useRef } from 'react';
import { TestcaseMeta, TestcaseResult, TestcaseData } from '../../types/testcase';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { TestcaseEditModal } from './TestcaseEditModal';
import { openTestcaseDiff } from './diffHelper';
import {
  TestcaseStatusBadge,
  getStatusFromVerdict,
  getStatusBorderColor,
} from './TestcaseStatusBadge';
import { TestcaseItemExpanded } from './TestcaseItemExpanded';
import { TestcaseItemActions } from './TestcaseItemActions';

interface TestcaseItemProps {
  meta: TestcaseMeta;
  data: TestcaseData | null;
  result: TestcaseResult | null;
  seqIndex: number;
  isExpanded: boolean;
  isRunning: boolean;
  onToggleExpand: (id: string) => void;
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
    await openTestcaseDiff(meta.id, meta.name, dataRef.current, resultRef.current?.actualOutput || '');
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
      className={`relative group border-l-[5px] pl-2.5 py-2 mb-[2px] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] rounded-none ${
        !meta.isActive ? 'opacity-30' : ''
      } ${borderClass}`}
      style={{
        background: 'linear-gradient(to right, rgba(0, 0, 0, 0.1), rgba(87, 87, 87, 0.2))',
        borderTop: '1px solid rgba(22, 22, 22, 0.3)',
        borderBottom: '1px solid rgba(78, 78, 78, 0.3)'
      }}
    >
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
          e.preventDefault();
          useTestcaseStore.getState().toggleTestcaseActive(meta.id);
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        className="flex items-center cursor-pointer w-full min-h-[26px] pr-2 select-none hover:bg-[var(--zcp-hover-bg)]/20 rounded-[var(--zcp-radius-none)] px-1 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline"
        title="Left-click: Expand/Collapse | Right-click: Enable/Disable | Drag and drop to move into Subtask"
      >
        <div className="flex items-center justify-between w-full h-[26px] overflow-hidden flex-1 min-w-0 font-[var(--zcp-font-ui)]">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
            <span className={`codicon ${isExpanded ? 'codicon-chevron-up' : 'codicon-chevron-down'} text-[12px] text-[#3393cc] shrink-0`} />
            <span className="text-[12px] font-bold text-[#3393cc] shrink-0">
              TC {seqIndex + 1}
            </span>
            <TestcaseStatusBadge
              status={status}
              hasResult={hasResult}
              timeMs={timeMs}
              memoryKb={memoryKb}
            />
          </div>

          <TestcaseItemActions
            meta={meta}
            status={status}
            isRunning={isRunning}
            onOpenDiff={handleOpenDiff}
            onOpenEdit={handleOpenEdit}
          />
        </div>
      </div>

      {isExpanded && (
        <TestcaseItemExpanded
          meta={meta}
          data={data}
          result={result}
          isRunning={isRunning}
          localInput={localInput}
          localExpected={localExpected}
          setLocalInput={setLocalInput}
          setLocalExpected={setLocalExpected}
        />
      )}

      <TestcaseEditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        testcaseName={meta.name}
        initialInput={localInput}
        initialExpected={localExpected}
        actualOutput={result?.actualOutput || ''}
        hasResult={!!result && result.lastStatus !== null && result.lastStatus !== undefined}
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
