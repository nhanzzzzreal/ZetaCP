import React, { useEffect, useState, useRef } from 'react';
import { Tree } from 'react-arborist';
import { useProjectStore, FileNode } from '../../stores/useProjectStore';
import { 
  openProject, 
  scanDirectory, 
  selectProjectFolder,
  createFile,
  createDirectory,
  renameItem,
  deleteItem,
  revealInExplorer,
  startFileWatcher,
  stopFileWatcher
} from '../../lib/tauri-bridge';
import { ask } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { getFileIcon } from '../../lib/fileIcons';

export function FileTree() {
  const rootPath = useProjectStore((state) => state.rootPath);
  const files = useProjectStore((state) => state.files);
  const activeFile = useProjectStore((state) => state.activeFile);

  const setActiveFile = useProjectStore((state) => state.setActiveFile);
  const setFiles = useProjectStore((state) => state.setFiles);
  const setStoreProject = useProjectStore((state) => state.openProject);
  const closeDeletedTabs = useProjectStore((state) => state.closeDeletedTabs);
  const renameOpenTabs = useProjectStore((state) => state.renameOpenTabs);

  const [searchTerm, setSearchTerm] = useState('');
  const [treeWidth, setTreeWidth] = useState(240);
  const [treeHeight, setTreeHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  // States cho cấu hình đuôi file hiển thị (Filters)
  const [showCpp, setShowCpp] = useState(true);
  const [showPy, setShowPy] = useState(true);
  const [showTxt, setShowTxt] = useState(false);
  const [showInpOut, setShowInpOut] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: FileNode | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

  // Dialog State
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'create_file' | 'create_folder' | 'rename';
    targetPath: string;
    isTargetDir: boolean;
    value: string;
    title: string;
  }>({
    isOpen: false,
    type: 'create_file',
    targetPath: '',
    isTargetDir: false,
    value: '',
    title: '',
  });

  const toggleSearch = () => {
    if (showSearch) {
      setSearchTerm('');
    }
    setShowSearch(!showSearch);
  };

  // Close context menu on outside click
  useEffect(() => {
    const closeMenu = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // Tự động tính toán chiều cao và chiều rộng của Tree dựa trên kích thước panel
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setTreeWidth(width);
      setTreeHeight(height);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getBaseName = (path: string): string => {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    if (lastSlash === -1) return path;
    return path.substring(lastSlash + 1);
  };

  const getParentPath = (path: string): string => {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    if (lastSlash === -1) return '';
    return path.substring(0, lastSlash);
  };

  // Tải danh sách tệp tin dựa trên cấu hình đuôi hiển thị
  const refreshFiles = async (path: string) => {
    try {
      const show: string[] = [];
      if (showCpp) show.push('.cpp');
      if (showPy) show.push('.py');
      if (showTxt) show.push('.txt');
      if (showInpOut) {
        show.push('.inp');
        show.push('.out');
        show.push('.in');
        show.push('.ans');
      }

      const nodes = await scanDirectory(path, {
        show,
        hide: ['.exe', '.db', '.o', 'node_modules'],
      });
      setFiles(nodes);
    } catch (err) {
      console.error('Failed to scan project directory:', err);
    }
  };

  // Kích hoạt quét lại file khi thay đổi bộ lọc hoặc root path
  useEffect(() => {
    if (rootPath) {
      refreshFiles(rootPath);
    }
  }, [rootPath, showCpp, showPy, showTxt, showInpOut]);

  // Khởi động file watcher và đăng ký lắng nghe sự kiện thay đổi file từ backend
  useEffect(() => {
    if (!rootPath) return;

    startFileWatcher(rootPath).catch((err) => {
      console.error('Failed to start file watcher:', err);
    });

    const unlistenPromise = listen('file-changed', () => {
      console.log('[FileTree] Received external file change notification, re-scanning...');
      refreshFiles(rootPath);
    });

    return () => {
      stopFileWatcher().catch((err) => {
        console.error('Failed to stop file watcher:', err);
      });
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [rootPath]);

  // Chọn và mở thư mục dự án mới
  const handleOpenFolder = async () => {
    try {
      const selected = await selectProjectFolder();

      if (selected) {
        const projectInfo = await openProject(selected);
        await setStoreProject(selected);
        await refreshFiles(selected);
        console.log('Project opened:', projectInfo);
      }
    } catch (err) {
      console.error('Error opening project directory:', err);
    }
  };

  const handleRevealInExplorer = async (path: string) => {
    if (!rootPath) return;
    try {
      await revealInExplorer(path, rootPath);
    } catch (err: any) {
      console.error('Error revealing in explorer:', err);
    }
  };

  const handleDeleteItem = async (path: string) => {
    if (!rootPath) return;
    try {
      const name = getBaseName(path);
      const confirmed = await ask(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        {
          title: 'Confirm Delete',
          kind: 'warning',
          okLabel: 'Delete',
          cancelLabel: 'Cancel',
        }
      );

      if (confirmed) {
        await deleteItem(path, rootPath);
        await closeDeletedTabs(path);
        await refreshFiles(rootPath);
      }
    } catch (err: any) {
      console.error('Error deleting item:', err);
      alert(`Cannot delete item: ${err.message || err}`);
    }
  };

  const handleStartAction = (type: 'create_file' | 'create_folder' | 'rename', node: FileNode | null) => {
    let title = '';
    let initialValue = '';
    const targetPath = node ? node.path : '';
    const isTargetDir = node ? node.isDir : true;

    if (type === 'create_file') {
      title = 'New File';
      initialValue = '';
    } else if (type === 'create_folder') {
      title = 'New Folder';
      initialValue = '';
    } else if (type === 'rename') {
      title = 'Rename';
      initialValue = node ? getBaseName(node.path) : '';
    }

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
    const isDir = dialog.isTargetDir;

    try {
      if (dialog.type === 'create_file') {
        let parentPath = '';
        if (target) {
          parentPath = isDir ? target : getParentPath(target);
        }
        const finalPath = parentPath ? `${parentPath}/${name}` : name;
        await createFile(finalPath, rootPath);
        await setActiveFile(finalPath);
      } else if (dialog.type === 'create_folder') {
        let parentPath = '';
        if (target) {
          parentPath = isDir ? target : getParentPath(target);
        }
        const finalPath = parentPath ? `${parentPath}/${name}` : name;
        await createDirectory(finalPath, rootPath);
      } else if (dialog.type === 'rename') {
        const parentPath = getParentPath(target);
        const finalPath = parentPath ? `${parentPath}/${name}` : name;
        await renameItem(target, finalPath, rootPath);
        await renameOpenTabs(target, finalPath);
        
        // If the renamed file is the active file, update it in UI selection
        if (activeFile === target) {
          await setActiveFile(finalPath);
        }
      }

      setDialog((prev) => ({ ...prev, isOpen: false }));
      await refreshFiles(rootPath);
    } catch (err: any) {
      console.error('Error executing file operation:', err);
      alert(`Failed to perform file operation: ${err.message || err}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--zcp-bg-sidebar)] w-full text-[var(--zcp-text-primary)] select-none relative border-r border-[var(--zcp-border)]">
      <div className="py-2 px-3 flex flex-col gap-1 border-b border-[var(--zcp-border)]">
        <div className="flex justify-between items-center h-6">
          <span className="text-[10px] font-bold tracking-wider text-[var(--zcp-text-secondary)] uppercase truncate max-w-[140px]" title={rootPath || 'Explorer'}>
            {rootPath ? rootPath.split(/[/\\]/).pop() : 'Explorer'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleOpenFolder}
              className="p-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
              title="Open Folder"
            >
              <span className="codicon codicon-folder-opened text-[14px] flex items-center justify-center" />
            </button>

            {rootPath && (
              <>
                <button
                  onClick={toggleSearch}
                  className={`p-1 rounded-[var(--zcp-radius-sm)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
                    showSearch 
                      ? 'text-[var(--zcp-focus-border)] bg-[var(--zcp-hover-bg)]' 
                      : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]'
                  }`}
                  title="Search Files"
                >
                  <span className="codicon codicon-search text-[14px] flex items-center justify-center" />
                </button>

                <button
                  onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                  className={`p-1 rounded-[var(--zcp-radius-sm)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
                    filterMenuOpen 
                      ? 'text-[var(--zcp-focus-border)] bg-[var(--zcp-hover-bg)]' 
                      : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]'
                  }`}
                  title="Filters"
                >
                  <span className="codicon codicon-settings-gear text-[14px] flex items-center justify-center" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Search Box */}
        {showSearch && rootPath && (
          <div className="relative mt-1">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] focus:outline-none focus:border-[var(--zcp-focus-border)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)]"
              autoFocus
            />
          </div>
        )}

        {/* Filter Popover Menu */}
        {filterMenuOpen && rootPath && (
          <div className="absolute right-2 top-9 z-50 w-44 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-3 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-[var(--zcp-text-secondary)] uppercase tracking-wider border-b border-[var(--zcp-border)] pb-1">
              Filter Extensions
            </span>
            <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
              <input
                type="checkbox"
                checked={showCpp}
                onChange={(e) => setShowCpp(e.target.checked)}
                className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
              />
              <span>.cpp (C++)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
              <input
                type="checkbox"
                checked={showPy}
                onChange={(e) => setShowPy(e.target.checked)}
                className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
              />
              <span>.py (Python)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
              <input
                type="checkbox"
                checked={showTxt}
                onChange={(e) => setShowTxt(e.target.checked)}
                className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
              />
              <span>.txt (Text File)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--zcp-text-primary)] cursor-pointer hover:text-[var(--zcp-text-active)]">
              <input
                type="checkbox"
                checked={showInpOut}
                onChange={(e) => setShowInpOut(e.target.checked)}
                className="rounded border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-focus-border)] focus:ring-0 cursor-pointer"
              />
              <span>Testcases (.inp/.out)</span>
            </label>
          </div>
        )}
      </div>

      {/* Cây thư mục */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden p-1" 
        onClick={() => {
          setFilterMenuOpen(false);
          setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }}
        onContextMenu={(e) => {
          if (!rootPath) return;
          e.preventDefault();
          setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            node: null,
          });
        }}
      >
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center text-xs text-[var(--zcp-text-secondary)] px-4">
            {rootPath ? 'No matching source files found' : 'No folder opened.'}
          </div>
        ) : (
          <Tree
            data={files}
            searchTerm={searchTerm}
            searchMatch={(node, term) => 
              node.data.name.toLowerCase().includes(term.toLowerCase())
            }
            idAccessor={(node: FileNode) => node.path}
            childrenAccessor={(node: FileNode) => node.children}
            width={treeWidth}
            height={treeHeight}
            indent={8}
            rowHeight={22}
            openByDefault={false}
            onSelect={(nodes) => {
              const selected = nodes[0];
              if (selected && !selected.data.isDir) {
                setActiveFile(selected.data.path);
              }
            }}
          >
            {({ node, style, dragHandle }) => {
              const isDir = node.data.isDir;
              const isSelected = activeFile === node.data.path;

              return (
                <button
                  style={style}
                  ref={dragHandle as any}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterMenuOpen(false);
                    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
                    if (isDir) {
                      node.toggle();
                    } else {
                      node.select();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (isDir) {
                        node.toggle();
                      } else {
                        node.select();
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFilterMenuOpen(false);
                    setContextMenu({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      node: node.data,
                    });
                  }}
                  className={`w-full text-left flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--zcp-radius-none)] text-[12px] cursor-pointer hover:bg-[var(--zcp-hover-bg)] transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline ${
                    isSelected 
                      ? 'bg-[var(--zcp-hover-bg)] text-[#ffffff] font-semibold' 
                      : 'text-[#cccccc] hover:text-[#ffffff]'
                  }`}
                  role="treeitem"
                  aria-expanded={isDir ? node.isOpen : undefined}
                  aria-selected={isSelected}
                >
                  {isDir ? (
                    <span 
                      className={`codicon codicon-chevron-right text-[12px] text-[var(--zcp-text-secondary)] shrink-0 transition-transform duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] w-3.5 h-3.5 flex items-center justify-center ${
                        node.isOpen ? 'rotate-90' : ''
                      }`} 
                    />
                  ) : (
                    <span className="w-3.5 h-3.5 shrink-0" />
                  )}

                  {!isDir && getFileIcon(node.data.name, isSelected)}

                  <span className="truncate">{node.data.name}</span>
                </button>
              );
            }}
          </Tree>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            left: Math.min(contextMenu.x, window.innerWidth - 180),
          }}
          className="fixed z-50 min-w-[160px] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] py-1 text-xs text-[var(--zcp-text-primary)] backdrop-blur-md"
        >
          {contextMenu.node ? (
            <>
              {contextMenu.node.isDir ? (
                <>
                  <button
                    onClick={() => handleStartAction('create_file', contextMenu.node)}
                    className="w-full px-3 py-1.5 hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
                  >
                    <span className="codicon codicon-new-file text-[14px] text-[var(--zcp-text-secondary)]" />
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => handleStartAction('create_folder', contextMenu.node)}
                    className="w-full px-3 py-1.5 hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
                  >
                    <span className="codicon codicon-new-folder text-[14px] text-[var(--zcp-text-secondary)]" />
                    <span>New Folder</span>
                  </button>
                  <div className="border-t border-[var(--zcp-border)] my-1" />
                </>
              ) : null}
              <button
                onClick={() => handleStartAction('rename', contextMenu.node)}
                className="w-full px-3 py-1.5 hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
              >
                <span className="codicon codicon-edit text-[14px] text-[var(--zcp-text-secondary)]" />
                <span>Rename</span>
              </button>
              <button
                onClick={() => handleDeleteItem(contextMenu.node!.path)}
                className="w-full px-3 py-1.5 hover:bg-[var(--zcp-verdict-wa)]/20 hover:text-[var(--zcp-verdict-wa)] text-[var(--zcp-verdict-wa)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
              >
                <span className="codicon codicon-trash text-[14px] text-[var(--zcp-verdict-wa)]" />
                <span>Delete</span>
              </button>
              <div className="border-t border-[var(--zcp-border)] my-1" />
              <button
                onClick={() => handleRevealInExplorer(contextMenu.node!.path)}
                className="w-full px-3 py-1.5 hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
              >
                <span className="codicon codicon-link-external text-[14px] text-[var(--zcp-text-secondary)]" />
                <span>Reveal in File Explorer</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleStartAction('create_file', null)}
                className="w-full px-3 py-1.5 hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
              >
                <span className="codicon codicon-new-file text-[14px] text-[var(--zcp-text-secondary)]" />
                <span>New File</span>
              </button>
              <button
                onClick={() => handleStartAction('create_folder', null)}
                className="w-full px-3 py-1.5 hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
              >
                <span className="codicon codicon-new-folder text-[14px] text-[var(--zcp-text-secondary)]" />
                <span>New Folder</span>
              </button>
              <div className="border-t border-[var(--zcp-border)] my-1" />
              <button
                onClick={() => handleRevealInExplorer('')}
                className="w-full px-3 py-1.5 hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] flex items-center gap-2 text-left transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
              >
                <span className="codicon codicon-link-external text-[14px] text-[var(--zcp-text-secondary)]" />
                <span>Open Root Directory</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Dialog Modal */}
      <FileDialogModal
        isOpen={dialog.isOpen}
        title={dialog.title}
        initialValue={dialog.value}
        onConfirm={handleConfirmAction}
        onCancel={() => setDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// Sub-component FileDialogModal để cô lập state gõ phím, tránh render lại toàn bộ cây thư mục khi đang nhập tên
interface FileDialogModalProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}

const FileDialogModal: React.FC<FileDialogModalProps> = React.memo(({
  isOpen,
  title,
  initialValue,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] p-4 w-[280px] shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-[var(--zcp-duration)]">
        <span className="text-xs font-bold text-[var(--zcp-text-primary)]">
          {title}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter name..."
          className="w-full px-2 py-1.5 text-xs bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] focus:outline-none focus:border-[var(--zcp-focus-border)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus-visible-outline"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(value);
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="flex justify-end gap-2 text-[11px] font-semibold">
          <button
            onClick={onCancel}
            className="px-2.5 py-1 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-text-primary)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(value)}
            className="px-2.5 py-1 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] hover:brightness-[1.05] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
});
