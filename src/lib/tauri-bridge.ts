// src/lib/tauri-bridge.ts

import { invoke } from '@tauri-apps/api/core';
import { GlobalSettings } from '../types/settings';
import { JudgeConfig } from '../types/judge';
import { FileNode } from '../stores/useProjectStore';
import { FileSettings } from '../types/testcase';

export interface CompileResult {
  success: boolean;
  stderr: string;
  binaryPath: string; // matches `binary_path`
  cached: boolean;
}

export interface CompilerInfo {
  found: boolean;
  path: string;
  version: string;
}

export interface ProjectInfo {
  rootPath: string;     // matches `root_path`
  dbPath: string;       // matches `db_path`
  dbWasNew: boolean;    // matches `db_was_new`
  recentFiles: string[]; // matches `recent_files`
}

export interface FileFilter {
  show: string[];
  hide: string[];
}

// 1. Settings Commands
export async function loadSettings(): Promise<GlobalSettings> {
  return invoke<GlobalSettings>('load_settings');
}

export async function saveSettings(settings: GlobalSettings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

// 2. File System Commands
export async function openProject(folderPath: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>('open_project', { folderPath });
}

export async function scanDirectory(folderPath: string, filter: FileFilter): Promise<FileNode[]> {
  return invoke<FileNode[]>('scan_directory', { folderPath, filter });
}

export async function startFileWatcher(root: string): Promise<void> {
  return invoke<void>('start_file_watcher', { root });
}

export async function stopFileWatcher(): Promise<void> {
  return invoke<void>('stop_file_watcher');
}

// 3. Compiler Commands
export async function compileFile(args: {
  filePath: string;
  flags: string[];
  projectRoot: string;
}): Promise<CompileResult> {
  return invoke<CompileResult>('compile_file', {
    filePath: args.filePath,
    flags: args.flags,
    projectRoot: args.projectRoot,
  });
}

export async function compileChecker(checkerPath: string, checkerType: string, projectRoot: string): Promise<CompileResult> {
  return invoke<CompileResult>('compile_checker', {
    checkerPath,
    checkerType,
    projectRoot,
  });
}


export async function checkCompiler(compiler: string): Promise<CompilerInfo> {
  return invoke<CompilerInfo>('check_compiler', { compiler });
}

// 4. Judge Commands
export async function runTests(config: JudgeConfig): Promise<void> {
  return invoke<void>('run_tests', { config });
}

export async function stopJudge(): Promise<void> {
  return invoke<void>('stop_judge');
}

// 5. Companion Commands
export async function startCompanionListener(): Promise<void> {
  return invoke<void>('start_companion_listener');
}

// 6. Refactored I/O & Dialog Commands (Thin Frontend architecture)
export async function readTextFile(filePath: string, projectRoot: string): Promise<string> {
  return invoke<string>('read_text_file', { filePath, projectRoot });
}

export async function writeTextFile(filePath: string, content: string, projectRoot: string): Promise<void> {
  return invoke<void>('write_text_file', { filePath, content, projectRoot });
}

export async function selectProjectFolder(): Promise<string | null> {
  return invoke<string | null>('select_project_folder');
}

export async function selectCheckerFile(): Promise<string | null> {
  return invoke<string | null>('select_checker_file');
}


export async function createFile(filePath: string, projectRoot: string): Promise<void> {
  return invoke<void>('create_file', { filePath, projectRoot });
}

export async function createDirectory(dirPath: string, projectRoot: string): Promise<void> {
  return invoke<void>('create_directory', { dirPath, projectRoot });
}

export async function renameItem(oldPath: string, newPath: string, projectRoot: string): Promise<void> {
  return invoke<void>('rename_item', { oldPath, newPath, projectRoot });
}

export async function deleteItem(itemPath: string, projectRoot: string): Promise<void> {
  return invoke<void>('delete_item', { itemPath, projectRoot });
}

export async function revealInExplorer(itemPath: string, projectRoot: string): Promise<void> {
  return invoke<void>('reveal_in_explorer', { itemPath, projectRoot });
}


// 7. Session Commands
export interface SessionState {
  rootPath: string | null;
  openTabs: string[];
  activeFile: string | null;
}

export async function saveSession(session: SessionState): Promise<void> {
  return invoke<void>('save_session', { session });
}

export async function loadSession(): Promise<SessionState> {
  return invoke<SessionState>('load_session');
}

// 8. File Settings Commands
export async function loadFileSettings(filePath: string): Promise<FileSettings> {
  return invoke<FileSettings>('load_file_settings', { filePath });
}

export async function saveFileSettings(settings: FileSettings): Promise<void> {
  return invoke<void>('save_file_settings', { settings });
}

export async function importTestcasesFromFolder(folderPath: string, filePath: string): Promise<void> {
  return invoke<void>('import_testcases_from_folder', { folderPath, filePath });
}

export async function exportTestcases(exportDir: string, filePath: string): Promise<void> {
  return invoke<void>('export_testcases', { exportDir, filePath });
}

export async function saveTestcasesCe(filePath: string, testcaseIds: string[]): Promise<void> {
  return invoke<void>('save_testcases_ce', { filePath, testcaseIds });
}

// 9. Overlay Commands
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



