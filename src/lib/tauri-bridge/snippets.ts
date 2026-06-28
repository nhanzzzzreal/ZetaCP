import { invoke } from '@tauri-apps/api/core';
import type { DiffLine } from '../../types/testcase';

export interface Snippet {
  id: number;
  trigger: string;
  description: string;
  code: string;
  language: string;
  is_default: number; // 0 | 1
}

export async function loadSnippetsBackend(): Promise<Snippet[]> {
  return invoke<Snippet[]>('load_snippets');
}

export async function saveSnippetBackend(snippet: Omit<Snippet, 'id'> & { id?: number }): Promise<number> {
  return invoke<number>('save_snippet', {
    snippet: {
      id: snippet.id ?? null,
      trigger: snippet.trigger,
      description: snippet.description,
      code: snippet.code,
      language: snippet.language,
      is_default: snippet.is_default ?? 0
    }
  });
}

export async function deleteSnippetBackend(id: number): Promise<void> {
  return invoke<void>('delete_snippet', { id });
}

export async function computeDiff(expected: string, actual: string): Promise<DiffLine[]> {
  return invoke<DiffLine[]>('compute_diff', { expected, actual });
}
