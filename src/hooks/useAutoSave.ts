// src/hooks/useAutoSave.ts

import { useEffect, useRef } from 'react';
import { writeTextFile } from '../lib/tauri-bridge';
import { useProjectStore } from '../stores/useProjectStore';

export function useAutoSave(content: string, filePath: string | null) {
  const rootPath = useProjectStore((state) => state.rootPath);
  const isDirty = useProjectStore((state) => filePath ? (state.dirtyFiles[filePath] ?? false) : false);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!filePath || !rootPath || !isDirty) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce save for 1000ms
    timeoutRef.current = setTimeout(async () => {
      try {
        await writeTextFile(filePath, content, rootPath);
        console.log(`[AutoSave] Saved file: ${filePath}`);
        useProjectStore.getState().setFileDirty(filePath, false);
      } catch (err) {
        console.error(`[AutoSave] Failed to save file ${filePath}:`, err);
      }
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, filePath, rootPath, isDirty]);
}
