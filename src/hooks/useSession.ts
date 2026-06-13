// src/hooks/useSession.ts
// Auto-save and restore session state (rootPath, openTabs, activeFile)
// Session file is stored next to the .exe for portability.

import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/useProjectStore';
import { saveSession, loadSession } from '../lib/tauri-bridge';
import { openProject, scanDirectory } from '../lib/tauri-bridge';

export function useSession() {
  const {
    rootPath,
    openTabs,
    activeFile,
    setActiveFile,
    setFiles,
    openProject: setStoreProject,
  } = useProjectStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  // ── Restore session on first mount ────────────────────────────────────────
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    (async () => {
      try {
        const session = await loadSession();

        if (!session.rootPath) return;

        // Re-open project
        await openProject(session.rootPath);
        await setStoreProject(session.rootPath);

        // Re-scan files with default filter (cpp + py)
        try {
          const nodes = await scanDirectory(session.rootPath, {
            show: ['.cpp', '.py', '.inp', '.out', '.in', '.ans', '.txt'],
            hide: ['.exe', '.db', '.o', 'node_modules'],
          });
          setFiles(nodes);
        } catch {
          // Non-fatal: file tree may just be empty
        }

        // Restore open tabs order
        if (session.openTabs.length > 0) {
          useProjectStore.setState({ openTabs: session.openTabs });
        }

        // Restore active file last
        if (session.activeFile) {
          await setActiveFile(session.activeFile);
        }

        console.log('[Session] Session restored:', session.rootPath);
      } catch (err) {
        console.warn('[Session] Failed to restore session:', err);
      }
    })();
  }, []);

  // ── Auto-save session whenever state changes (debounce 600ms) ─────────────
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveSession({ rootPath, openTabs, activeFile });
        console.log('[Session] Session saved.');
      } catch (err) {
        console.warn('[Session] Failed to save session:', err);
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [rootPath, openTabs, activeFile]);
}
