// src/stores/useCompanionStore.ts

import { create } from 'zustand';
import { useProjectStore } from './useProjectStore';
import { useSettingsStore } from './useSettingsStore';
import { useTestcaseStore } from './useTestcaseStore';
import { useSnippetStore } from './useSnippetStore';
import { notify } from './useNotificationStore';
import { 
  overwriteTestcases, 
  saveFileSettings, 
  writeTextFile,
  CompanionTest 
} from '../lib/tauri-bridge';
import type { ExecutionConfig } from '../types/testcase';

export interface CompanionInputOutput {
  type: 'stdin' | 'stdout' | 'file';
  fileName?: string;
}

export interface CompanionProblem {
  name: string;
  group: string;
  url: string;
  interactive?: boolean;
  memoryLimit: number; // in MB
  timeLimit: number;   // in ms
  tests: CompanionTest[];
  input?: CompanionInputOutput;
  output?: CompanionInputOutput;
}

interface CompanionState {
  receivedProblems: CompanionProblem[];
  isModalOpen: boolean;
  currentGroup: string | null;
  
  addProblem: (problem: CompanionProblem) => void;
  clearProblems: () => void;
  setModalOpen: (open: boolean) => void;
  importSelected: (
    targetDirAbs: string,
    fileExtension: string,
    selectedNames: string[],
    importAsContest: boolean
  ) => Promise<void>;
  overwriteActiveFile: (problem: CompanionProblem) => Promise<void>;
}

let groupingTimeout: any = null;

export const useCompanionStore = create<CompanionState>((set, get) => ({
  receivedProblems: [],
  isModalOpen: false,
  currentGroup: null,

  addProblem: (problem) => {
    if (groupingTimeout) {
      clearTimeout(groupingTimeout);
    }

    set((state) => {
      // Group by contest/group name. If it's a new group, reset the buffer.
      const isSameGroup = state.currentGroup === problem.group;
      const nextProblems = isSameGroup 
        ? [...state.receivedProblems.filter((p) => p.name !== problem.name), problem] 
        : [problem];

      return {
        receivedProblems: nextProblems,
        currentGroup: problem.group,
        isModalOpen: true
      };
    });

    // Reset session after 5 minutes of inactivity
    groupingTimeout = setTimeout(() => {
      // Just reset the group tracker so new parses start fresh
      set({ currentGroup: null });
    }, 5 * 60 * 1000);
  },

  clearProblems: () => {
    set({ receivedProblems: [], currentGroup: null, isModalOpen: false });
  },

  setModalOpen: (open) => {
    set({ isModalOpen: open });
  },

  overwriteActiveFile: async (problem: CompanionProblem) => {
    const activeFilePath = useProjectStore.getState().activeFile;
    if (!activeFilePath) {
      notify.error("Lỗi", "Không có file nào đang mở để ghi đè.");
      return;
    }

    try {
      await overwriteTestcases(activeFilePath, problem.tests);

      // Preserve existing settings where possible, update limits and metadata
      const currentSettings = useTestcaseStore.getState().fileSettings;
      const isFileIO = problem.input?.type === 'file';
      const ioMode = problem.input
        ? (isFileIO ? "file" : "stdio")
        : (currentSettings?.ioMode || "stdio");
      const inputFile = problem.input
        ? (isFileIO ? (problem.input.fileName || "") : "")
        : (currentSettings?.inputFile || "");
      const outputFile = problem.output
        ? (problem.output.type === 'file' ? (problem.output.fileName || "") : "")
        : (currentSettings?.outputFile || "");

      const updatedSettings: ExecutionConfig = {
        filePath: activeFilePath,
        compilerFlags: currentSettings?.compilerFlags || "-O2 -std=c++17",
        interpreterFlags: currentSettings?.interpreterFlags || "",
        ioMode,
        inputFile,
        outputFile,
        timeLimitMs: problem.timeLimit,
        memoryLimitKb: problem.memoryLimit * 1024,
        runMode: currentSettings?.runMode || "parallel",
        checkerType: currentSettings?.checkerType || "ignore_trailing_space",
        customCheckerPath: currentSettings?.customCheckerPath || "",
        customCheckerBinary: currentSettings?.customCheckerBinary || ""
      };

      await saveFileSettings(updatedSettings, activeFilePath);

      // Reload testcases & settings in the active editor context
      await useTestcaseStore.getState().loadFileSettings(activeFilePath);
      await useTestcaseStore.getState().loadForFile(activeFilePath);

      notify.success("Ghi đè thành công", `Đã cập nhật ${problem.tests.length} testcase cho file hiện tại.`);
      set({ isModalOpen: false });
    } catch (err) {
      console.error("Failed to overwrite testcases:", err);
      notify.fromTauriError("Lỗi ghi đè testcase", err);
    }
  },

  importSelected: async (targetDirAbs, fileExtension, selectedNames, importAsContest) => {
    const rootPath = useProjectStore.getState().rootPath;
    if (!rootPath) {
      notify.error("Lỗi", "Chưa mở thư mục project.");
      return;
    }

    const sanitizePathSegment = (name: string): string => {
      return name.replace(/[\\/:*?"<>|]/g, '_').trim();
    };

    let finalTargetDirAbs = targetDirAbs;
    if (importAsContest) {
      const contestFolder = sanitizePathSegment(get().currentGroup || "Contest");
      const baseDir = targetDirAbs.replace(/\\/g, '/');
      finalTargetDirAbs = baseDir.endsWith('/') ? `${baseDir}${contestFolder}` : `${baseDir}/${contestFolder}`;
    }

    // Compute relative directory path
    let relDir = "";
    const normRoot = rootPath.replace(/\\/g, '/').toLowerCase();
    const normTarget = finalTargetDirAbs.replace(/\\/g, '/').toLowerCase();

    if (normTarget.startsWith(normRoot)) {
      relDir = finalTargetDirAbs.substring(rootPath.length).replace(/\\/g, '/');
      if (relDir.startsWith('/')) relDir = relDir.substring(1);
    } else {
      notify.error("Lỗi thư mục", "Thư mục đích phải nằm trong thư mục project hiện tại.");
      return;
    }

    const problemsToImport = get().receivedProblems.filter((p) => selectedNames.includes(p.name));
    if (problemsToImport.length === 0) {
      notify.warn("Cảnh báo", "Không có bài toán nào được chọn.");
      return;
    }

    const defaultFlags = useSettingsStore.getState().settings?.compiler.defaultFlags || "-O2 -std=c++17";
    let firstFileToOpen: string | null = null;

    for (const problem of problemsToImport) {
      // Determine file name
      let filename = "";
      if (importAsContest) {
        filename = `${sanitizePathSegment(problem.name)}.${fileExtension}`;
      } else {
        // Determine file name from problem name index (e.g. "A. Problem" -> "a.cpp")
        const match = problem.name.match(/^([A-Za-z0-9]+)/);
        const stem = match ? match[1].toLowerCase() : problem.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        filename = `${stem}.${fileExtension}`;
      }
      const relativeFilePath = relDir ? `${relDir}/${filename}` : filename;

      if (!firstFileToOpen) {
        firstFileToOpen = relativeFilePath;
      }

      const lang = fileExtension === 'cpp' ? 'cpp' : 'python';
      const defaultSnippet = useSnippetStore.getState().snippets.find(
        (s) => s.language === lang && s.is_default
      );
      const defaultTemplate = defaultSnippet ? defaultSnippet.code : "";

      try {
        // Create source file and parent folders automatically
        await writeTextFile(relativeFilePath, defaultTemplate, rootPath);
        // Pre-seed cache
        useProjectStore.getState().setFileContent(relativeFilePath, defaultTemplate);

        // Save testcases
        await overwriteTestcases(relativeFilePath, problem.tests);

        // Save settings
        const isFileIO = problem.input?.type === 'file';
        const fileSettings: ExecutionConfig = {
          filePath: relativeFilePath,
          compilerFlags: defaultFlags,
          interpreterFlags: "",
          ioMode: isFileIO ? "file" : "stdio",
          inputFile: isFileIO ? (problem.input?.fileName || "") : "",
          outputFile: isFileIO ? (problem.output?.fileName || "") : "",
          timeLimitMs: problem.timeLimit,
          memoryLimitKb: problem.memoryLimit * 1024,
          runMode: "parallel",
          checkerType: "ignore_trailing_space",
          customCheckerPath: "",
          customCheckerBinary: ""
        };
        await saveFileSettings(fileSettings, relativeFilePath);
      } catch (err) {
        console.error(`Failed to import problem ${problem.name}:`, err);
        notify.error("Lỗi import", `Không thể import bài ${problem.name}: ${err}`);
      }
    }

    // Close modal
    set({ isModalOpen: false });

    // Open first file
    if (firstFileToOpen) {
      await useProjectStore.getState().setActiveFile(firstFileToOpen);
    }

    notify.success("Thành công", `Đã import thành công ${problemsToImport.length} bài toán.`);
  }
}));
