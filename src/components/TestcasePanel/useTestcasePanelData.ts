// src/components/TestcasePanel/useTestcasePanelData.ts

import { useState, useEffect, useMemo } from 'react';
import { useTestcaseStore } from '../../stores/useTestcaseStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { Verdict } from '../../types/testcase';
import { selectProjectFolder, exportTestcases } from '../../lib/tauri-bridge';

type TestcaseStatus = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'Running' | 'Queued' | 'Skipped' | 'Pending';

export function getStatusFromVerdict(verdict: Verdict | null): TestcaseStatus {
  if (verdict === 'PENDING') return 'Running';
  if (verdict === 'QUEUED') return 'Queued';
  if (verdict === 'SKIPPED') return 'Skipped';
  if (verdict === 'AC') return 'AC';
  if (verdict === 'WA') return 'WA';
  if (verdict === 'TLE') return 'TLE';
  if (verdict === 'MLE') return 'MLE';
  if (verdict === 'RE') return 'RE';
  if (verdict === 'CE') return 'CE';
  return 'Pending';
}

export function useTestcasePanelData() {
  const { activeFile } = useProjectStore();
  const store = useTestcaseStore();
  const {
    metas,
    results,
    subtasks,
    loadForFile,
  } = store;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAddSubtaskForm, setShowAddSubtaskForm] = useState(false);
  const [showImportFolderForm, setShowImportFolderForm] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [exportStatusText, setExportStatusText] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (activeFile) {
      loadForFile(activeFile);
    }
  }, [activeFile, loadForFile]);

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
      counts,
    };
  }, [testcasesToRun, results, totalActiveCount]);

  const handleExportTestcases = async () => {
    if (!activeFile) {
      return;
    }
    try {
      const selected = await selectProjectFolder();
      if (!selected) {
        return;
      }
      setIsExporting(true);
      setExportStatusText('Exporting testcases...');
      await exportTestcases(selected, activeFile);
      setExportStatusText('All testcases successfully exported!');
      setTimeout(() => setExportStatusText(''), 4000);
    } catch (err: unknown) {
      setExportStatusText(`Error exporting: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setExportStatusText(''), 6000);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    activeFile,
    store,
    expandedIds,
    showAddSubtaskForm,
    setShowAddSubtaskForm,
    showImportFolderForm,
    setShowImportFolderForm,
    isSettingsOpen,
    setIsSettingsOpen,
    exportStatusText,
    isExporting,
    handleToggleExpand,
    subtaskList,
    ungroupedTestcases,
    testcaseIndexMap,
    totalActiveCount,
    runProgress,
    handleExportTestcases,
  };
}
