import React from 'react';
import { FileNode } from '../../stores/useProjectStore';

interface FileTreeContextMenuProps {
  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    node: FileNode | null;
  };
  handleStartAction: (type: 'create_file' | 'create_folder' | 'rename', node: FileNode | null) => void;
  handleDeleteItem: (path: string) => Promise<void>;
  handleRevealInExplorer: (path: string) => Promise<void>;
}

export const FileTreeContextMenu: React.FC<FileTreeContextMenuProps> = React.memo(({
  contextMenu,
  handleStartAction,
  handleDeleteItem,
  handleRevealInExplorer,
}) => {
  if (!contextMenu.visible) return null;

  return (
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
  );
});

FileTreeContextMenu.displayName = 'FileTreeContextMenu';
