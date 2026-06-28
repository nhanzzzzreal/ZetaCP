// src/types/stress.ts

export interface ProgressData {
  iteration: number;
  status: 'passed' | 'failed';
  input: string;
  solOutput: string;
  bruteOutput: string;
  verdict: string;
  timeMs: number;
  memoryKb: number;
}

export type StressTestEvent =
  | { type: 'compiling'; data: { message: string } }
  | { type: 'progress'; data: ProgressData }
  | { type: 'stateupdate'; data: { iteration: number; generatorStatus: string; solutionStatus: string; bruteStatus: string } }
  | { type: 'complete'; data: { message: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'paused'; data: { iteration: number } }
  | { type: 'resumed'; data: { iteration: number } };
