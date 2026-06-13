import React, { useCallback, useMemo, useState } from 'react';
import { useProblemStore } from '@/stores/useProblemStore';
import { useRunnerStore } from '@/stores/useRunnerStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useUIStore } from '@/stores/useUIStore';
import { TestcaseManagerUI } from './TestcaseManagerUI';
import { useRunner } from '@/hooks/useRunner';
import { api } from '@/lib/api';
import { TestcaseId, TestcaseData, TestcaseResult, FileId } from '@/types';

function generateTestcaseId(): TestcaseId {
  return (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tc-${Date.now()}-${Math.floor(Math.random() * 10000)}`) as TestcaseId;
}

export const TestcaseManagerContainer: React.FC = () => {
  const activeFileId = useEditorStore(s => s.activeFileId);
  const status = useRunnerStore(s => s.status);
  const totalTests = useRunnerStore(s => s.totalTests);
  const completedTests = useRunnerStore(s => s.completedTests);
  const openModal = useUIStore(s => s.openModal);

  // Problem data cho file đang active
  const fileData = useProblemStore(s => activeFileId ? s.dataByFile[activeFileId] : undefined);
  const upsertTestcase = useProblemStore(s => s.upsertTestcase);
  const deleteTestcase = useProblemStore(s => s.deleteTestcase);
  const initProblem = useProblemStore(s => s.initProblem);
  const setProblemData = useProblemStore(s => s.setProblemData);
  const updateTestcaseContent = useProblemStore(s => s.updateTestcaseContent);

  // Auto load từ DB khi activeFileId thay đổi (nếu chưa có)
  React.useEffect(() => {
    if (activeFileId && !fileData) {
      initProblem(activeFileId); // set memory cache trước
      api.getProblemData(activeFileId).then((data) => {
        const testcasesMap: Record<TestcaseId, TestcaseData> = {};
        const resultsMap: Record<TestcaseId, TestcaseResult> = {};

        if (data.testcases.length === 0) {
          const newTc: TestcaseData = {
            id: generateTestcaseId(),
            input: '',
            expectedOutput: '',
            isDisabled: false,
          };
          testcasesMap[newTc.id] = newTc;
        } else {
          data.testcases.forEach((tc: TestcaseData) => {
            testcasesMap[tc.id] = tc;
          });
          
          if (data.results) {
            data.results.forEach((res: TestcaseResult) => {
              resultsMap[res.id] = res;
            });
          }
        }

        setProblemData(activeFileId as FileId, testcasesMap, resultsMap, data.settings || undefined);
      }).catch((err: unknown) => console.error("Failed to load testcases from DB:", err));
    }
  }, [activeFileId, fileData, initProblem, setProblemData]);

  // UI state: expanded testcases (không persist, chỉ sống trong memory)
  const [expandedIds, setExpandedIds] = useState<Set<TestcaseId>>(new Set());

  // Tạo danh sách testcase items dạng array để truyền vào VirtualList
  const testcaseList = useMemo(() => {
    if (!fileData) return [];
    return Object.values(fileData.testcases);
  }, [fileData]);

  // Result lookup
  const results = fileData?.results ?? {};

  // --- Actions ---

  const handleAddTestcase = useCallback(() => {
    if (!activeFileId) return;
    initProblem(activeFileId);
    const newTc: TestcaseData = {
      id: generateTestcaseId(),
      input: '',
      expectedOutput: '',
      isDisabled: false,
    };
    upsertTestcase(activeFileId, newTc);
    api.upsertTestcase(activeFileId, newTc).catch(console.error);
  }, [activeFileId, initProblem, upsertTestcase]);

  const handleDelete = useCallback((tcId: TestcaseId) => {
    if (!activeFileId) return;
    deleteTestcase(activeFileId, tcId);
    api.deleteTestcase(activeFileId, tcId).catch(console.error);
  }, [activeFileId, deleteTestcase]);

  const handleUpdateInput = useCallback((tcId: TestcaseId, val: string) => {
    if (!activeFileId || !fileData) return;
    const existing = fileData.testcases[tcId];
    if (existing) {
      const updated = { ...existing, input: val };
      upsertTestcase(activeFileId, updated);
      api.upsertTestcase(activeFileId, updated).catch(console.error);
    }
  }, [activeFileId, fileData, upsertTestcase]);

  const handleUpdateExpected = useCallback((tcId: TestcaseId, val: string) => {
    if (!activeFileId || !fileData) return;
    const existing = fileData.testcases[tcId];
    if (existing) {
      const updated = { ...existing, expectedOutput: val };
      upsertTestcase(activeFileId, updated);
      api.upsertTestcase(activeFileId, updated).catch(console.error);
    }
  }, [activeFileId, fileData, upsertTestcase]);

  const handleToggleDisabled = useCallback((tcId: TestcaseId) => {
    if (!activeFileId || !fileData) return;
    const existing = fileData.testcases[tcId];
    if (existing) {
      const updated = { ...existing, isDisabled: !existing.isDisabled };
      upsertTestcase(activeFileId, updated);
      api.upsertTestcase(activeFileId, updated).catch(console.error);
    }
  }, [activeFileId, fileData, upsertTestcase]);

  const handleToggleExpand = useCallback((tcId: TestcaseId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      const isExpanding = !next.has(tcId);
      
      if (isExpanding) {
        next.add(tcId);
      } else {
        next.delete(tcId);
      }
      return next;
    });
  }, [activeFileId, fileData, updateTestcaseContent]);

  const { runAll, runSingle, cancelRun } = useRunner();

  const handleRunAll = useCallback(() => {
    runAll();
  }, [runAll]);

  const handleCancel = useCallback(() => {
    cancelRun();
  }, [cancelRun]);

  const handleRunSingle = useCallback((tcId: TestcaseId) => {
    runSingle(tcId);
  }, [runSingle]);

  const handleLoadFolderTestcases = useCallback(async () => {
    if (!activeFileId) return;
    try {
      const selectedFolder = await api.openFolderDialog();
      if (!selectedFolder) return;

      const data = await api.loadTestcasesFromFolder(activeFileId, selectedFolder);
      if (data && data.testcases) {
        data.testcases.forEach((tc: TestcaseData) => {
          upsertTestcase(activeFileId, tc);
          api.upsertTestcase(activeFileId, tc).catch(console.error);
        });
      }
    } catch (err) {
      console.error("Failed to load folder testcases:", err);
    }
  }, [activeFileId, upsertTestcase]);

  if (!activeFileId) {
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-500 text-sm">
        No file selected
      </div>
    );
  }

  return (
    <TestcaseManagerUI
      testcaseList={testcaseList}
      results={results}
      expandedIds={expandedIds}
      status={status}
      completedTests={completedTests}
      totalTests={totalTests}
      onRunAll={handleRunAll}
      onCancel={handleCancel}
      onAddTestcase={handleAddTestcase}
      onToggleExpand={handleToggleExpand}
      onToggleDisabled={handleToggleDisabled}
      onUpdateInput={handleUpdateInput}
      onUpdateExpected={handleUpdateExpected}
      onRunSingle={handleRunSingle}
      onDelete={handleDelete}
      onLoadFolderTestcases={handleLoadFolderTestcases}
      onOpenSettings={() => openModal('problemSettings')}
    />
  );
};
