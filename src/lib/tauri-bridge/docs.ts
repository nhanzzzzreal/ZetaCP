import { invoke } from '@tauri-apps/api/core';

export async function openDocsWindow(docsType: string): Promise<void> {
  return invoke<void>('open_docs_window', { docsType });
}
