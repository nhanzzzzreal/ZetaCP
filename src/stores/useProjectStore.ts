// src/stores/useProjectStore.ts

import { create } from 'zustand';
import { writeTextFile } from '../lib/tauri-bridge';

export interface FileNode {
  name: string;
  path: string;       // relative path
  isDir: boolean;
  children: FileNode[];
}

interface ProjectState {
  rootPath: string | null;
  activeFile: string | null;
  activeFileContent: string;
  openTabs: string[];
  files: FileNode[];
  dirtyFiles: Record<string, boolean>;
  fileContents: Record<string, string>; // Memory cache for open files content
  cursorPos: { line: number; column: number };
  setCursorPos: (pos: { line: number; column: number }) => void;
  
  openProject: (path: string) => Promise<void>;
  setActiveFile: (path: string | null) => Promise<void>;
  setActiveFileContent: (content: string) => void;
  closeTab: (path: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;
  setFiles: (files: FileNode[]) => void;
  setOpenTabs: (tabs: string[]) => void;
  setFileDirty: (path: string, isDirty: boolean) => void;
  closeDeletedTabs: (deletedPath: string) => Promise<void>;
  renameOpenTabs: (oldPath: string, newPath: string) => Promise<void>;
  setFileContent: (path: string, content: string) => void;
}

let autoSaveTimeout: any = null;

export const useProjectStore = create<ProjectState>((set, get) => ({
  rootPath: null,
  activeFile: null,
  activeFileContent: '',
  openTabs: [],
  files: [],
  dirtyFiles: {},
  fileContents: {},
  cursorPos: { line: 1, column: 1 },
  setCursorPos: (pos) => set({ cursorPos: pos }),
  
  openProject: async (path) => {
    set({ rootPath: path, activeFile: null, activeFileContent: '', openTabs: [], files: [], dirtyFiles: {}, fileContents: {} });
  },
  
  setActiveFile: async (path) => {
    if (path) {
      // 2. Thêm file vào danh sách tabs nếu chưa có
      const tabs = get().openTabs;
      const nextTabs = tabs.includes(path) ? tabs : [...tabs, path];
      const dirty = get().dirtyFiles;
      const nextDirty = { ...dirty, [path]: dirty[path] ?? false };
      
      // Lấy nội dung từ bộ nhớ đệm nếu có
      const cachedContent = get().fileContents[path] ?? '';
      
      set({ 
        activeFile: path, 
        openTabs: nextTabs, 
        dirtyFiles: nextDirty,
        activeFileContent: cachedContent
      });
    } else {
      set({ activeFile: null, activeFileContent: '' });
    }
  },
  
  setActiveFileContent: (content) => {
    const { activeFile, fileContents, rootPath } = get();
    const nextContents = { ...fileContents };
    if (activeFile) {
      nextContents[activeFile] = content;
    }
    set({ activeFileContent: content, fileContents: nextContents });

    // Tự động lưu sau 1 giây kể từ lần gõ cuối cùng
    if (activeFile && rootPath) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      autoSaveTimeout = setTimeout(async () => {
        try {
          await writeTextFile(activeFile, content, rootPath);
          console.log(`[AutoSave Store] Saved file: ${activeFile}`);
          get().setFileDirty(activeFile, false);
        } catch (err) {
          console.error(`[AutoSave Store] Failed to save file ${activeFile}:`, err);
        }
      }, 1000);
    }
  },
  
  closeTab: async (path) => {
    const { activeFile, openTabs, saveActiveFile, setActiveFile, dirtyFiles, fileContents } = get();
    
    // Lưu file trước khi đóng tab nếu đây là tab đang mở
    if (activeFile === path) {
      await saveActiveFile();
    }
    
    const nextTabs = openTabs.filter((t) => t !== path);
    const nextDirty = { ...dirtyFiles };
    delete nextDirty[path];
    
    const nextContents = { ...fileContents };
    delete nextContents[path];
    
    if (activeFile === path) {
      const closedIndex = openTabs.indexOf(path);
      const nextActive = nextTabs[closedIndex] || nextTabs[closedIndex - 1] || null;
      set({ openTabs: nextTabs, dirtyFiles: nextDirty, fileContents: nextContents });
      await setActiveFile(nextActive);
    } else {
      set({ openTabs: nextTabs, dirtyFiles: nextDirty, fileContents: nextContents });
    }
  },
  
  saveActiveFile: async () => {
    const { rootPath, activeFile, fileContents, dirtyFiles } = get();
    if (rootPath && activeFile) {
      const content = fileContents[activeFile];
      if (content !== undefined) {
        try {
          await writeTextFile(activeFile, content, rootPath);
          console.log(`[useProjectStore] Successfully saved file to disk: ${activeFile}`);
          set({ dirtyFiles: { ...dirtyFiles, [activeFile]: false } });
        } catch (err) {
          console.error(`[useProjectStore] Error saving file:`, err);
        }
      }
    }
  },
  
  setFiles: (files) => set({ files }),
  setOpenTabs: (tabs) => set({ openTabs: tabs }),
  setFileDirty: (path, isDirty) => {
    set({ dirtyFiles: { ...get().dirtyFiles, [path]: isDirty } });
  },
  
  closeDeletedTabs: async (deletedPath) => {
    const { openTabs, activeFile, dirtyFiles, fileContents } = get();
    const isTarget = (path: string) => path === deletedPath || path.startsWith(deletedPath + "/");
    const nextTabs = openTabs.filter(tab => !isTarget(tab));
    
    const nextDirty = { ...dirtyFiles };
    const nextContents = { ...fileContents };
    
    openTabs.forEach(tab => {
      if (isTarget(tab)) {
        delete nextDirty[tab];
        delete nextContents[tab];
      }
    });

    if (activeFile && isTarget(activeFile)) {
      const closedIndex = openTabs.indexOf(activeFile);
      const nextActive = nextTabs[closedIndex] || nextTabs[closedIndex - 1] || null;
      
      // Temporarily clear activeFile in state to prevent saving the deleted file
      set({ activeFile: null, openTabs: nextTabs, dirtyFiles: nextDirty, fileContents: nextContents });
      
      // Now set the new active file
      await get().setActiveFile(nextActive);
    } else {
      set({ openTabs: nextTabs, dirtyFiles: nextDirty, fileContents: nextContents });
    }
  },
  
  renameOpenTabs: async (oldPath, newPath) => {
    const { openTabs, activeFile, dirtyFiles, fileContents } = get();
    
    const renameTab = (tab: string) => {
      if (tab === oldPath) return newPath;
      if (tab.startsWith(oldPath + "/")) {
        return newPath + tab.substring(oldPath.length);
      }
      return tab;
    };

    const nextTabs = openTabs.map(renameTab);
    
    const nextDirty: Record<string, boolean> = {};
    Object.keys(dirtyFiles).forEach(key => {
      const nextKey = renameTab(key);
      nextDirty[nextKey] = dirtyFiles[key];
    });

    const nextContents: Record<string, string> = {};
    Object.keys(fileContents).forEach(key => {
      const nextKey = renameTab(key);
      nextContents[nextKey] = fileContents[key];
    });

    if (activeFile) {
      const isTarget = activeFile === oldPath || activeFile.startsWith(oldPath + "/");
      if (isTarget) {
        const nextActive = renameTab(activeFile);
        set({ activeFile: nextActive, openTabs: nextTabs, dirtyFiles: nextDirty, fileContents: nextContents });
      } else {
        set({ openTabs: nextTabs, dirtyFiles: nextDirty, fileContents: nextContents });
      }
    } else {
      set({ openTabs: nextTabs, dirtyFiles: nextDirty, fileContents: nextContents });
    }
  },
  
  setFileContent: (path, content) => {
    set({
      fileContents: { ...get().fileContents, [path]: content }
    });
  }
}));
