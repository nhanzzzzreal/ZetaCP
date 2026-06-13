// src/types/judge.ts

import { TestcaseResult } from './testcase';

export interface JudgeConfig {
  filePath: string;        // relative path of .cpp/.py
  timeLimitMs: number;
  memoryLimitKb: number;
  testcaseIds: string[];   // empty = run all
  threads: number;
  checkerType: 'token' | 'exact' | 'custom';
  customCheckerPath?: string;
}

export interface JudgeProgress {
  testcaseId: string;
  status: 'running' | 'done';
  result?: TestcaseResult;
}

export interface CompileError {
  stderr: string;
  exitCode: number;
}

// Tauri Event payload
export interface JudgeEvent {
  type: 'progress' | 'complete' | 'compile_error' | 'fatal';
  data: JudgeProgress | CompileError | string;
}
