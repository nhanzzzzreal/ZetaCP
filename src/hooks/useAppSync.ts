import { useEffect } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { useProjectStore } from '../stores/useProjectStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useSnippetStore } from '../stores/useSnippetStore';
import { useOverlayStore } from '../stores/useOverlayStore';
import { useTestcaseStore } from '../stores/useTestcaseStore';
import { computeDiff, startCompanionListener } from '../lib/tauri-bridge';
import { useSession } from './useSession';
import { useShortcuts } from './useShortcuts';
import { useCompanionStore, CompanionProblem } from '../stores/useCompanionStore';
import { useCodeforcesStore } from '../stores/useCodeforcesStore';
import { notify } from '../stores/useNotificationStore';

export function useAppSync() {
  const activeFile = useProjectStore((s) => s.activeFile);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadSnippets = useSnippetStore((s) => s.loadSnippets);
  
  const loadOverlaysForFile = useOverlayStore((s) => s.loadOverlaysForFile);
  const syncOverlays = useOverlayStore((s) => s.syncOverlays);
  const togglePin = useOverlayStore((s) => s.togglePin);

  useSession(); // Restore and auto-save session
  useShortcuts(); // Enable global hotkeys

  useEffect(() => {
    // 1. Load initial settings
    loadSettings();
    loadSnippets();
    
    // 2. Setup watcher / sync overlays on active file change
    if (activeFile) {
      loadOverlaysForFile(activeFile);
    }

    // Previous states cache to detect changes
    let lastActiveFilePath = activeFile;
    const knownStatusMap = new Map<string, string | null | undefined>();
    let lastResultsSize = 0;

    const unsubscribe = useTestcaseStore.subscribe((state) => {
      const { addLog } = useOverlayStore.getState();
      
      // Sync overlays when file changes
      if (state.activeFilePath !== lastActiveFilePath) {
        if (state.activeFilePath) {
          addLog('info', 'system', `Switched to file: ${state.activeFilePath.split(/[\\/]/).pop()}`);
        }
        lastActiveFilePath = state.activeFilePath;
      }

      // Testcase status change detection
      state.results.forEach((res, tcId) => {
        const prevStatus = knownStatusMap.get(tcId);
        const currentStatus = res.lastStatus;

        if (currentStatus !== prevStatus) {
          const tcMeta = state.metas.get(tcId);
          const name = tcMeta ? tcMeta.name : `Testcase #${tcId.substring(0, 4)}`;
          
          if (currentStatus === 'QUEUED') {
            addLog('info', 'judge', `${name} is queued...`);
          } else if (currentStatus === 'PENDING') {
            addLog('info', 'judge', `${name} is running...`);
          } else if (currentStatus && ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'].includes(currentStatus)) {
            let logType: 'success' | 'error' | 'warning' | 'info' = 'info';
            let details = `Time: ${res.execTimeMs ?? '?'} ms\nMemory: ${res.memoryKb ?? '?'} KB`;
            
            if (currentStatus === 'AC') {
              logType = 'success';
            } else if (currentStatus === 'WA') {
              logType = 'error';
              if (res.diffInfo) {
                details += `\nOutput Diff:\n${res.diffInfo}`;
              }
              // Emit updated diff data to any standalone diff windows
              const loadAndEmit = async () => {
                let data = state.loadedData.get(tcId);
                if (!data) {
                  await state.loadData(tcId);
                  data = useTestcaseStore.getState().loadedData.get(tcId);
                }
                if (data) {
                  const expected = data.expectedOutput || '';
                  const actual = res.actualOutput || '';
                  const diffLines = await computeDiff(expected, actual);
                  await emit('diff-data-updated', { testcaseId: tcId, diffLines });
                }
              };
              loadAndEmit().catch(console.error);
            } else {
              logType = 'warning';
            }

            addLog(logType, 'judge', `${name} finished with status: ${currentStatus}`, details);
          }
          knownStatusMap.set(tcId, currentStatus);
        }
      });

      // Clear untracked results if they were deleted or reset
      if (state.results.size === 0 && lastResultsSize > 0) {
        knownStatusMap.clear();
      }
      lastResultsSize = state.results.size;
    });

    const currentFile = activeFile;
    const unlistenOverlays = listen('overlays-updated', async () => {
      if (currentFile) {
        await syncOverlays(currentFile);
      }
    });

    let unlistenCompanion: (() => void) | null = null;
    const setupCompanion = async () => {
      try {
        await startCompanionListener();
      } catch (e) {
        console.warn("Failed to start companion listener:", e);
      }
      unlistenCompanion = await listen<CompanionProblem>('companion://problem', (event) => {
        useCompanionStore.getState().addProblem(event.payload);
      });
    };
    setupCompanion();

    let unlistenCfLogin: (() => void) | null = null;
    const setupCfLogin = async () => {
      unlistenCfLogin = await listen<string>('cf-login-success', (event) => {
        const handle = event.payload;
        if (handle) {
          useCodeforcesStore.setState({ isLoggedIn: true, handle });
          localStorage.setItem('cf_handle', handle);
          notify.success('Logged In', `Successfully logged in to Codeforces as: ${handle}`);
        } else {
          useCodeforcesStore.setState({ isLoggedIn: false, handle: '' });
          localStorage.removeItem('cf_handle');
          notify.error('Login Failed', 'Failed to retrieve session handle.');
        }
      });
    };
    setupCfLogin();

    return () => {
      unsubscribe();
      unlistenOverlays.then(fn => fn());
      if (unlistenCompanion) {
        unlistenCompanion();
      }
      if (unlistenCfLogin) {
        unlistenCfLogin();
      }
    };
  }, [activeFile, loadSettings, loadOverlaysForFile, syncOverlays, togglePin]);
}
