import { invoke } from '@tauri-apps/api/core';
import type { FileNode } from '../../stores/useProjectStore';

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

export interface SessionState {
  rootPath: string | null;
  openTabs: string[];
  activeFile: string | null;
}

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

export async function saveSession(session: SessionState): Promise<void> {
  return invoke<void>('save_session', { session });
}

export async function loadSession(): Promise<SessionState> {
  return invoke<SessionState>('load_session');
}
