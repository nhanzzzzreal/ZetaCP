// src/components/StressTester/StressTestManager.tsx

import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../../stores/useProjectStore';
import { useStressTestStore } from '../../stores/useStressTestStore';
import { notify } from '../../stores/useNotificationStore';
import { ResultsBoardModal } from './ResultsBoardModal';
import type { StressTestEvent } from '../../types/stress';

export const StressTestManager: React.FC = () => {
  const activeFile = useProjectStore((s) => s.activeFile);
  const rootPath = useProjectStore((s) => s.rootPath);

  const {
    isRunning, isPaused, pausedIteration, statusText, runs, testCount,
    selectedRun, showResultsModal, initForFile, setStatusText, setIsRunning,
    setIsPaused, setPausedIteration, setRuns, setSelectedRun, handleResume,
    handleCloseResultsBoard, handleInstallTestlib
  } = useStressTestStore();

  useEffect(() => {
    if (activeFile) {
      initForFile(activeFile);
    }
  }, [activeFile, initForFile]);

  useEffect(() => {
    const unlistenPromise = listen<StressTestEvent>('stress-test-progress', (event) => {
      const { type, data } = event.payload;
      if (type === 'compiling') {
        setStatusText(`Compiling: ${data.message}`);
        setIsRunning(true);
      } else if (type === 'progress') {
        setRuns((prev) => [...prev, data]);
        setSelectedRun(data);
      } else if (type === 'complete') {
        setStatusText(`Complete: ${data.message}`);
        setIsRunning(false);
        setIsPaused(false);
        notify.success('Stress Test Complete', data.message);
      } else if (type === 'error') {
        setStatusText(`Error: ${data.message}`);
        setIsRunning(false);
        setIsPaused(false);
        notify.error('Stress Test Error', data.message);
        if (data.message.toLowerCase().includes('testlib.h') && window.confirm('testlib.h is missing. Install automatically?')) {
          handleInstallTestlib();
        }
      } else if (type === 'paused') {
        setIsPaused(true);
        setPausedIteration(data.iteration);
        setStatusText(`Paused at iteration ${data.iteration}`);
      } else if (type === 'resumed') {
        setIsPaused(false);
        setPausedIteration(null);
        setStatusText('Resuming...');
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [rootPath, setStatusText, setIsRunning, setIsPaused, setPausedIteration, setRuns, setSelectedRun, handleInstallTestlib]);

  return (
    <ResultsBoardModal
      isOpen={showResultsModal}
      onClose={handleCloseResultsBoard}
      isRunning={isRunning}
      isPaused={isPaused}
      pausedIteration={pausedIteration}
      statusText={statusText}
      runs={runs}
      testCount={testCount}
      selectedRun={selectedRun}
      setSelectedRun={setSelectedRun}
      onResume={handleResume}
    />
  );
};
