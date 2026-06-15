// src/stores/useSnippetStore.ts

import { create } from 'zustand';
import { 
  loadSnippetsBackend, 
  saveSnippetBackend, 
  deleteSnippetBackend, 
  Snippet 
} from '../lib/tauri-bridge';

export type { Snippet };

interface SnippetState {
  snippets: Snippet[];
  loadSnippets: () => Promise<void>;
  saveSnippet: (snippet: Omit<Snippet, 'id'> & { id?: number }) => Promise<void>;
  deleteSnippet: (id: number) => Promise<void>;
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: [],

  loadSnippets: async () => {
    try {
      const snippets = await loadSnippetsBackend();
      set({ snippets });
    } catch (err) {
      console.error('Failed to load snippets:', err);
    }
  },

  saveSnippet: async (snippet) => {
    try {
      await saveSnippetBackend(snippet);
      await get().loadSnippets();
    } catch (err) {
      console.error('Failed to save snippet:', err);
      throw err;
    }
  },

  deleteSnippet: async (id) => {
    try {
      await deleteSnippetBackend(id);
      await get().loadSnippets();
    } catch (err) {
      console.error('Failed to delete snippet:', err);
      throw err;
    }
  },
}));
