import { create } from 'zustand';
import { 
  OverlayState, 
  loadOverlays, 
  saveOverlaysBackend, 
  deleteOverlayBackend
} from '../lib/tauri-bridge';
import { useProjectStore } from './useProjectStore';

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
        const loaded = await loadOverlays(filePath);
        const mapped = loaded.map((o, idx) => ({
          ...o,
          zIndex: o.zIndex || (idx + 1),
          isVisible: o.isVisible !== undefined ? o.isVisible : true
        }));

        set(state => ({
          overlays: [...state.overlays, ...mapped],
          loadedFilePaths: [...state.loadedFilePaths, filePath],
          currentFilePath: filePath
        }));
      } else {
        set({ currentFilePath: filePath });
      }
    } catch (err) {
      console.error(`[useOverlayStore] Failed to load overlays for ${filePath}:`, err);
    } finally {
      isSwitching = false;
      if (pendingFilePath) {
        const next = pendingFilePath;
        pendingFilePath = null;
        get().loadOverlaysForFile(next);
      }
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
    if (!currentFilePath) return;
    try {
      const fileOverlays = overlays.filter(o => o.filePath === currentFilePath);
      await saveOverlaysBackend(currentFilePath, fileOverlays);
      const { emit } = await import('@tauri-apps/api/event');
      await emit('overlays-updated');
    } catch (err) {
      console.error(`[useOverlayStore] Failed to save overlays:`, err);
    }
  },
  
  addOverlay: async (type: string, title?: string, content = '') => {
    const filePath = get().currentFilePath || useProjectStore.getState().activeFile;
    if (!filePath) {
      console.warn('[useOverlayStore] Cannot add overlay: no active file path.');
      return;
    }
    
    const defaultTitles: Record<string, string> = {
      scratchpad: 'Sketchpad',
      md: 'Markdown Viewer',
      image: 'Image Viewer',
      pdf: 'PDF Viewer',
      word: 'Word Document',
      notes: 'Notes'
    };
    const finalTitle = title || defaultTitles[type] || 'Overlay Window';

    let finalContent = content;
    if (!finalContent) {
      if (type === 'scratchpad') {
        finalContent = '[]';
      } else if (type === 'notes') {
        finalContent = 'New note...';
      }
    }

    const defaultDimensions: Record<string, { w: number; h: number }> = {
      scratchpad: { w: 500, h: 400 },
      notes: { w: 450, h: 320 },
      md: { w: 450, h: 450 },
      image: { w: 480, h: 360 },
      pdf: { w: 600, h: 500 },
      word: { w: 400, h: 260 },
      diff: { w: 750, h: 500 }
    };
    const dim = defaultDimensions[type] || { w: 400, h: 300 };

    const overlays = get().overlays;
    const maxZ = overlays.reduce((max, o) => Math.max(max, o.zIndex), 0);
    
    const staggerIndex = overlays.length;
    const initialX = 100 + (staggerIndex * 35) % 250;
    const initialY = 80 + (staggerIndex * 30) % 200;

    const newOverlay: OverlayState = {
      id: crypto.randomUUID(),
      filePath,
      type,
      title: finalTitle,
      content: finalContent,
      x: initialX,
      y: initialY,
      width: dim.w,
      height: dim.h,
      isMinimized: false,
      isPinned: false,
      opacity: 1.0,
      isVisible: true,
      zIndex: maxZ + 1
    };
    
    const nextOverlays = [...overlays, newOverlay];
    set({ overlays: nextOverlays });

    try {
      const fileOverlays = nextOverlays.filter(o => o.filePath === filePath);
      await saveOverlaysBackend(filePath, fileOverlays);
      const { emit } = await import('@tauri-apps/api/event');
      await emit('overlays-updated');
    } catch (err) {
      console.error(`[useOverlayStore] Failed to auto-save overlay on add:`, err);
    }
  },
  
  closeOverlay: async (id: string) => {
    const filePath = get().currentFilePath;
    const targetOverlay = get().overlays.find(o => o.id === id);
    const nextOverlays = get().overlays.filter(o => o.id !== id);
    set({ overlays: nextOverlays });
    
    if (filePath && targetOverlay) {
      try {
        await deleteOverlayBackend(targetOverlay.filePath, id);
        const { emit } = await import('@tauri-apps/api/event');
        await emit('overlays-updated');
      } catch (err) {
        console.error(`[useOverlayStore] Failed to delete overlay from backend:`, err);
        try {
          const fileOverlays = nextOverlays.filter(o => o.filePath === targetOverlay.filePath);
          await saveOverlaysBackend(targetOverlay.filePath, fileOverlays);
          const { emit } = await import('@tauri-apps/api/event');
          await emit('overlays-updated');
        } catch (_) {}
      }
    }
  },
  
  minimizeOverlay: async (id: string) => {
    const nextOverlays = get().overlays.map(o => 
      o.id === id ? { ...o, isMinimized: true } : o
    );
    set({ overlays: nextOverlays });

    const target = nextOverlays.find(o => o.id === id);
    if (target && target.filePath) {
      const fileOverlays = nextOverlays.filter(o => o.filePath === target.filePath);
      saveOverlaysBackend(target.filePath, fileOverlays)
        .then(async () => {
          const { emit } = await import('@tauri-apps/api/event');
          await emit('overlays-updated');
        })
        .catch(() => {});
    }
  },
  
  restoreOverlay: async (id: string) => {
    const nextOverlays = get().overlays.map(o => 
      o.id === id ? { ...o, isMinimized: false } : o
    );
    set({ overlays: nextOverlays });
    
    get().bringToFront(id);

    const target = nextOverlays.find(o => o.id === id);
    if (target && target.filePath) {
      const fileOverlays = nextOverlays.filter(o => o.filePath === target.filePath);
      saveOverlaysBackend(target.filePath, fileOverlays)
        .then(async () => {
          const { emit } = await import('@tauri-apps/api/event');
          await emit('overlays-updated');
        })
        .catch(() => {});
    }
  },
  
  togglePin: async (id: string) => {
    const nextOverlays = get().overlays.map(o => {
      if (o.id === id) {
        return { ...o, isPinned: !o.isPinned };
      }
      return o;
    });
    set({ overlays: nextOverlays });

    const target = nextOverlays.find(o => o.id === id);
    if (target && target.filePath) {
      const fileOverlays = nextOverlays.filter(o => o.filePath === target.filePath);
      saveOverlaysBackend(target.filePath, fileOverlays)
        .then(async () => {
          const { emit } = await import('@tauri-apps/api/event');
          await emit('overlays-updated');
        })
        .catch(() => {});
    }
  },
  
  updatePosition: (id: string, x: number, y: number) => {
    const nextOverlays = get().overlays.map(o => 
      o.id === id ? { ...o, x, y } : o
    );
    set({ overlays: nextOverlays });
    triggerDebouncedSave(get);
  },
  
  updateSize: (id: string, w: number, h: number) => {
    const nextOverlays = get().overlays.map(o => 
      o.id === id ? { ...o, width: w, height: h } : o
    );
    set({ overlays: nextOverlays });
    triggerDebouncedSave(get);
  },

  updateContent: (id: string, content: string) => {
    const nextOverlays = get().overlays.map(o => 
      o.id === id ? { ...o, content } : o
    );
    set({ overlays: nextOverlays });
    
    triggerDebouncedSave(get);
  },
  
  updateOverlay: (id: string, updates: Partial<OverlayState>) => {
    const nextOverlays = get().overlays.map(o => 
      o.id === id ? { ...o, ...updates } : o
    );
    set({ overlays: nextOverlays });
    
    triggerDebouncedSave(get);
  },
  
  bringToFront: (id: string) => {
    const overlays = get().overlays;
    const target = overlays.find(o => o.id === id);
    if (!target) return;
    
    const maxZ = overlays.reduce((max, o) => Math.max(max, o.zIndex), 0);
    if (target.zIndex < maxZ || overlays.length === 1) {
      const nextOverlays = overlays.map(o => 
        o.id === id ? { ...o, zIndex: maxZ + 1 } : o
      );
      set({ overlays: nextOverlays });
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
      try {
        const fileOverlays = nextOverlays.filter(o => o.filePath === currentFilePath);
        await saveOverlaysBackend(currentFilePath, fileOverlays);
        const { emit } = await import('@tauri-apps/api/event');
        await emit('overlays-updated');
      } catch (err) {
        console.error('[useOverlayStore] Failed to save show all overlays:', err);
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
