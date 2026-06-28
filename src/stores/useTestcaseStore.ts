// src/stores/useTestcaseStore.ts

import { create } from 'zustand';
import { TestcaseMeta, TestcaseData } from '../types/testcase';
import {
  loadFileSettings,
  saveFileSettings,
  importTestcasesFromFolder,
  addTestcase,
  deleteTestcase,
  addSubtask,
  deleteSubtask,
  assignToSubtask,
  updateTestcaseData,
  toggleTestcaseActive,
  stopTestcases,
  loadTestcaseData
} from '../lib/tauri-bridge';
import { writeToTerminal } from '../lib/terminal';
import { patchCache } from './testcase/cache';
import { setupTauriListener } from './testcase/listeners';
import {
  generateUuid,
  getIdsToRun
} from './testcase/helpers';
import { TestcaseState } from './testcase/types';
import {
  applyInitialLoadState,
  fetchAndApplyContext,
  getNextOrderIndex,
  updateStateOnAddTestcase,
  updateStateOnDeleteTestcase,
  updateStateOnAddSubtask,
  updateStateOnDeleteSubtask,
  computeAssignOrderIndex,
  updateStateOnAssignToSubtask,
  updateStateOnToggleActive
} from './testcase/stateHelpers';
import {
  compileCppAndSave,
  setQueuedState,
  triggerRunTestcases,
  updateStateOnCancelRun
} from './testcase/runHelpers';

export const useTestcaseStore = create<TestcaseState>((set, get) => ({
  metas: new Map(),
  results: new Map(),
  loadedData: new Map(),
  subtasks: new Map(),
  activeFilePath: null,
  fileSettings: null,
  isCompiling: false,

  cancelCompile: () => {
    set({ isCompiling: false });
    writeToTerminal(`\x1b[33mCompilation aborted by user!\x1b[0m\n`);
  },

  loadForFile: async (filePath) => {
    applyInitialLoadState(set, filePath);
    await fetchAndApplyContext(filePath, set, get);
  },

  loadData: async (id) => {
    const existing = get().loadedData.get(id);
    if (!existing) {
      try {
        const data = await loadTestcaseData(id, get().activeFilePath || '');
        set((state) => {
          const nextData = new Map(state.loadedData);
          nextData.set(id, data);
          return { loadedData: nextData };
        });
      } catch (err) {
        console.error("Error loading data for testcase:", err);
      }
    }
  },

  updateResult: (result) => {
    set((state) => {
      const nextResults = new Map(state.results);
      nextResults.set(result.id, result);
      return { results: nextResults };
    });
  },

  addTestcase: async (input = '', expected = '', subtaskId = null) => {
    const filePath = get().activeFilePath;
    if (!filePath) return;

    const id = generateUuid();
    const orderIndex = getNextOrderIndex(get().metas);
    const name = `Test ${orderIndex + 1}`;

    const newMeta: TestcaseMeta = { id, filePath, name, orderIndex, subtaskId, isActive: true };
    const newData: TestcaseData = { id, input, expectedOutput: expected };

    try {
      await addTestcase({
        id,
        filePath,
        name,
        orderIndex,
        input,
        expectedOutput: expected,
        subtaskId,
      });
      updateStateOnAddTestcase(set, id, newMeta, newData, subtaskId, filePath);
    } catch (err) {
      console.error("Error adding testcase to DB:", err);
    }
  },

  deleteTestcase: async (id) => {
    const filePath = get().activeFilePath;
    if (!filePath) return;
    try {
      await deleteTestcase(id, filePath);
      updateStateOnDeleteTestcase(set, id, filePath);
    } catch (err) {
      console.error("Error deleting testcase from DB:", err);
    }
  },

  reorder: (ids) => {
    set((state) => {
      const nextMetas = new Map(state.metas);
      ids.forEach((id, idx) => {
        const meta = nextMetas.get(id);
        if (meta) {
          nextMetas.set(id, { ...meta, orderIndex: idx });
        }
      });
      return { metas: nextMetas };
    });
  },

  addSubtask: async (name, maxScore) => {
    const filePath = get().activeFilePath;
    if (!filePath) return;

    const id = generateUuid();
    const orderIndex = get().subtasks.size;

    try {
      await addSubtask({ id, filePath, name, maxScore, orderIndex });
      updateStateOnAddSubtask(set, id, filePath, name, maxScore, orderIndex);
    } catch (err) {
      console.error("Error creating new subtask:", err);
    }
  },

  deleteSubtask: async (subtaskId) => {
    const filePath = get().activeFilePath;
    if (!filePath) return;
    try {
      await deleteSubtask(subtaskId, filePath);
      updateStateOnDeleteSubtask(set, subtaskId, filePath);
    } catch (err) {
      console.error("Error deleting subtask from DB:", err);
    }
  },

  assignToSubtask: async (testcaseId, subtaskId) => {
    const meta = get().metas.get(testcaseId);
    const filePath = get().activeFilePath;
    if (!meta || !filePath) return;

    const newOrderIndex = computeAssignOrderIndex(get().metas, subtaskId, testcaseId);
    const updatedMeta = { ...meta, subtaskId, orderIndex: newOrderIndex };

    try {
      await assignToSubtask({ testcaseId, subtaskId, orderIndex: newOrderIndex, filePath });
      updateStateOnAssignToSubtask(set, testcaseId, subtaskId, updatedMeta, filePath, meta.subtaskId);
    } catch (err) {
      console.error("Error assigning subtask to testcase:", err);
    }
  },

  updateTestcaseData: async (id, input, expectedOutput) => {
    try {
      await updateTestcaseData({ id, input, expectedOutput, filePath: get().activeFilePath });
      set((state) => {
        const nextData = new Map(state.loadedData);
        nextData.set(id, { id, input, expectedOutput });
        return { loadedData: nextData };
      });
    } catch (err) {
      console.error("Error saving testcase data:", err);
    }
  },

  toggleTestcaseActive: async (id) => {
    const filePath = get().activeFilePath;
    if (!filePath) return;
    try {
      await toggleTestcaseActive(id, filePath);
      updateStateOnToggleActive(set, id, filePath);
    } catch (err) {
      console.error("Error toggling active testcase:", err);
    }
  },

  simulateRun: async (id) => {
    const activeFilePath = get().activeFilePath;
    if (!activeFilePath || get().isCompiling) return;

    await setupTauriListener(set, get);

    const idsToRun = getIdsToRun(get().metas, get().subtasks, id);
    if (idsToRun.length === 0) return;

    if (activeFilePath.endsWith('.cpp')) {
      const compiled = await compileCppAndSave(
        activeFilePath,
        get().fileSettings?.compilerFlags || '',
        set,
        get,
        idsToRun
      );
      if (!compiled) return;
    }

    setQueuedState(set, idsToRun);
    await triggerRunTestcases(activeFilePath, idsToRun, set);
  },

  cancelRun: async () => {
    try {
      await stopTestcases();
      updateStateOnCancelRun(set);
    } catch (err) {
      console.error("Error stopping testcases:", err);
    }
  },

  loadFileSettings: async (filePath) => {
    try {
      const settings = await loadFileSettings(filePath);
      set({ fileSettings: settings });
    } catch (err) {
      console.error("Error loading file settings:", err);
    }
  },

  saveFileSettings: async (settings) => {
    try {
      await saveFileSettings(settings);
      set({ fileSettings: settings });
      const fp = get().activeFilePath;
      if (fp) {
        patchCache(fp, { settings });
      }
    } catch (err) {
      console.error("Error saving file settings:", err);
    }
  },

  importFromFolder: async (folderPath) => {
    const activeFilePath = get().activeFilePath;
    if (!activeFilePath) return;

    try {
      await importTestcasesFromFolder(folderPath, activeFilePath);
    } catch (err) {
      console.error("Error importing testcases from folder:", err);
      alert(typeof err === 'string' ? err : JSON.stringify(err));
    }
  },
}));
