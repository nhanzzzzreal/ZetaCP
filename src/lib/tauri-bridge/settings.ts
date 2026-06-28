import { invoke } from '@tauri-apps/api/core';
import type { GlobalSettings } from '../../types/settings';

export async function loadSettings(): Promise<GlobalSettings> {
  return invoke<GlobalSettings>('load_settings');
}

export async function saveSettings(settings: GlobalSettings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}
