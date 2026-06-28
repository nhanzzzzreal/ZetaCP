// src/stores/testcase/listeners.ts

import { listen } from '@tauri-apps/api/event';
import { TestcaseResult, TestcaseMeta, Subtask } from '../../types/testcase';
import { patchCache } from './cache';

let unlistenProgress: (() => void) | null = null;
let unlistenImported: (() => void) | null = null;
let unlistenUpdated: (() => void) | null = null;

function handleJudgeProgress(payload: any, storeSet: any) {
  const { testcaseId, status, result } = payload;
  storeSet((state: any) => {
    const nextResults = new Map<string, TestcaseResult>(state.results);
    if (status === 'running') {
      nextResults.set(testcaseId, {
        id: testcaseId,
        lastStatus: 'PENDING',
        execTimeMs: null,
        memoryKb: null,
        actualOutput: null,
        diffInfo: null,
        runAt: Date.now(),
      });
    } else if (status === 'done' && result) {
      nextResults.set(testcaseId, result);
    }

    const fp = state.activeFilePath;
    if (fp) {
      patchCache(fp, { results: nextResults });
    }

    return { results: nextResults };
  });
}

function handleTestcaseImported(payload: any, storeSet: any) {
  const { meta, result } = payload;
  storeSet((state: any) => {
    const nextMetas = new Map<string, TestcaseMeta>(state.metas);
    nextMetas.set(meta.id, meta);

    const nextResults = new Map<string, TestcaseResult>(state.results);
    nextResults.set(result.id, result);

    const nextSubtasks = new Map<string, Subtask>(state.subtasks);
    if (meta.subtaskId !== null) {
      const sub = nextSubtasks.get(meta.subtaskId);
      if (sub) {
        nextSubtasks.set(meta.subtaskId, {
          ...sub,
          testcases: [...sub.testcases.filter((t: any) => t.id !== meta.id), meta],
        });
      }
    }

    const fp = state.activeFilePath;
    if (fp) {
      patchCache(fp, { metas: nextMetas, results: nextResults, subtasks: nextSubtasks });
    }

    return {
      metas: nextMetas,
      results: nextResults,
      subtasks: nextSubtasks,
    };
  });
}

function handleTestcaseListUpdated(payload: any, getStoreState: any) {
  const { filePath } = payload;
  const activeFp = getStoreState().activeFilePath;
  if (!activeFp) {
    return;
  }

  const normalizedPayload = filePath.replace(/\\/g, '/').toLowerCase();
  const normalizedActive = activeFp.replace(/\\/g, '/').toLowerCase();
  if (
    normalizedPayload === normalizedActive ||
    normalizedActive.endsWith(normalizedPayload) ||
    normalizedPayload.endsWith(normalizedActive)
  ) {
    getStoreState().loadForFile(activeFp);
  }
}

export const setupTauriListener = async (storeSet: any, getStoreState: any) => {
  if (!unlistenProgress) {
    unlistenProgress = await listen<any>('judge-progress', (event) => {
      handleJudgeProgress(event.payload, storeSet);
    });
  }

  if (!unlistenImported) {
    unlistenImported = await listen<any>('testcase-imported', (event) => {
      handleTestcaseImported(event.payload, storeSet);
    });
  }

  if (!unlistenUpdated) {
    unlistenUpdated = await listen<any>('testcase-list-updated', (event) => {
      handleTestcaseListUpdated(event.payload, getStoreState);
    });
  }
};
