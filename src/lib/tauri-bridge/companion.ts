import { invoke } from '@tauri-apps/api/core';

export async function startCompanionListener(): Promise<void> {
  return invoke<void>('start_companion_listener');
}

export async function stopCompanionListener(): Promise<void> {
  return invoke<void>('stop_companion_listener');
}

export async function isCompanionListenerRunning(): Promise<boolean> {
  return invoke<boolean>('is_companion_listener_running');
}

export interface CompanionTest {
  input: string;
  output: string;
}

export async function overwriteTestcases(filePath: string, tests: CompanionTest[]): Promise<void> {
  const normPath = filePath.replace(/\\/g, '/');
  return invoke<void>('overwrite_testcases', { filePath: normPath, tests });
}
