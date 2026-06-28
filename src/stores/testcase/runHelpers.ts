// src/stores/testcase/runHelpers.ts

import { StoreApi } from 'zustand';
import { TestcaseState } from './types';
import type { TestcaseResult } from '../../types/testcase';
import type { CompileResult } from '../../lib/tauri-bridge';
import { runTestcases } from '../../lib/tauri-bridge';
import { writeToTerminal, clearTerminal } from '../../lib/terminal';
import { useProjectStore } from '../useProjectStore';
import { useLayoutStore } from '../useLayoutStore';
import { compileCpp, handleCompilationFailure } from './helpers';

export type SetStateFn = StoreApi<TestcaseState>['setState'];

function handleSuccess(compileResult: CompileResult) {
  if (compileResult.compilerPath) {
    writeToTerminal(`Compiler: ${compileResult.compilerPath}\n`);
  }
  if (compileResult.stderr) {
    writeToTerminal(compileResult.stderr + '\n');
  }
  writeToTerminal(`\x1b[32mCompilation successful!\x1b[0m\n`);
}

async function handleFailure(
  set: SetStateFn,
  activeFilePath: string,
  idsToRun: string[],
  stderr?: string
) {
  if (stderr) {
    writeToTerminal(stderr + '\n');
  }
  useLayoutStore.getState().setTerminalOpen(true);
  writeToTerminal(`\x1b[31mCompilation failed!\x1b[0m\n`);
  await handleCompilationFailure(set, activeFilePath, idsToRun);
}

export async function compileCppAndSave(
  activeFilePath: string,
  compilerFlags: string,
  set: SetStateFn,
  get: () => TestcaseState,
  idsToRun: string[]
): Promise<boolean> {
  clearTerminal();
  writeToTerminal(`Compiling file ${activeFilePath}...\n`);
  set({ isCompiling: true });
  try {
    await useProjectStore.getState().saveActiveFile();
    const projectRoot = useProjectStore.getState().rootPath || '';
    const compileResult = await compileCpp(activeFilePath, compilerFlags, projectRoot);

    if (!get().isCompiling) return false;
    set({ isCompiling: false });

    if (!compileResult.success) {
      await handleFailure(set, activeFilePath, idsToRun, compileResult.stderr);
      return false;
    }
    handleSuccess(compileResult);
    return true;
  } catch (err: unknown) {
    set({ isCompiling: false });
    useLayoutStore.getState().setTerminalOpen(true);
    const errMsg = err instanceof Error ? err.message : String(err);
    writeToTerminal(`\x1b[31mCompilation failed with error: ${errMsg}\x1b[0m\n`);
    await handleCompilationFailure(set, activeFilePath, idsToRun);
    return false;
  }
}

export function setQueuedState(set: SetStateFn, idsToRun: string[]) {
  set((state: TestcaseState) => {
    const nextResults = new Map<string, TestcaseResult>(state.results);
    idsToRun.forEach(tcId => {
      nextResults.set(tcId, {
        id: tcId,
        lastStatus: 'QUEUED',
        execTimeMs: null,
        memoryKb: null,
        actualOutput: null,
        diffInfo: null,
        runAt: Date.now(),
      });
    });
    return { results: nextResults };
  });
}

export async function triggerRunTestcases(activeFilePath: string, idsToRun: string[], set: SetStateFn) {
  try {
    await runTestcases(activeFilePath, idsToRun);
  } catch (err: unknown) {
    console.error("Error running testcases from backend:", err);
    set((state: TestcaseState) => {
      const nextResults = new Map<string, TestcaseResult>(state.results);
      idsToRun.forEach(tcId => {
        if (nextResults.get(tcId)?.lastStatus === 'QUEUED') {
          nextResults.delete(tcId);
        }
      });
      return { results: nextResults };
    });
    const errMsg = err instanceof Error ? err.message : String(err);
    alert(errMsg);
  }
}

export function updateStateOnCancelRun(set: SetStateFn) {
  set((state: TestcaseState) => {
    const nextResults = new Map<string, TestcaseResult>(state.results);
    let changed = false;
    nextResults.forEach((res, key) => {
      if (res.lastStatus === 'PENDING' || res.lastStatus === 'QUEUED') {
        nextResults.set(key, {
          ...res,
          lastStatus: null,
          execTimeMs: null,
          memoryKb: null,
        });
        changed = true;
      }
    });
    return changed ? { results: nextResults } : {};
  });
}
