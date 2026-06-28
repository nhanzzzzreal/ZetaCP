import { invoke } from '@tauri-apps/api/core';

export async function startCompanionListener(): Promise<void> {
  return invoke<void>('start_companion_listener');
}
