import { useEffect, useState, useRef } from 'react';
import { Tree } from 'react-arborist';
import { useProjectStore, FileNode } from '../../stores/useProjectStore';
import { FileDialogModal } from './FileDialogModal';
import { FileTreeContextMenu } from './FileTreeContextMenu';
import { FileTreeHeader } from './FileTreeHeader';
import { FileTreeItem } from './FileTreeItem';
import { useFileTreeActions } from './useFileTreeActions';
import { useFileTreeWatcher } from './useFileTreeWatcher';

export function FileTree() {
  const rootPath = useProjectStore((state) => state.rootPath);
  const files = useProjectStore((state) => state.files);
  const activeFile = useProjectStore((state) => state.activeFile);
  const setActiveFile = useProjectStore((state) => state.setActiveFile);

  const {
    showCpp,
    setShowCpp,
    showPy,
    setShowPy,
    showTxt,
    setShowTxt,
    showInpOut,
    setShowInpOut,
    refreshFiles,
  } = useFileTreeWatcher();

  const [searchTerm, setSearchTerm] = useState('');
  const [treeWidth, setTreeWidth] = useState(240);
  const [treeHeight, setTreeHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<any>(null);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);
  const [isHoveredHeader, setIsHoveredHeader] = useState(false);

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: FileNode | null;
  }>({ visible: false, x: 0, y: 0, node: null });

  const toggleSearch = () => {
    if (showSearch) setSearchTerm('');
    setShowSearch(!showSearch);
  };

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

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

  const {
    dialog,
    setDialog,
    handleOpenFolder,
    handleRevealInExplorer,
    handleDeleteItem,
    handleStartAction,
    handleConfirmAction,
  } = useFileTreeActions(refreshFiles);

  const handleCollapseAll = () => {
    if (treeRef.current) treeRef.current.closeAll();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--zcp-bg-sidebar)] w-full text-[var(--zcp-text-primary)] select-none relative font-[var(--zcp-font-ui)]">
      <FileTreeHeader
        rootPath={rootPath}
        handleOpenFolder={handleOpenFolder}
        showSearch={showSearch}
        toggleSearch={toggleSearch}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterMenuOpen={filterMenuOpen}
        setFilterMenuOpen={setFilterMenuOpen}
        showCpp={showCpp}
        setShowCpp={setShowCpp}
        showPy={showPy}
        setShowPy={setShowPy}
        showTxt={showTxt}
        setShowTxt={setShowTxt}
        showInpOut={showInpOut}
        setShowInpOut={setShowInpOut}
        isWorkspaceExpanded={isWorkspaceExpanded}
        setIsWorkspaceExpanded={setIsWorkspaceExpanded}
        isHoveredHeader={isHoveredHeader}
        setIsHoveredHeader={setIsHoveredHeader}
        handleStartAction={handleStartAction}
        refreshFiles={refreshFiles}
        handleCollapseAll={handleCollapseAll}
      />

      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden py-0.5" 
        onClick={() => {
          setFilterMenuOpen(false);
          setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }}
        onContextMenu={(e) => {
          if (!rootPath) return;
          e.preventDefault();
          setContextMenu({ visible: true, x: e.clientX, y: e.clientY, node: null });
        }}
      >
        {!isWorkspaceExpanded ? null : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center text-xs text-[var(--zcp-text-secondary)] px-4">
            {rootPath ? 'No matching source files found' : 'No folder opened.'}
          </div>
        ) : (
          <Tree
            ref={treeRef}
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
            {(nodeProps) => (
              <FileTreeItem
                {...nodeProps}
                activeFile={activeFile}
                handleStartAction={handleStartAction}
                handleDeleteItem={handleDeleteItem}
                setFilterMenuOpen={setFilterMenuOpen}
                setContextMenu={setContextMenu}
              />
            )}
          </Tree>
        )}
      </div>

      <FileTreeContextMenu
        contextMenu={contextMenu}
        handleStartAction={handleStartAction}
        handleDeleteItem={handleDeleteItem}
        handleRevealInExplorer={handleRevealInExplorer}
      />

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
