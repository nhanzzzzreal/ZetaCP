import React from 'react';
import { FileNode } from '../../stores/useProjectStore';
import { getFileIcon } from '../../lib/fileIcons';

interface FileTreeItemProps {
  node: any; // node from react-arborist
  style: React.CSSProperties;
  dragHandle?: any;
  activeFile: string | null;
  handleStartAction: (type: 'create_file' | 'create_folder' | 'rename', node: FileNode | null) => void;
  handleDeleteItem: (path: string) => Promise<void>;
  setFilterMenuOpen: (val: boolean) => void;
  setContextMenu: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    x: number;
    y: number;
    node: FileNode | null;
  }>>;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = React.memo(({
  node,
  style,
  dragHandle,
  activeFile,
  handleStartAction,
  handleDeleteItem,
  setFilterMenuOpen,
  setContextMenu,
}) => {
  const isDir = node.data.isDir;
  const isSelected = activeFile === node.data.path;
  const indent = 8;

  const rowStyle = { ...style };
  delete rowStyle.paddingLeft;

  return (
    <div
      style={rowStyle}
      ref={dragHandle as any}
      className="group relative w-full h-[22px] flex items-center select-none"
    >
      {/* Indent guides */}
      {Array.from({ length: node.level }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 w-[1px] bg-white/[0.06] pointer-events-none"
          style={{
            left: `${i * indent + 14}px`,
          }}
        />
      ))}

      <button
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
        className={`w-full h-full text-left flex items-center pr-2 rounded-[var(--zcp-radius-none)] text-[13px] cursor-pointer transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline ${
          isSelected 
            ? 'bg-[#04395E] text-[#ffffff]' 
            : 'text-[#cccccc] hover:text-[#ffffff] hover:bg-[var(--zcp-hover-bg)]'
        }`}
        style={{
          paddingLeft: `${node.level * indent + 6}px`,
        }}
        role="treeitem"
        aria-expanded={isDir ? node.isOpen : undefined}
        aria-selected={isSelected}
      >
        {/* Chevron */}
        <span className="w-4 h-4 shrink-0 flex items-center justify-center mr-1">
          {isDir && (
            <span 
              className={`codicon ${
                node.isOpen ? 'codicon-chevron-down' : 'codicon-chevron-right'
              } text-[14px] text-[var(--zcp-text-secondary)]`} 
            />
          )}
        </span>

        {/* Folder/File Icon */}
        {!isDir && (
          <span className="w-4 h-4 shrink-0 flex items-center justify-center mr-1.5">
            {getFileIcon(node.data.name, isSelected, 16)}
          </span>
        )}

        <span className="truncate flex-1 pr-16">{node.data.name}</span>

        {/* Inline Actions */}
        <div 
          className="hidden group-hover:flex items-center gap-0.5 absolute right-2 bg-inherit text-[var(--zcp-text-secondary)]" 
          onClick={(e) => e.stopPropagation()}
        >
          {isDir && (
            <>
              <button
                onClick={() => handleStartAction('create_file', node.data)}
                className="p-0.5 rounded hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer"
                title="New File..."
              >
                <span className="codicon codicon-new-file text-[13px]" />
              </button>
              <button
                onClick={() => handleStartAction('create_folder', node.data)}
                className="p-0.5 rounded hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer"
                title="New Folder..."
              >
                <span className="codicon codicon-new-folder text-[13px]" />
              </button>
            </>
          )}
          <button
            onClick={() => handleStartAction('rename', node.data)}
            className="p-0.5 rounded hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer"
            title="Rename..."
          >
            <span className="codicon codicon-edit text-[13px]" />
          </button>
          <button
            onClick={() => handleDeleteItem(node.data.path)}
            className="p-0.5 rounded hover:text-[var(--zcp-verdict-wa)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer"
            title="Delete"
          >
            <span className="codicon codicon-trash text-[13px]" />
          </button>
        </div>
      </button>
    </div>
  );
});

FileTreeItem.displayName = 'FileTreeItem';
