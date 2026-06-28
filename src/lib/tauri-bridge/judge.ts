import { invoke } from '@tauri-apps/api/core';
import type { JudgeConfig } from '../../types/judge';

export async function runTests(config: JudgeConfig): Promise<void> {
  return invoke<void>('run_tests', { config });
}

export async function stopJudge(): Promise<void> {
  return invoke<void>('stop_judge');
}

export async function runStressTest(config: Record<string, unknown>): Promise<void> {
  return invoke<void>('run_stress_test', config);
}

export async function stopStressTest(): Promise<void> {
  return invoke<void>('stop_stress_test');
}

export async function resumeStressTest(): Promise<void> {
  return invoke<void>('resume_stress_test');
}

export async function installTestlib(projectRoot: string): Promise<string> {
  return invoke<string>('install_testlib', { projectRoot });
}

