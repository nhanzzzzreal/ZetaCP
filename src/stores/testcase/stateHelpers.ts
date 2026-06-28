// src/stores/testcase/stateHelpers.ts

import { StoreApi } from 'zustand';
import type { TestcaseMeta, TestcaseResult, TestcaseData, Subtask, FileContext } from '../../types/testcase';
import { loadFileContext } from '../../lib/tauri-bridge';
import { contextCache, upsertCache, patchCache } from './cache';
import { setupTauriListener } from './listeners';
import { TestcaseState } from './types';

export type SetStateFn = StoreApi<TestcaseState>['setState'];

export function applyInitialLoadState(set: SetStateFn, filePath: string) {
  const cached = contextCache.get(filePath);
  if (cached) {
    set({
      metas: cached.metas,
      results: cached.results,
      subtasks: cached.subtasks,
      fileSettings: cached.settings,
      loadedData: new Map(),
      activeFilePath: filePath,
    });
    return;
  }
  set({
    metas: new Map(),
    results: new Map(),
    subtasks: new Map(),
    fileSettings: null,
    loadedData: new Map(),
    activeFilePath: filePath,
  });
}

export function buildContextMaps(context: FileContext) {
  const metas = new Map<string, TestcaseMeta>();
  context.metas.forEach((m: TestcaseMeta) => metas.set(m.id, m));

  const results = new Map<string, TestcaseResult>();
  context.results.forEach((r: TestcaseResult) => results.set(r.id, r));

  const subtasks = new Map<string, Subtask>();
  context.subtasks.forEach((s: Subtask) => {
    subtasks.set(s.id, {
      ...s,
      testcases: context.metas.filter((m: TestcaseMeta) => m.subtaskId === s.id)
    });
  });

  return { metas, results, subtasks };
}

export async function fetchAndApplyContext(filePath: string, set: SetStateFn, get: () => TestcaseState) {
  try {
    const context = await loadFileContext(filePath);
    const { metas, results, subtasks } = buildContextMaps(context);
    const entry = { metas, results, subtasks, settings: context.settings };

    upsertCache(filePath, entry);

    if (get().activeFilePath === filePath) {
      set({ metas, results, subtasks, fileSettings: context.settings });
    }
    await setupTauriListener(set, get);
  } catch (err: unknown) {
    console.error("Failed to load data from project DB:", err);
  }
}

export function getNextOrderIndex(metas: Map<string, TestcaseMeta>): number {
  const maxOrderIndex = Array.from(metas.values())
    .reduce((max, tc) => Math.max(max, tc.orderIndex), -1);
  return maxOrderIndex + 1;
}

export function updateStateOnAddTestcase(
  set: SetStateFn,
  id: string,
  newMeta: TestcaseMeta,
  newData: TestcaseData,
  subtaskId: string | null,
  filePath: string
) {
  set((state: TestcaseState) => {
    const nextMetas = new Map<string, TestcaseMeta>(state.metas);
    nextMetas.set(id, newMeta);

    const nextData = new Map<string, TestcaseData>(state.loadedData);
    nextData.set(id, newData);

    const nextSubtasks = new Map<string, Subtask>(state.subtasks);
    if (subtaskId !== null) {
      const sub = nextSubtasks.get(subtaskId);
      if (sub) {
        nextSubtasks.set(subtaskId, {
          ...sub,
          testcases: [...sub.testcases.filter((t) => t.id !== newMeta.id), newMeta],
        });
      }
    }

    patchCache(filePath, { metas: nextMetas, subtasks: nextSubtasks });

    return { metas: nextMetas, loadedData: nextData, subtasks: nextSubtasks };
  });
}

export function updateStateOnDeleteTestcase(set: SetStateFn, id: string, filePath: string) {
  set((state: TestcaseState) => {
    const nextMetas = new Map<string, TestcaseMeta>(state.metas);
    const meta = nextMetas.get(id);
    nextMetas.delete(id);

    const nextData = new Map<string, TestcaseData>(state.loadedData);
    nextData.delete(id);

    const nextResults = new Map<string, TestcaseResult>(state.results);
    nextResults.delete(id);

    const nextSubtasks = new Map<string, Subtask>(state.subtasks);
    if (meta && meta.subtaskId !== null) {
      const sub = nextSubtasks.get(meta.subtaskId);
      if (sub) {
        nextSubtasks.set(meta.subtaskId, {
          ...sub,
          testcases: sub.testcases.filter((t) => t.id !== id),
        });
      }
    }

    patchCache(filePath, { metas: nextMetas, results: nextResults, subtasks: nextSubtasks });

    return { metas: nextMetas, loadedData: nextData, results: nextResults, subtasks: nextSubtasks };
  });
}

export function updateStateOnAddSubtask(
  set: SetStateFn,
  id: string,
  filePath: string,
  name: string,
  maxScore: number,
  orderIndex: number
) {
  set((state: TestcaseState) => {
    const nextSubtasks = new Map<string, Subtask>(state.subtasks);
    nextSubtasks.set(id, { id, filePath, name, maxScore, orderIndex, testcases: [] });
    patchCache(filePath, { subtasks: nextSubtasks });
    return { subtasks: nextSubtasks };
  });
}

export function updateStateOnDeleteSubtask(set: SetStateFn, subtaskId: string, filePath: string) {
  set((state: TestcaseState) => {
    const nextSubtasks = new Map<string, Subtask>(state.subtasks);
    nextSubtasks.delete(subtaskId);

    const nextMetas = new Map<string, TestcaseMeta>(state.metas);
    nextMetas.forEach((meta, id) => {
      if (meta.subtaskId === subtaskId) {
        nextMetas.set(id, { ...meta, subtaskId: null });
      }
    });

    patchCache(filePath, { subtasks: nextSubtasks, metas: nextMetas });

    return { subtasks: nextSubtasks, metas: nextMetas };
  });
}

export function computeAssignOrderIndex(
  metasMap: Map<string, TestcaseMeta>,
  subtaskId: string | null,
  testcaseId: string
): number {
  const targetTestcases = Array.from(metasMap.values())
    .filter((t) => t.subtaskId === subtaskId && t.id !== testcaseId);
  const maxOrder = targetTestcases.reduce((max, t) => Math.max(max, t.orderIndex), -1);
  return maxOrder + 1;
}

export function updateStateOnAssignToSubtask(
  set: SetStateFn,
  testcaseId: string,
  subtaskId: string | null,
  updatedMeta: TestcaseMeta,
  filePath: string,
  oldSubtaskId: string | null
) {
  set((state: TestcaseState) => {
    const nextMetas = new Map<string, TestcaseMeta>(state.metas);
    nextMetas.set(testcaseId, updatedMeta);

    const nextSubtasks = new Map<string, Subtask>(state.subtasks);
    if (oldSubtaskId !== null) {
      const oldSub = nextSubtasks.get(oldSubtaskId);
      if (oldSub) {
        nextSubtasks.set(oldSubtaskId, {
          ...oldSub,
          testcases: oldSub.testcases.filter((t) => t.id !== testcaseId),
        });
      }
    }

    if (subtaskId !== null) {
      const newSub = nextSubtasks.get(subtaskId);
      if (newSub) {
        nextSubtasks.set(subtaskId, {
          ...newSub,
          testcases: [...newSub.testcases.filter((t) => t.id !== testcaseId), updatedMeta],
        });
      }
    }

    patchCache(filePath, { metas: nextMetas, subtasks: nextSubtasks });

    return { metas: nextMetas, subtasks: nextSubtasks };
  });
}

export function updateStateOnToggleActive(set: SetStateFn, id: string, filePath: string) {
  set((state: TestcaseState) => {
    const nextMetas = new Map<string, TestcaseMeta>(state.metas);
    const meta = nextMetas.get(id);
    if (meta) {
      nextMetas.set(id, { ...meta, isActive: !meta.isActive });
    }
    patchCache(filePath, { metas: nextMetas });
    return { metas: nextMetas };
  });
}
