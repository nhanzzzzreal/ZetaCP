// src/stores/testcase/helpers.ts

import { TestcaseMeta, Subtask, TestcaseResult } from '../../types/testcase';
import { compileFile, saveTestcasesCe } from '../../lib/tauri-bridge';
import { patchCache } from './cache';

export const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function getSortedActiveIds(
  metas: Map<string, TestcaseMeta>,
  subtasks: Map<string, Subtask>
): string[] {
  const metasArr = Array.from(metas.values());
  const subtasksArr = Array.from(subtasks.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  
  const orderedIds: string[] = [];
  subtasksArr.forEach(sub => {
    const subMetas = metasArr
      .filter(m => m.subtaskId === sub.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    subMetas.forEach(m => orderedIds.push(m.id));
  });
  
  const ungrouped = metasArr
    .filter(m => m.subtaskId === null)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  ungrouped.forEach(m => orderedIds.push(m.id));
  
  return orderedIds;
}

export async function compileCpp(
  activeFilePath: string,
  compilerFlags: string,
  projectRoot: string
) {
  const flags = compilerFlags.split(/\s+/).filter(Boolean);
  return compileFile({
    filePath: activeFilePath,
    flags,
    projectRoot,
  });
}

export async function handleCompilationFailure(
  set: any,
  activeFilePath: string,
  idsToRun: string[]
) {
  set((state: any) => {
    const nextResults = new Map<string, TestcaseResult>(state.results);
    idsToRun.forEach(tcId => {
      nextResults.set(tcId, {
        id: tcId,
        lastStatus: 'CE',
        execTimeMs: null,
        memoryKb: null,
        actualOutput: null,
        diffInfo: null,
        runAt: Date.now(),
      });
    });
    patchCache(activeFilePath, { results: nextResults });
    return { results: nextResults };
  });

  try {
    await saveTestcasesCe(activeFilePath, idsToRun);
  } catch (dbErr) {
    console.error("Error saving CE to DB:", dbErr);
  }
}
export function getIdsToRun(
  metas: Map<string, TestcaseMeta>,
  subtasks: Map<string, Subtask>,
  id?: string | string[]
): string[] {
  if (id !== undefined) {
    return Array.isArray(id) ? id : [id];
  }
  const sortedActiveIds = getSortedActiveIds(metas, subtasks);
  return sortedActiveIds.filter(tcId => metas.get(tcId)?.isActive);
}
