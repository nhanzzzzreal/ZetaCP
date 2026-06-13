// src/stores/useJudgeStore.ts

import { create } from 'zustand';
import { TestcaseResult } from '../types/testcase';

interface JudgeState {
  isRunning: boolean;
  isStopped: boolean;
  isComplete: boolean;
  acCount: number;
  total: number;
  results: Map<number, TestcaseResult>;

  runAll: () => Promise<void>;
  runActiveSubtask: () => Promise<void>;
  runSelected: () => Promise<void>;
  stopJudge: () => Promise<void>;
  updateResult: (progress: any) => void;
  setCompleted: (completed: boolean) => void;
  setIsStopped: (stopped: boolean) => void;
}

export const useJudgeStore = create<JudgeState>((set) => ({
  isRunning: false,
  isStopped: false,
  isComplete: false,
  acCount: 0,
  total: 0,
  results: new Map(),

  runAll: async () => {
    set({ isRunning: true, isComplete: false, isStopped: false });
  },
  runActiveSubtask: async () => {
    set({ isRunning: true, isComplete: false, isStopped: false });
  },
  runSelected: async () => {
    set({ isRunning: true, isComplete: false, isStopped: false });
  },
  stopJudge: async () => {
    set({ isRunning: false, isStopped: true });
  },
  updateResult: (_progress) => {
    // Skeleton
  },
  setCompleted: (completed) => set({ isComplete: completed, isRunning: !completed }),
  setIsStopped: (stopped) => set({ isStopped: stopped, isRunning: !stopped }),
}));
