// src/types/testcase.ts

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'OLE' | 'PENDING' | 'SKIPPED' | 'QUEUED' | 'CE';

export interface TestcaseMeta {
  id: string;
  filePath: string;  // relative path
  name: string;
  orderIndex: number;
  subtaskId: string | null;
  isActive: boolean;
}

export interface TestcaseData {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface TestcaseResult {
  id: string;
  lastStatus: Verdict | null;
  execTimeMs: number | null;
  memoryKb: number | null;
  actualOutput: string | null;
  diffInfo: DiffLine[] | null;
  runAt: number | null;  // Unix timestamp (null = never run)
}

export interface DiffLine {
  line: number;
  expected: string;
  actual: string;
}

// Full testcase state in RAM (joined view of meta, data and result)
export interface Testcase {
  meta: TestcaseMeta;
  data: TestcaseData | null;  // Lazy load, null until editor is opened
  result: TestcaseResult | null;
}

export interface Subtask {
  id: string;
  filePath: string;
  name: string;
  maxScore: number;
  orderIndex: number;
  testcases: TestcaseMeta[];  // metadata only
}

export interface FileSettings {
  filePath: string;
  compilerFlags: string;
  interpreterFlags: string;
  ioMode: 'stdio' | 'file';
  inputFile: string;
  outputFile: string;
  timeLimitMs: number;
  memoryLimitKb: number;
  runMode: 'parallel' | 'sequential';
  checkerType: string;
  customCheckerPath: string;
  customCheckerBinary: string;
}
