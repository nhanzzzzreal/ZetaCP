// src/components/TestcasePanel/BulkImporter.tsx

import React, { useState } from 'react';
import { selectProjectFolder } from '../../lib/tauri-bridge';
import { listen } from '@tauri-apps/api/event';

interface BulkImporterProps {
  activeFile: string | null;
  onImportFromFolder: (folderPath: string) => Promise<void>;
  onClose: () => void;
}

export const BulkImporter: React.FC<BulkImporterProps> = ({
  activeFile,
  onImportFromFolder,
  onClose,
}) => {
  const [importFolderPath, setImportFolderPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusText, setImportStatusText] = useState('');

  const handleBrowseFolder = async () => {
    try {
      const selected = await selectProjectFolder();
      if (selected) {
        setImportFolderPath(selected);
      }
    } catch (err) {
      console.error("Error selecting folder:", err);
    }
  };

  const handleImport = async () => {
    if (!importFolderPath.trim() || !activeFile) {
      return;
    }
    setIsImporting(true);
    setImportStatusText('Scanning directory and importing data...');
    let count = 0;

    const unlisten = await listen('testcase-imported', () => {
      count++;
      setImportStatusText(`Importing testcase #${count}...`);
    });

    try {
      await onImportFromFolder(importFolderPath);
      setImportStatusText(`Successfully imported ${count} testcases!`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setImportStatusText(`Error importing: ${errMsg}`);
    } finally {
      unlisten();
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      onClose();
      setImportStatusText('');
    }
  };

  return (
    <div className="p-3 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-[var(--zcp-duration)]">
      <span className="text-[11px] font-medium text-[var(--zcp-text-primary)] mb-1">Import Testcases from Folder</span>
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="Folder root path..."
          value={importFolderPath}
          onChange={e => setImportFolderPath(e.target.value)}
          disabled={isImporting}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] flex-1 min-w-0 focus-visible-outline"
        />
        <button
          type="button"
          onClick={handleBrowseFolder}
          disabled={isImporting}
          className="h-[26px] px-3 bg-[var(--zcp-bg-sidebar)] hover:bg-[var(--zcp-hover-bg)] disabled:opacity-50 text-[var(--zcp-text-primary)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-[11px] font-medium transition active:scale-95 flex items-center justify-center cursor-pointer"
          title="Choose folder"
        >
          Browse...
        </button>
      </div>
      {importStatusText && (
        <span className="text-[11px] text-[var(--zcp-text-muted)] italic font-normal truncate">{importStatusText}</span>
      )}
      <div className="flex items-center justify-end gap-1.5 mt-1">
        <button
          type="button"
          onClick={handleClose}
          disabled={isImporting}
          className="h-[24px] px-2.5 text-[11px] font-medium text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] rounded-[var(--zcp-radius-sm)] transition-colors cursor-pointer"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={isImporting || !importFolderPath.trim()}
          className="h-[24px] px-3.5 bg-[var(--zcp-accent)] disabled:bg-[var(--zcp-bg-tab-inactive)] disabled:text-[var(--zcp-text-secondary)] text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] text-[11px] font-medium transition active:scale-95 flex items-center gap-1 shadow-sm cursor-pointer"
        >
          {isImporting ? (
            <>
              <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Importing...</span>
            </>
          ) : (
            <span>Import</span>
          )}
        </button>
      </div>
    </div>
  );
};
