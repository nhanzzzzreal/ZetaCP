// src/stores/testcase/types.ts

import { TestcaseMeta, TestcaseResult, TestcaseData, Subtask, FileSettings } from '../../types/testcase';

export interface TestcaseState {
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
