import { invoke } from '@tauri-apps/api/core';

export interface OverlayState {
  id: string;
  filePath: string;
  type: string;
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isPinned: boolean;
  opacity: number;
  isVisible: boolean;
  zIndex: number;
}

export async function loadOverlays(filePath: string): Promise<OverlayState[]> {
  return invoke<OverlayState[]>('load_overlays', { filePath });
}

export async function saveOverlaysBackend(filePath: string, overlays: OverlayState[]): Promise<void> {
  return invoke<void>('save_overlays', { filePath, overlays });
}

export async function deleteOverlayBackend(filePath: string, id: string): Promise<void> {
  return invoke<void>('delete_overlay', { filePath, id });
}

export async function createOverlayWindow(overlay: OverlayState): Promise<void> {
  return invoke<void>('create_overlay_window', { overlay });
}

export async function createDiffWindow(testcaseName: string, expected: string, actual: string): Promise<void> {
  return invoke<void>('create_diff_window', { testcaseName, expected, actual });
}
