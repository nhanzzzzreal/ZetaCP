// src/stores/testcase/cache.ts

import { TestcaseMeta, TestcaseResult, Subtask, FileSettings } from '../../types/testcase';

export interface CachedContext {
  metas: Map<string, TestcaseMeta>;
  results: Map<string, TestcaseResult>;
  subtasks: Map<string, Subtask>;
  settings: FileSettings;
}

const MAX_CACHE_SIZE = 15;
export const contextCache = new Map<string, CachedContext>();

/** Upsert vào cache với LRU eviction */
export function upsertCache(filePath: string, entry: CachedContext) {
  contextCache.delete(filePath);
  contextCache.set(filePath, entry);
  if (contextCache.size > MAX_CACHE_SIZE) {
    const oldest = contextCache.keys().next().value;
    if (oldest) {
      contextCache.delete(oldest);
    }
  }
}

/** Cập nhật một phần của cache entry đã tồn tại */
export function patchCache(filePath: string, updates: Partial<CachedContext>) {
  const existing = contextCache.get(filePath);
  if (existing) {
    upsertCache(filePath, { ...existing, ...updates });
  }
}
