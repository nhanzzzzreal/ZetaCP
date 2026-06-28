import { useState } from 'react';
import { useProjectStore, FileNode } from '../../stores/useProjectStore';
import { 
  openProject, 
  selectProjectFolder,
  createFile,
  createDirectory,
  renameItem,
  deleteItem,
  revealInExplorer
} from '../../lib/tauri-bridge';
import { ask } from '@tauri-apps/plugin-dialog';

export interface FileDialogState {
  isOpen: boolean;
  type: 'create_file' | 'create_folder' | 'rename';
  targetPath: string;
  isTargetDir: boolean;
  value: string;
  title: string;
}

export const getBaseName = (path: string): string => {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlash === -1 ? path : path.substring(lastSlash + 1);
};

export const getParentPath = (path: string): string => {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlash === -1 ? '' : path.substring(0, lastSlash);
};

export const getFinalPath = (name: string, target: string, isDir: boolean): string => {
  if (!target) return name;
  const parentPath = isDir ? target : getParentPath(target);
  return parentPath ? `${parentPath}/${name}` : name;
};

export function useFileTreeActions(refreshFiles: (path: string) => Promise<void>) {
  const rootPath = useProjectStore((state) => state.rootPath);
  const activeFile = useProjectStore((state) => state.activeFile);
  const setActiveFile = useProjectStore((state) => state.setActiveFile);
  const setStoreProject = useProjectStore((state) => state.openProject);
  const closeDeletedTabs = useProjectStore((state) => state.closeDeletedTabs);
  const renameOpenTabs = useProjectStore((state) => state.renameOpenTabs);

  const [dialog, setDialog] = useState<FileDialogState>({
    isOpen: false,
    type: 'create_file',
    targetPath: '',
    isTargetDir: false,
    value: '',
    title: '',
  });

  const handleOpenFolder = async () => {
    try {
      const selected = await selectProjectFolder();
      if (selected) {
        await openProject(selected);
        await setStoreProject(selected);
        await refreshFiles(selected);
      }
    } catch (err) {
      console.error('Error opening project directory:', err);
    }
  };

  const handleRevealInExplorer = async (path: string) => {
    if (!rootPath) return;
    try {
      await revealInExplorer(path, rootPath);
    } catch (err) {
      console.error('Error revealing in explorer:', err);
    }
  };

  const handleDeleteItem = async (path: string) => {
    if (!rootPath) return;
    try {
      const name = getBaseName(path);
      const confirmed = await ask(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        { title: 'Confirm Delete', kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' }
      );
      if (confirmed) {
        await deleteItem(path, rootPath);
        await closeDeletedTabs(path);
        await refreshFiles(rootPath);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error deleting item:', err);
      alert(`Cannot delete item: ${errMsg}`);
    }
  };

  const handleStartAction = (type: 'create_file' | 'create_folder' | 'rename', node: FileNode | null) => {
    const targetPath = node ? node.path : '';
    const isTargetDir = node ? node.isDir : true;
    const initialValue = type === 'rename' && node ? getBaseName(node.path) : '';
    const title = type === 'create_file' ? 'New File' : type === 'create_folder' ? 'New Folder' : 'Rename';

    setDialog({
      isOpen: true,
      type,
      targetPath,
      isTargetDir,
      value: initialValue,
      title,
    });
  };

  const handleConfirmAction = async (nameInput: string) => {
    if (!rootPath || !nameInput.trim()) return;
    const name = nameInput.trim();
    const target = dialog.targetPath;
    try {
      if (dialog.type === 'create_file') {
        const finalPath = getFinalPath(name, target, dialog.isTargetDir);
        await createFile(finalPath, rootPath);
        await setActiveFile(finalPath);
      } else if (dialog.type === 'create_folder') {
        const finalPath = getFinalPath(name, target, dialog.isTargetDir);
        await createDirectory(finalPath, rootPath);
      } else if (dialog.type === 'rename') {
        const parentPath = getParentPath(target);
        const finalPath = parentPath ? `${parentPath}/${name}` : name;
        await renameItem(target, finalPath, rootPath);
        await renameOpenTabs(target, finalPath);
        if (activeFile === target) await setActiveFile(finalPath);
      }
      setDialog((prev) => ({ ...prev, isOpen: false }));
      await refreshFiles(rootPath);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error executing file operation:', err);
      alert(`Failed to perform file operation: ${errMsg}`);
    }
  };

  return {
    dialog,
    setDialog,
    handleOpenFolder,
    handleRevealInExplorer,
    handleDeleteItem,
    handleStartAction,
    handleConfirmAction,
  };
}
