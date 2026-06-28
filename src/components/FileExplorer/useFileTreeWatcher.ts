import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { 
  scanDirectory, 
  startFileWatcher,
  stopFileWatcher
} from '../../lib/tauri-bridge';
import { listen } from '@tauri-apps/api/event';

export function useFileTreeWatcher() {
  const rootPath = useProjectStore((state) => state.rootPath);
  const setFiles = useProjectStore((state) => state.setFiles);

  const [showCpp, setShowCpp] = useState(true);
  const [showPy, setShowPy] = useState(true);
  const [showTxt, setShowTxt] = useState(false);
  const [showInpOut, setShowInpOut] = useState(false);

  const refreshFiles = useCallback(async (path: string) => {
    try {
      const show: string[] = [];
      if (showCpp) show.push('.cpp');
      if (showPy) show.push('.py');
      if (showTxt) show.push('.txt');
      if (showInpOut) {
        show.push('.inp', '.out', '.in', '.ans');
      }
      const nodes = await scanDirectory(path, {
        show,
        hide: ['.exe', '.db', '.o', 'node_modules'],
      });
      setFiles(nodes);
    } catch (err) {
      console.error('Failed to scan project directory:', err);
    }
  }, [showCpp, showPy, showTxt, showInpOut, setFiles]);

  useEffect(() => {
    if (rootPath) {
      refreshFiles(rootPath);
    }
  }, [rootPath, refreshFiles]);

  useEffect(() => {
    if (!rootPath) return;
    startFileWatcher(rootPath).catch((err: unknown) => {
      console.error('Failed to start file watcher:', err);
    });
    const unlistenPromise = listen('file-changed', () => {
      refreshFiles(rootPath);
    });
    return () => {
      stopFileWatcher().catch((err: unknown) => {
        console.error('Failed to stop file watcher:', err);
      });
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [rootPath, refreshFiles]);

  return {
    showCpp,
    setShowCpp,
    showPy,
    setShowPy,
    showTxt,
    setShowTxt,
    showInpOut,
    setShowInpOut,
    refreshFiles,
  };
}
