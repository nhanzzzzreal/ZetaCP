import React from 'react';
import { FileNode } from '../../stores/useProjectStore';

import { FileTreeFilters } from './FileTreeFilters';

interface FileTreeHeaderProps {
  rootPath: string | null;
  handleOpenFolder: () => Promise<void>;
  showSearch: boolean;
  toggleSearch: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterMenuOpen: boolean;
  setFilterMenuOpen: (val: boolean) => void;
  showCpp: boolean;
  setShowCpp: (val: boolean) => void;
  showPy: boolean;
  setShowPy: (val: boolean) => void;
  showTxt: boolean;
  setShowTxt: (val: boolean) => void;
  showInpOut: boolean;
  setShowInpOut: (val: boolean) => void;
  isWorkspaceExpanded: boolean;
  setIsWorkspaceExpanded: (val: boolean) => void;
  isHoveredHeader: boolean;
  setIsHoveredHeader: (val: boolean) => void;
  handleStartAction: (type: 'create_file' | 'create_folder' | 'rename', node: FileNode | null) => void;
  refreshFiles: (path: string) => Promise<void>;
  handleCollapseAll: () => void;
}

export const FileTreeHeader: React.FC<FileTreeHeaderProps> = React.memo(({
  rootPath,
  handleOpenFolder,
  showSearch,
  toggleSearch,
  searchTerm,
  setSearchTerm,
  filterMenuOpen,
  setFilterMenuOpen,
  showCpp,
  setShowCpp,
  showPy,
  setShowPy,
  showTxt,
  setShowTxt,
  showInpOut,
  setShowInpOut,
  isWorkspaceExpanded,
  setIsWorkspaceExpanded,
  isHoveredHeader,
  setIsHoveredHeader,
  handleStartAction,
  refreshFiles,
  handleCollapseAll,
}) => {
  return (
    <>
      <div className="h-[35px] min-h-[35px] border-b border-[var(--zcp-border)] flex items-center justify-between px-4 select-none bg-[var(--zcp-bg-sidebar)]">
        <span className="text-[11px] font-medium tracking-wider text-[var(--zcp-text-secondary)] uppercase">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFolder}
            className="p-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-colors duration-[var(--zcp-duration)] cursor-pointer"
            title="Open Folder"
          >
            <span className="codicon codicon-folder-opened text-[14px] flex items-center justify-center" />
          </button>
          {rootPath && (
            <>
              <button
                onClick={toggleSearch}
                className={`p-1 rounded-[var(--zcp-radius-sm)] transition-colors duration-[var(--zcp-duration)] cursor-pointer ${
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
                className={`p-1 rounded-[var(--zcp-radius-sm)] transition-colors duration-[var(--zcp-duration)] cursor-pointer ${
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
          <button className="p-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] transition-colors duration-[var(--zcp-duration)] cursor-pointer">
            <span className="codicon codicon-more text-[14px] flex items-center justify-center" />
          </button>
        </div>
      </div>

      {/* Dynamic Search Box */}
      {showSearch && rootPath && (
        <div className="px-3 py-2 border-b border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)]">
          <div className="relative">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] focus:outline-none focus:border-[var(--zcp-focus-border)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)]"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Filter Popover Menu */}
      <FileTreeFilters
        isOpen={filterMenuOpen}
        rootPath={rootPath}
        showCpp={showCpp}
        setShowCpp={setShowCpp}
        showPy={showPy}
        setShowPy={setShowPy}
        showTxt={showTxt}
        setShowTxt={setShowTxt}
        showInpOut={showInpOut}
        setShowInpOut={setShowInpOut}
      />

      {/* Collapsible Workspace Section Header */}
      <div 
        className="h-[22px] min-h-[22px] flex items-center justify-between px-2 bg-[var(--zcp-bg-sidebar)] hover:bg-[var(--zcp-hover-bg)]/30 border-b border-[var(--zcp-border)] select-none cursor-pointer transition-colors duration-[var(--zcp-duration)] group/header"
        onClick={() => setIsWorkspaceExpanded(!isWorkspaceExpanded)}
        onMouseEnter={() => setIsHoveredHeader(true)}
        onMouseLeave={() => setIsHoveredHeader(false)}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className={`codicon ${isWorkspaceExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'} text-[14px] text-[var(--zcp-text-secondary)] shrink-0 w-4 h-4 flex items-center justify-center`} />
          <span className="text-[11px] font-bold tracking-wider text-[var(--zcp-text-primary)] uppercase truncate">
            {rootPath ? rootPath.split(/[/\\]/).pop() : 'No Folder Opened'}
          </span>
        </div>
        
        {/* Workspace Action Buttons on hover */}
        {rootPath && isWorkspaceExpanded && (isHoveredHeader || filterMenuOpen) && (
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleStartAction('create_file', null)}
              className="p-0.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer transition-colors duration-[var(--zcp-duration)]"
              title="New File..."
            >
              <span className="codicon codicon-new-file text-[13px] flex items-center justify-center" />
            </button>
            <button
              onClick={() => handleStartAction('create_folder', null)}
              className="p-0.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer transition-colors duration-[var(--zcp-duration)]"
              title="New Folder..."
            >
              <span className="codicon codicon-new-folder text-[13px] flex items-center justify-center" />
            </button>
            <button
              onClick={() => refreshFiles(rootPath)}
              className="p-0.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer transition-colors duration-[var(--zcp-duration)]"
              title="Refresh Explorer"
            >
              <span className="codicon codicon-refresh text-[13px] flex items-center justify-center" />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-0.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] cursor-pointer transition-colors duration-[var(--zcp-duration)]"
              title="Collapse Folders in Explorer"
            >
              <span className="codicon codicon-collapse-all text-[13px] flex items-center justify-center" />
            </button>
          </div>
        )}
      </div>
    </>
  );
});

FileTreeHeader.displayName = 'FileTreeHeader';
