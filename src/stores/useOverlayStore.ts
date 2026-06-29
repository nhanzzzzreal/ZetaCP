import { create } from 'zustand';
import { 
  OverlayState, 
  loadOverlays, 
} from '../lib/tauri-bridge';
import { useProjectStore } from './useProjectStore';
import {
  getDefaultTitle,
  getDefaultContent,
  getDefaultDimensions,
  createOverlayState,
  saveOverlayState,
  loadAndSetOverlays,
  deleteOverlayState
} from './overlayHelpers';

export type { OverlayState };
export type Overlay = OverlayState;

export interface OverlayLog {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  source: 'compiler' | 'judge' | 'system';
  message: string;
  details?: string;
  time: string;
}

interface OverlayStoreState {
  overlays: OverlayState[];
  loadedFilePaths: string[];
  showAll: boolean;
  currentFilePath: string | null;
  logs: OverlayLog[];
  
  loadOverlaysForFile: (filePath: string) => Promise<void>;
  syncOverlays: (filePath: string) => Promise<void>;
  saveOverlays: () => Promise<void>;
  addOverlay: (type: string, title?: string, content?: string) => Promise<void>;
  closeOverlay: (id: string) => Promise<void>;
  minimizeOverlay: (id: string) => Promise<void>;
  restoreOverlay: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  updatePosition: (id: string, x: number, y: number) => void;
  updateSize: (id: string, w: number, h: number) => void;
  updateContent: (id: string, content: string) => void;
  updateOverlay: (id: string, updates: Partial<OverlayState>) => void;
  bringToFront: (id: string) => void;
  toggleShowAll: () => Promise<void>;
  toggleCalculator: () => void;
  
  addLog: (type: 'success' | 'warning' | 'error' | 'info', source: 'compiler' | 'judge' | 'system', message: string, details?: string) => void;
  clearLogs: () => void;
}

let saveTimeout: any = null;
let isSwitching = false;
let pendingFilePath: string | null = null;

const triggerDebouncedSave = (get: any) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await get().saveOverlays();
  }, 400);
};

const handlePendingLoad = (get: any) => {
  if (pendingFilePath) {
    const next = pendingFilePath;
    pendingFilePath = null;
    get().loadOverlaysForFile(next);
  }
};

const applyOverlayChange = (set: any, get: any, id: string, mapper: (o: OverlayState) => OverlayState) => {
  const nextOverlays = get().overlays.map((o: OverlayState) => o.id === id ? mapper(o) : o);
  set({ overlays: nextOverlays });
  return nextOverlays;
};

const saveTargetOverlay = (nextOverlays: OverlayState[], id: string) => {
  const target = nextOverlays.find(o => o.id === id);
  if (target && target.filePath) {
    saveOverlayState(target.filePath, nextOverlays).catch(() => {});
  }
};

export const useOverlayStore = create<OverlayStoreState>((set, get) => ({
  overlays: [],
  loadedFilePaths: [],
  showAll: true,
  currentFilePath: null,
  logs: [],
  
  loadOverlaysForFile: async (filePath: string) => {
    if (isSwitching) {
      pendingFilePath = filePath;
      return;
    }
    isSwitching = true;
    pendingFilePath = null;
    try {
      const isLoaded = get().loadedFilePaths.includes(filePath);
      if (!isLoaded) {
        await loadAndSetOverlays(filePath, set);
      } else {
        set({ currentFilePath: filePath });
      }
    } catch (err) {
      console.error(`[useOverlayStore] Failed to load overlays for ${filePath}:`, err);
    } finally {
      isSwitching = false;
      handlePendingLoad(get);
    }
  },

  syncOverlays: async (filePath: string) => {
    try {
      const loaded = await loadOverlays(filePath);
      const mapped = loaded.map((o, idx) => ({
        ...o,
        zIndex: o.zIndex || (idx + 1),
        isVisible: o.isVisible !== undefined ? o.isVisible : true
      }));
      set(state => ({
        overlays: [
          ...state.overlays.filter(o => o.filePath !== filePath),
          ...mapped
        ],
        loadedFilePaths: state.loadedFilePaths.includes(filePath)
          ? state.loadedFilePaths
          : [...state.loadedFilePaths, filePath],
        currentFilePath: filePath
      }));
    } catch (err) {
      console.error(`[useOverlayStore] Failed to sync overlays for ${filePath}:`, err);
    }
  },
  
  saveOverlays: async () => {
    const { overlays, currentFilePath } = get();
    if (currentFilePath) {
      await saveOverlayState(currentFilePath, overlays);
    }
  },
  
  addOverlay: async (type: string, title?: string, content = '') => {
    const filePath = get().currentFilePath || useProjectStore.getState().activeFile;
    if (!filePath) {
      console.warn('[useOverlayStore] Cannot add overlay: no active file path.');
      return;
    }
    const finalTitle = getDefaultTitle(type, title);
    const finalContent = getDefaultContent(type, content);
    const dim = getDefaultDimensions(type);
    const overlays = get().overlays;
    const maxZ = overlays.reduce((max, o) => Math.max(max, o.zIndex), 0);
    
    const newOverlay = createOverlayState({
      filePath,
      type,
      title: finalTitle,
      content: finalContent,
      staggerIndex: overlays.length,
      maxZ,
      dim
    });
    
    const nextOverlays = [...overlays, newOverlay];
    set({ overlays: nextOverlays });
    await saveOverlayState(filePath, nextOverlays);
  },
  
  closeOverlay: async (id: string) => {
    const filePath = get().currentFilePath;
    const targetOverlay = get().overlays.find(o => o.id === id);
    const nextOverlays = get().overlays.filter(o => o.id !== id);
    set({ overlays: nextOverlays });
    
    if (filePath && targetOverlay) {
      await deleteOverlayState(targetOverlay.filePath, id, nextOverlays);
    }
  },
  
  minimizeOverlay: async (id: string) => {
    const nextOverlays = applyOverlayChange(set, get, id, o => ({ ...o, isMinimized: true }));
    saveTargetOverlay(nextOverlays, id);
  },
  
  restoreOverlay: async (id: string) => {
    const nextOverlays = applyOverlayChange(set, get, id, o => ({ ...o, isMinimized: false }));
    get().bringToFront(id);
    saveTargetOverlay(nextOverlays, id);
  },
  
  togglePin: async (id: string) => {
    const nextOverlays = applyOverlayChange(set, get, id, o => ({ ...o, isPinned: !o.isPinned }));
    saveTargetOverlay(nextOverlays, id);
  },
  
  updatePosition: (id: string, x: number, y: number) => {
    applyOverlayChange(set, get, id, o => ({ ...o, x, y }));
    triggerDebouncedSave(get);
  },
  
  updateSize: (id: string, w: number, h: number) => {
    applyOverlayChange(set, get, id, o => ({ ...o, width: w, height: h }));
    triggerDebouncedSave(get);
  },

  updateContent: (id: string, content: string) => {
    applyOverlayChange(set, get, id, o => ({ ...o, content }));
    triggerDebouncedSave(get);
  },
  
  updateOverlay: (id: string, updates: Partial<OverlayState>) => {
    applyOverlayChange(set, get, id, o => ({ ...o, ...updates }));
    triggerDebouncedSave(get);
  },
  
  bringToFront: (id: string) => {
    const overlays = get().overlays;
    const target = overlays.find(o => o.id === id);
    if (!target) return;
    
    const maxZ = overlays.reduce((max, o) => Math.max(max, o.zIndex), 0);
    if (target.zIndex < maxZ || overlays.length === 1) {
      applyOverlayChange(set, get, id, o => ({ ...o, zIndex: maxZ + 1 }));
    }
  },
  
  toggleShowAll: async () => {
    const nextShowAll = !get().showAll;
    const currentFilePath = get().currentFilePath;
    const nextOverlays = get().overlays.map(o =>
      o.isMinimized || o.filePath !== currentFilePath ? o : { ...o, isVisible: nextShowAll }
    );
    set({ overlays: nextOverlays, showAll: nextShowAll });

    if (currentFilePath) {
      await saveOverlayState(currentFilePath, nextOverlays);
    }
  },

  toggleCalculator: () => {
    const overlays = get().overlays;
    const existing = overlays.find(o => o.type === 'calculator');
    if (!existing) {
      const dim = getDefaultDimensions('calculator');
      const maxZ = overlays.reduce((max, o) => Math.max(max, o.zIndex), 0);
      const newOverlay = createOverlayState({
        filePath: 'GLOBAL',
        type: 'calculator',
        title: 'CP Calculator',
        content: '',
        staggerIndex: overlays.length,
        maxZ,
        dim
      });
      set({ overlays: [...overlays, newOverlay] });
    } else {
      if (!existing.isVisible || existing.isMinimized) {
        set({
          overlays: overlays.map(o =>
            o.id === existing.id ? { ...o, isVisible: true, isMinimized: false } : o
          )
        });
        get().bringToFront(existing.id);
      } else {
        set({
          overlays: overlays.map(o =>
            o.id === existing.id ? { ...o, isVisible: false } : o
          )
        });
      }
    }
  },
  
  addLog: (type, source, message, details) => {
    const newLog: OverlayLog = {
      id: crypto.randomUUID(),
      type,
      source,
      message,
      details,
      time: new Date().toLocaleTimeString(),
    };
    set(state => ({ logs: [newLog, ...state.logs] }));
  },
  
  clearLogs: () => {
    set({ logs: [] });
  }
}));
