// src/stores/useTestcaseStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TestcaseMeta, TestcaseResult, TestcaseData, Subtask, FileSettings } from '../types/testcase';
import { loadFileSettings, saveFileSettings, importTestcasesFromFolder, compileFile, saveTestcasesCe } from '../lib/tauri-bridge';
import { useProjectStore } from './useProjectStore';
import { writeToTerminal, clearTerminal } from '../lib/terminal';
import { useLayoutStore } from './useLayoutStore';

interface TestcaseState {
  metas: Map<string, TestcaseMeta>;
  results: Map<string, TestcaseResult>;
  loadedData: Map<string, TestcaseData>;
  subtasks: Map<string, Subtask>;
  activeFilePath: string | null;
  fileSettings: FileSettings | null;

  loadForFile: (filePath: string) => Promise<void>;
  loadData: (id: string) => Promise<void>;
  updateResult: (result: TestcaseResult) => void;
  addTestcase: (input?: string, expected?: string, subtaskId?: string | null) => Promise<void>;
  deleteTestcase: (id: string) => Promise<void>;
  reorder: (ids: string[]) => void;
  
  // Subtask actions
  addSubtask: (name: string, maxScore: number) => Promise<void>;
  deleteSubtask: (subtaskId: string) => Promise<void>;
  assignToSubtask: (testcaseId: string, subtaskId: string | null) => Promise<void>;
  
  // Data updates
  updateTestcaseData: (id: string, input: string, expectedOutput: string) => Promise<void>;
  toggleTestcaseActive: (id: string) => Promise<void>;
  simulateRun: (id?: string | string[]) => Promise<void>;
  cancelRun: () => void;

  // File settings actions
  loadFileSettings: (filePath: string) => Promise<void>;
  saveFileSettings: (settings: FileSettings) => Promise<void>;

  // Folder import action
  importFromFolder: (folderPath: string) => Promise<void>;

  isCompiling: boolean;
  cancelCompile: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level context cache (không nằm trong Zustand state để không trigger
// re-render khi cache update, vì cache là implementation detail, không phải UI state)
// ─────────────────────────────────────────────────────────────────────────────

interface CachedContext {
  metas: Map<string, TestcaseMeta>;
  results: Map<string, TestcaseResult>;
  subtasks: Map<string, Subtask>;
  settings: FileSettings;
}

const MAX_CACHE_SIZE = 15;
const contextCache = new Map<string, CachedContext>();

/** Upsert vào cache với LRU eviction (Map duy trì insertion order) */
function upsertCache(filePath: string, entry: CachedContext) {
  contextCache.delete(filePath); // xoá trước để re-insert ở cuối (LRU "recently used")
  contextCache.set(filePath, entry);
  if (contextCache.size > MAX_CACHE_SIZE) {
    // Xoá entry cũ nhất (đầu tiên trong Map)
    const oldest = contextCache.keys().next().value;
    if (oldest) contextCache.delete(oldest);
  }
}

/** Cập nhật một phần của cache entry đã tồn tại */
function patchCache(filePath: string, updates: Partial<CachedContext>) {
  const existing = contextCache.get(filePath);
  if (existing) {
    upsertCache(filePath, { ...existing, ...updates });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback UUID v4 generator
// ─────────────────────────────────────────────────────────────────────────────

const generateUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Tauri event listeners
// ─────────────────────────────────────────────────────────────────────────────

let unlistenProgress: (() => void) | null = null;
let unlistenImported: (() => void) | null = null;

const setupTauriListener = async (storeSet: any) => {
  if (!unlistenProgress) {
    unlistenProgress = await listen<any>('judge-progress', (event) => {
      const payload = event.payload;
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

        // Đồng thời cập nhật cache để lần chuyển tab sau không bị stale
        const fp = state.activeFilePath;
        if (fp) patchCache(fp, { results: nextResults });

        return { results: nextResults };
      });
    });
  }

  if (!unlistenImported) {
    unlistenImported = await listen<any>('testcase-imported', (event) => {
      const { meta, result } = event.payload;
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
        if (fp) patchCache(fp, { metas: nextMetas, results: nextResults, subtasks: nextSubtasks });

        return {
          metas: nextMetas,
          results: nextResults,
          subtasks: nextSubtasks,
        };
      });
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

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
    // ════════════════════════════════════════════════════════
    // Bước 1: Render NGAY LẬP TỨC từ cache (0ms delay)
    // ════════════════════════════════════════════════════════
    const cached = contextCache.get(filePath);
    if (cached) {
      set({
        metas: cached.metas,
        results: cached.results,
        subtasks: cached.subtasks,
        fileSettings: cached.settings,
        loadedData: new Map(),      // clear lazy data, sẽ load lại khi expand
        activeFilePath: filePath,
      });
    } else {
      // Chưa có cache: xoá data của file cũ ngay để tránh hiển thị data sai
      set({
        metas: new Map(),
        results: new Map(),
        subtasks: new Map(),
        fileSettings: null,
        loadedData: new Map(),
        activeFilePath: filePath,
      });
    }

    // ════════════════════════════════════════════════════════
    // Bước 2: Background fetch để lấy data mới nhất từ DB
    // ════════════════════════════════════════════════════════
    try {
      const context = await invoke<{
        subtasks: Subtask[];
        metas: TestcaseMeta[];
        results: TestcaseResult[];
        settings: FileSettings;
      }>('load_file_context', { filePath });

      const metas = new Map<string, TestcaseMeta>();
      context.metas.forEach(m => metas.set(m.id, m));

      const results = new Map<string, TestcaseResult>();
      context.results.forEach(r => results.set(r.id, r));

      const subtasks = new Map<string, Subtask>();
      context.subtasks.forEach(s => {
        subtasks.set(s.id, {
          ...s,
          testcases: context.metas.filter(m => m.subtaskId === s.id)
        });
      });

      const entry: CachedContext = {
        metas,
        results,
        subtasks,
        settings: context.settings,
      };

      // Luôn cập nhật cache bất kể tab nào đang active
      upsertCache(filePath, entry);

      // Race-condition guard: chỉ update store nếu file này vẫn đang active
      // (tránh trường hợp user chuyển tab A→B→C nhanh, response của B về sau C)
      if (get().activeFilePath === filePath) {
        set({
          metas,
          results,
          subtasks,
          fileSettings: context.settings,
        });
      }

      await setupTauriListener(set);
    } catch (err) {
      console.error("Failed to load data from project DB:", err);
    }
  },

  loadData: async (id) => {
    const existing = get().loadedData.get(id);
    if (!existing) {
      try {
        const data = await invoke<TestcaseData>('load_testcase_data', { id, filePath: get().activeFilePath });
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
    
    const maxOrderIndex = Array.from(get().metas.values())
      .reduce((max, tc) => Math.max(max, tc.orderIndex), -1);
    const orderIndex = maxOrderIndex + 1;
    const name = `Test ${orderIndex + 1}`;

    const newMeta: TestcaseMeta = {
      id,
      filePath,
      name,
      orderIndex,
      subtaskId,
      isActive: true,
    };

    const newData: TestcaseData = {
      id,
      input,
      expectedOutput: expected,
    };

    try {
      await invoke('add_testcase', {
        id,
        filePath,
        name,
        orderIndex,
        input,
        expectedOutput: expected,
        subtaskId,
      });

      set((state) => {
        const nextMetas = new Map(state.metas);
        nextMetas.set(id, newMeta);

        const nextData = new Map(state.loadedData);
        nextData.set(id, newData);

        const nextSubtasks = new Map(state.subtasks);
        if (subtaskId !== null) {
          const sub = nextSubtasks.get(subtaskId);
          if (sub) {
            nextSubtasks.set(subtaskId, {
              ...sub,
              testcases: [...sub.testcases, newMeta],
            });
          }
        }

        // Sync metas/subtasks vào cache
        patchCache(filePath, { metas: nextMetas, subtasks: nextSubtasks });

        return {
          metas: nextMetas,
          loadedData: nextData,
          subtasks: nextSubtasks,
        };
      });
    } catch (err) {
      console.error("Error adding testcase to DB:", err);
    }
  },

  deleteTestcase: async (id) => {
    const filePath = get().activeFilePath;
    try {
      await invoke('delete_testcase', { id, filePath });

      set((state) => {
        const nextMetas = new Map(state.metas);
        const meta = nextMetas.get(id);
        nextMetas.delete(id);

        const nextData = new Map(state.loadedData);
        nextData.delete(id);

        const nextResults = new Map(state.results);
        nextResults.delete(id);

        const nextSubtasks = new Map(state.subtasks);
        if (meta && meta.subtaskId !== null) {
          const sub = nextSubtasks.get(meta.subtaskId);
          if (sub) {
            nextSubtasks.set(meta.subtaskId, {
              ...sub,
              testcases: sub.testcases.filter((t) => t.id !== id),
            });
          }
        }

        // Sync vào cache
        if (filePath) patchCache(filePath, { metas: nextMetas, results: nextResults, subtasks: nextSubtasks });

        return {
          metas: nextMetas,
          loadedData: nextData,
          results: nextResults,
          subtasks: nextSubtasks,
        };
      });
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
      await invoke('add_subtask', {
        id,
        filePath,
        name,
        maxScore,
        orderIndex,
      });

      set((state) => {
        const nextSubtasks = new Map(state.subtasks);
        nextSubtasks.set(id, {
          id,
          filePath,
          name,
          maxScore,
          orderIndex,
          testcases: [],
        });

        patchCache(filePath, { subtasks: nextSubtasks });

        return { subtasks: nextSubtasks };
      });
    } catch (err) {
      console.error("Error creating new subtask:", err);
    }
  },

  deleteSubtask: async (subtaskId) => {
    const filePath = get().activeFilePath;
    try {
      await invoke('delete_subtask', { id: subtaskId, filePath });

      set((state) => {
        const nextSubtasks = new Map(state.subtasks);
        nextSubtasks.delete(subtaskId);

        const nextMetas = new Map(state.metas);
        nextMetas.forEach((meta, id) => {
          if (meta.subtaskId === subtaskId) {
            nextMetas.set(id, { ...meta, subtaskId: null });
          }
        });

        if (filePath) patchCache(filePath, { subtasks: nextSubtasks, metas: nextMetas });

        return {
          subtasks: nextSubtasks,
          metas: nextMetas,
        };
      });
    } catch (err) {
      console.error("Error deleting subtask from DB:", err);
    }
  },

  assignToSubtask: async (testcaseId, subtaskId) => {
    const metasMap = get().metas;
    const meta = metasMap.get(testcaseId);
    if (!meta) return;

    const filePath = get().activeFilePath;

    const targetTestcases = Array.from(metasMap.values())
      .filter((t) => t.subtaskId === subtaskId && t.id !== testcaseId);
    const maxOrder = targetTestcases.reduce((max, t) => Math.max(max, t.orderIndex), -1);
    const newOrderIndex = maxOrder + 1;

    try {
      await invoke('assign_to_subtask', {
        testcaseId,
        subtaskId,
        orderIndex: newOrderIndex,
        filePath,
      });

      set((state) => {
        const nextMetas = new Map(state.metas);
        const oldSubtaskId = meta.subtaskId;
        const updatedMeta = { ...meta, subtaskId, orderIndex: newOrderIndex };
        nextMetas.set(testcaseId, updatedMeta);

        const nextSubtasks = new Map(state.subtasks);
        
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

        if (filePath) patchCache(filePath, { metas: nextMetas, subtasks: nextSubtasks });

        return {
          metas: nextMetas,
          subtasks: nextSubtasks,
        };
      });
    } catch (err) {
      console.error("Error assigning subtask to testcase:", err);
    }
  },

  updateTestcaseData: async (id, input, expectedOutput) => {
    try {
      await invoke('update_testcase_data', { id, input, expectedOutput, filePath: get().activeFilePath });
      
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
    try {
      await invoke('toggle_testcase_active', { id, filePath });

      set((state) => {
        const nextMetas = new Map(state.metas);
        const meta = nextMetas.get(id);
        if (meta) {
          nextMetas.set(id, { ...meta, isActive: !meta.isActive });
        }

        if (filePath) patchCache(filePath, { metas: nextMetas });

        return { metas: nextMetas };
      });
    } catch (err) {
      console.error("Error toggling active testcase:", err);
    }
  },

  simulateRun: async (id) => {
    const activeFilePath = get().activeFilePath;
    if (!activeFilePath) return;

    if (get().isCompiling) return;

    await setupTauriListener(set);

    const sortedActiveIds = (() => {
      const metasArr = Array.from(get().metas.values());
      const subtasksArr = Array.from(get().subtasks.values()).sort((a, b) => a.orderIndex - b.orderIndex);
      
      const orderedIds: string[] = [];
      
      subtasksArr.forEach(sub => {
        const subMetas = metasArr
          .filter(m => m.subtaskId === sub.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        subMetas.forEach(m => orderedIds.push(m.id));
      });
      
      const ungrouped = metasArr
        .filter(m => m.subtaskId === null)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      ungrouped.forEach(m => orderedIds.push(m.id));
      
      return orderedIds;
    })();

    const idsToRun = id !== undefined 
      ? (Array.isArray(id) ? id : [id]) 
      : sortedActiveIds.filter(tcId => get().metas.get(tcId)?.isActive);

    if (idsToRun.length === 0) return;

    if (activeFilePath.endsWith('.cpp')) {
      clearTerminal();
      writeToTerminal(`Compiling file ${activeFilePath}...\n`);
      set({ isCompiling: true });
      try {
        await useProjectStore.getState().saveActiveFile();
        
        const projectRoot = useProjectStore.getState().rootPath || '';
        const compilerFlags = get().fileSettings?.compilerFlags || '';
        const flags = compilerFlags.split(/\s+/).filter(Boolean);
        
        const compileResult = await compileFile({
          filePath: activeFilePath,
          flags,
          projectRoot,
        });

        if (!get().isCompiling) {
          // Cancelled!
          return;
        }
        set({ isCompiling: false });

        if (compileResult.stderr) {
          writeToTerminal(compileResult.stderr + '\n');
        }

        if (!compileResult.success) {
          useLayoutStore.getState().setTerminalOpen(true);
          writeToTerminal(`\x1b[31mCompilation failed!\x1b[0m\n`);
          
          set((state) => {
            const nextResults = new Map(state.results);
            idsToRun.forEach(tcId => {
              nextResults.set(tcId, {
                id: tcId,
                lastStatus: 'CE',
                execTimeMs: null,
                memoryKb: null,
                actualOutput: null,
                diffInfo: null,
                runAt: Date.now(),
              });
            });
            patchCache(activeFilePath, { results: nextResults });
            return { results: nextResults };
          });

          try {
            await saveTestcasesCe(activeFilePath, idsToRun);
          } catch (dbErr) {
            console.error("Error saving CE to DB:", dbErr);
          }
          return;
        }
        writeToTerminal(`\x1b[32mCompilation successful!\x1b[0m\n`);
      } catch (err: any) {
        set({ isCompiling: false });
        useLayoutStore.getState().setTerminalOpen(true);
        writeToTerminal(`\x1b[31mCompilation failed with error: ${err.message || err}\x1b[0m\n`);
        
        set((state) => {
          const nextResults = new Map(state.results);
          idsToRun.forEach(tcId => {
            nextResults.set(tcId, {
              id: tcId,
              lastStatus: 'CE',
              execTimeMs: null,
              memoryKb: null,
              actualOutput: null,
              diffInfo: null,
              runAt: Date.now(),
            });
          });
          patchCache(activeFilePath, { results: nextResults });
          return { results: nextResults };
        });

        try {
          await saveTestcasesCe(activeFilePath, idsToRun);
        } catch (dbErr) {
          console.error("Error saving CE to DB:", dbErr);
        }
        return;
      }
    }

    // Đặt trạng thái QUEUED cho tất cả testcase sắp chạy
    set((state: any) => {
      const nextResults = new Map<string, TestcaseResult>(state.results);
      idsToRun.forEach(tcId => {
        nextResults.set(tcId, {
          id: tcId,
          lastStatus: 'QUEUED',
          execTimeMs: null,
          memoryKb: null,
          actualOutput: null,
          diffInfo: null,
          runAt: Date.now(),
        });
      });
      return { results: nextResults };
    });

    try {
      await invoke('run_testcases', {
        filePath: activeFilePath,
        testcaseIds: idsToRun,
      });
    } catch (err: any) {
      console.error("Error running testcases from backend:", err);
      set((state: any) => {
        const nextResults = new Map<string, TestcaseResult>(state.results);
        idsToRun.forEach(tcId => {
          if (nextResults.get(tcId)?.lastStatus === 'QUEUED') {
            nextResults.delete(tcId);
          }
        });
        return { results: nextResults };
      });
      alert(err.message || err);
    }
  },

  cancelRun: async () => {
    try {
      await invoke('stop_testcases');
      
      set((state: any) => {
        const nextResults = new Map<string, TestcaseResult>(state.results);
        let changed = false;
        nextResults.forEach((res, key) => {
          if (res.lastStatus === 'PENDING' || res.lastStatus === 'QUEUED') {
            nextResults.set(key, {
              ...res,
              lastStatus: null,
              execTimeMs: null,
              memoryKb: null,
            });
            changed = true;
          }
        });
        return changed ? { results: nextResults } : {};
      });
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
      // Sync settings vào cache
      const fp = get().activeFilePath;
      if (fp) patchCache(fp, { settings });
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
