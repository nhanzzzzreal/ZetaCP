// src/stores/useSettingsStore.ts

import { create } from 'zustand';
import { GlobalSettings } from '../types/settings';
import { loadSettings as apiLoadSettings, saveSettings as apiSaveSettings } from '../lib/tauri-bridge';

interface SettingsState {
  settings: GlobalSettings | null;
  isSettingsOpen: boolean;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: GlobalSettings) => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isSettingsOpen: false,

  loadSettings: async () => {
    try {
      const settings = await apiLoadSettings();
      set({ settings });
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  },
  saveSettings: async (newSettings) => {
    try {
      await apiSaveSettings(newSettings);
      set({ settings: newSettings });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  },
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));
