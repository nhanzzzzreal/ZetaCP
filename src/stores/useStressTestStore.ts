// src/stores/useStressTestStore.ts

import { create } from 'zustand';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from './useProjectStore';
import { notify } from './useNotificationStore';
import {
  runStressTest,
  stopStressTest,
  resumeStressTest,
  loadFileSettings,
  saveFileSettings,
  installTestlib,
  writeTextFile,
} from '../lib/tauri-bridge';
import { generateWorkspaceCode } from '../components/StressTester/blocks/generatorService';
import type { FileSettings } from '../types/testcase';
import type { ProgressData } from '../types/stress';

interface StressTestState {
  solPath: string;
  brutePath: string;
  genPath: string;
  genMode: 'blockly' | 'file';
  testCount: number | '';
  stopCondition: string;
  runMode: 'parallel' | 'sequential';
  genTimeLimit: number | '';
  genMemoryLimit: number | '';
  bruteTimeLimit: number | '';
  bruteMemoryLimit: number | '';
  solSettings: FileSettings | null;
  showResultsModal: boolean;
  autoExport: boolean;
  isRunning: boolean;
  isPaused: boolean;
  pausedIteration: number | null;
  statusText: string;
  runs: ProgressData[];
  selectedRun: ProgressData | null;

  setSolPath: (p: string) => void;
  setBrutePath: (p: string) => void;
  setGenPath: (p: string) => void;
  setGenMode: (m: 'blockly' | 'file') => void;
  setTestCount: (c: number | '') => void;
  setStopCondition: (c: string) => void;
  setRunMode: (m: 'parallel' | 'sequential') => void;
  setGenTimeLimit: (t: number | '') => void;
  setGenMemoryLimit: (m: number | '') => void;
  setBruteTimeLimit: (t: number | '') => void;
  setBruteMemoryLimit: (m: number | '') => void;
  setSolSettings: (s: FileSettings | null) => void;
  setShowResultsModal: (v: boolean) => void;
  setAutoExport: (b: boolean) => void;
  setIsRunning: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setPausedIteration: (i: number | null) => void;
  setStatusText: (t: string) => void;
  setRuns: (r: ProgressData[] | ((prev: ProgressData[]) => ProgressData[])) => void;
  setSelectedRun: (r: ProgressData | null) => void;

  initForFile: (filePath: string) => Promise<void>;
  pickFile: (field: 'sol' | 'brute' | 'gen') => Promise<void>;
  handleInstallTestlib: () => Promise<void>;
  handleRun: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleResume: () => Promise<void>;
  handleCloseResultsBoard: () => Promise<void>;
}

export const useStressTestStore = create<StressTestState>((set, get) => ({
  solPath: '',
  brutePath: '',
  genPath: 'generator.py',
  genMode: 'blockly',
  testCount: 100,
  stopCondition: 'first_error',
  runMode: 'parallel',
  genTimeLimit: 2000,
  genMemoryLimit: 262144,
  bruteTimeLimit: 2000,
  bruteMemoryLimit: 262144,
  solSettings: null,
  showResultsModal: false,
  autoExport: false,
  isRunning: false,
  isPaused: false,
  pausedIteration: null,
  statusText: 'Ready',
  runs: [],
  selectedRun: null,

  setSolPath: (solPath) => {
    set({ solPath });
    if (solPath) {
      get().initForFile(solPath);
    }
  },
  setBrutePath: (brutePath) => set({ brutePath }),
  setGenPath: (genPath) => set({ genPath }),
  setGenMode: (genMode) => set({ genMode }),
  setTestCount: (testCount) => set({ testCount }),
  setStopCondition: (stopCondition) => set({ stopCondition }),
  setRunMode: (runMode) => set({ runMode }),
  setGenTimeLimit: (genTimeLimit) => set({ genTimeLimit }),
  setGenMemoryLimit: (genMemoryLimit) => set({ genMemoryLimit }),
  setBruteTimeLimit: (bruteTimeLimit) => set({ bruteTimeLimit }),
  setBruteMemoryLimit: (bruteMemoryLimit) => set({ bruteMemoryLimit }),
  setSolSettings: (solSettings) => set({ solSettings }),
  setShowResultsModal: (showResultsModal) => set({ showResultsModal }),
  setAutoExport: (autoExport) => set({ autoExport }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setPausedIteration: (pausedIteration) => set({ pausedIteration }),
  setStatusText: (statusText) => set({ statusText }),
  setRuns: (runs) => set((state) => ({ runs: typeof runs === 'function' ? runs(state.runs) : runs })),
  setSelectedRun: (selectedRun) => set({ selectedRun }),

  initForFile: async (filePath: string) => {
    set({ solPath: filePath });
    try {
      const settings = await loadFileSettings(filePath);
      set({
        solSettings: settings,
        brutePath: settings.stressBrutePath || '',
        genPath: settings.stressGenPath || 'generator.py',
        genMode: settings.stressGenMode || 'blockly',
        genTimeLimit: settings.stressGenTimeLimitMs || 2000,
        genMemoryLimit: settings.stressGenMemoryLimitKb || 262144,
        bruteTimeLimit: settings.stressBruteTimeLimitMs || 2000,
        bruteMemoryLimit: settings.stressBruteMemoryLimitKb || 262144,
        testCount: settings.stressTestCount !== undefined ? settings.stressTestCount : 100,
        stopCondition: settings.stressStopCondition || 'first_error',
        autoExport: !!settings.stressAutoExport,
        runMode: settings.runMode === 'parallel' ? 'parallel' : 'sequential',
      });
    } catch (err) {
      console.error(err);
    }
  },

  pickFile: async (field: 'sol' | 'brute' | 'gen') => {
    const rootPath = useProjectStore.getState().rootPath;
    try {
      const selected = await openDialog({
        multiple: false,
        title: `Select ${field === 'sol' ? 'Solution' : field === 'brute' ? 'Brute' : 'Generator'} File`,
        filters: [{ name: 'Source Files', extensions: ['cpp', 'py', 'java', 'txt'] }],
      });
      if (typeof selected === 'string') {
        let displayPath = selected;
        if (rootPath) {
          const normRoot = rootPath.replace(/\\/g, '/');
          const normSel = selected.replace(/\\/g, '/');
          if (normSel.startsWith(normRoot)) displayPath = normSel.substring(normRoot.length).replace(/^\//, '');
        }
        if (field === 'sol') set({ solPath: displayPath });
        else if (field === 'brute') set({ brutePath: displayPath });
        else if (field === 'gen') set({ genPath: displayPath });
      }
    } catch (err) {
      console.error(err);
    }
  },

  handleInstallTestlib: async () => {
    const rootPath = useProjectStore.getState().rootPath;
    if (!rootPath) {
      notify.error('Cannot install', 'Project root not found.');
      return;
    }
    set({ statusText: 'Downloading testlib.h...' });
    try {
      await installTestlib(rootPath);
      notify.success('testlib.h Installed', 'Successfully installed testlib.h.');
      set({ statusText: 'Ready' });
    } catch (err) {
      notify.fromTauriError('Failed to install testlib.h', err);
      set({ statusText: 'Installation failed' });
    }
  },

  handleRun: async () => {
    const s = get();
    const rootPath = useProjectStore.getState().rootPath;
    if (!s.solPath || !s.brutePath || !s.genPath || !rootPath) {
      notify.error('Cannot start', 'Please configure settings.');
      return;
    }

    if (s.genMode === 'blockly') {
      try {
        const ws = (window as unknown as { activeBlocklyWorkspace?: any }).activeBlocklyWorkspace;
        if (ws) {
          const genLang = s.genPath.endsWith('.cpp') ? 'cpp' : 'python';
          const code = generateWorkspaceCode(ws, genLang);
          await writeTextFile(s.genPath, code, rootPath);
        }
      } catch (err) {
        notify.fromTauriError('Failed to generate code from canvas', err);
        return;
      }
    }
    const updated: FileSettings = {
      ...(s.solSettings || {
        filePath: s.solPath,
        compilerFlags: '-O2 -std=c++17',
        interpreterFlags: '',
        ioMode: 'stdio',
        inputFile: '',
        outputFile: '',
        timeLimitMs: 1000,
        memoryLimitKb: 262144,
        runMode: 'parallel',
        checkerType: 'ignore_trailing_space',
        customCheckerPath: '',
        customCheckerBinary: '',
      }),
      stressBrutePath: s.brutePath,
      stressSolPath: s.solPath,
      stressGenPath: s.genPath,
      stressGenMode: s.genMode,
      stressGenTimeLimitMs: Number(s.genTimeLimit || 2000),
      stressGenMemoryLimitKb: Number(s.genMemoryLimit || 262144),
      stressBruteTimeLimitMs: Number(s.bruteTimeLimit || 2000),
      stressBruteMemoryLimitKb: Number(s.bruteMemoryLimit || 262144),
      stressTestCount: Number(s.testCount || 100),
      stressStopCondition: s.stopCondition,
      stressAutoExport: s.autoExport,
      runMode: s.runMode,
    };
    try {
      await saveFileSettings(updated);
      set({ solSettings: updated });
    } catch (e) {
      console.error(e);
    }
    set({
      runs: [],
      selectedRun: null,
      isPaused: false,
      pausedIteration: null,
      isRunning: true,
      showResultsModal: true,
      statusText: 'Initializing...',
    });
    runStressTest({
      solutionPath: s.solPath,
      brutePath: s.brutePath,
      genPath: s.genPath,
      genCode: '',
      genLang: s.genPath.endsWith('.py') ? 'python' : 'cpp',
      projectRoot: rootPath,
      testCount: Number(s.testCount || 100),
      multitestCount: 1,
      isHtml: false,
      isMultitest: false,
      useSumMax: false,
      sumMax: 0,
      timeoutMs: Number(s.bruteTimeLimit || 2000),
      stopCondition: s.stopCondition,
      autoExport: s.autoExport,
      namedTypes: [],
      globalVariables: [],
    }).catch((err) => {
      notify.fromTauriError('Failed to start stress test', err);
      set({ isRunning: false });
    });
  },

  handleStop: async () => {
    await stopStressTest().catch(() => {});
    set({ isRunning: false, isPaused: false, statusText: 'Stopped' });
  },

  handleResume: async () => {
    await resumeStressTest().catch(() => {});
  },

  handleCloseResultsBoard: async () => {
    const s = get();
    if (s.isRunning && !window.confirm('Abort the active stress test?')) return;
    await stopStressTest().catch(() => {});
    set({ isRunning: false, isPaused: false, showResultsModal: false, runs: [], selectedRun: null });
  },
}));
