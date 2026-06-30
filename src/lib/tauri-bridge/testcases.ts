import { invoke } from '@tauri-apps/api/core';
import type { FileSettings, FileContext, TestcaseData, ExecutionConfig, StressConfig } from '../../types/testcase';

function norm(path: string): string;
function norm(path: string | null): string | null;
function norm(path: string | undefined): string | undefined;
function norm(path: any): any {
  if (typeof path !== 'string') return path;
  return path.replace(/\\/g, '/');
}

export async function loadFileSettings(filePath: string): Promise<FileSettings> {
  return invoke<FileSettings>('load_file_settings', { filePath: norm(filePath) });
}

export async function loadFileContext(filePath: string): Promise<FileContext> {
  return invoke<FileContext>('load_file_context', { filePath: norm(filePath) });
}

export async function loadTestcaseData(id: string, filePath: string | null): Promise<TestcaseData> {
  return invoke<TestcaseData>('load_testcase_data', { id, filePath: norm(filePath) });
}

export async function saveFileSettings(settings: ExecutionConfig, filePath?: string): Promise<void> {
  const normSettings = { ...settings, filePath: norm(settings.filePath) };
  return invoke<void>('save_file_settings', { settings: normSettings, filePath: norm(filePath) });
}

export async function saveStressSettings(settings: StressConfig, filePath?: string): Promise<void> {
  const normSettings = { ...settings, filePath: norm(settings.filePath) };
  return invoke<void>('save_stress_settings', { settings: normSettings, filePath: norm(filePath) });
}

export async function importTestcasesFromFolder(folderPath: string, filePath: string): Promise<void> {
  return invoke<void>('import_testcases_from_folder', { folderPath, filePath: norm(filePath) });
}

export async function exportTestcases(exportDir: string, filePath: string): Promise<void> {
  return invoke<void>('export_testcases', { exportDir, filePath: norm(filePath) });
}

export async function saveTestcasesCe(filePath: string, testcaseIds: string[]): Promise<void> {
  return invoke<void>('save_testcases_ce', { filePath: norm(filePath), testcaseIds });
}

export async function addTestcase(args: {
  id: string;
  filePath: string;
  name: string;
  orderIndex: number;
  input: string;
  expectedOutput: string;
  subtaskId: string | null;
}): Promise<void> {
  const normArgs = { ...args, filePath: norm(args.filePath) };
  return invoke<void>('add_testcase', normArgs);
}

export async function deleteTestcase(id: string, filePath: string): Promise<void> {
  return invoke<void>('delete_testcase', { id, filePath: norm(filePath) });
}

export async function addSubtask(args: {
  id: string;
  filePath: string;
  name: string;
  maxScore: number;
  orderIndex: number;
}): Promise<void> {
  const normArgs = { ...args, filePath: norm(args.filePath) };
  return invoke<void>('add_subtask', normArgs);
}

export async function deleteSubtask(id: string, filePath: string): Promise<void> {
  return invoke<void>('delete_subtask', { id, filePath: norm(filePath) });
}

export async function assignToSubtask(args: {
  testcaseId: string;
  subtaskId: string | null;
  orderIndex: number;
  filePath: string;
}): Promise<void> {
  const normArgs = { ...args, filePath: norm(args.filePath) };
  return invoke<void>('assign_to_subtask', normArgs);
}

export async function updateTestcaseData(args: {
  id: string;
  input: string;
  expectedOutput: string;
  filePath: string | null;
}): Promise<void> {
  const normArgs = { ...args, filePath: norm(args.filePath) };
  return invoke<void>('update_testcase_data', normArgs);
}

export async function toggleTestcaseActive(id: string, filePath: string | null): Promise<void> {
  return invoke<void>('toggle_testcase_active', { id, filePath: norm(filePath) });
}

export async function runTestcases(filePath: string, testcaseIds: string[]): Promise<void> {
  return invoke<void>('run_testcases', { filePath: norm(filePath), testcaseIds });
}

export async function stopTestcases(): Promise<void> {
  return invoke<void>('stop_testcases');
}
