// src/components/CompanionImportModal.tsx

import React, { useState, useEffect } from 'react';
import { useCompanionStore } from '../stores/useCompanionStore';
import { useProjectStore } from '../stores/useProjectStore';
import { selectProjectFolder } from '../lib/tauri-bridge';
import { notify } from '../stores/useNotificationStore';

export const CompanionImportModal: React.FC = React.memo(() => {
  const {
    receivedProblems,
    isModalOpen,
    currentGroup,
    importSelected,
    overwriteActiveFile,
    clearProblems,
  } = useCompanionStore();

  const rootPath = useProjectStore((state) => state.rootPath);
  const activeFile = useProjectStore((state) => state.activeFile);

  // UI state
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [activeProblemName, setActiveProblemName] = useState<string>('');
  const [targetDir, setTargetDir] = useState<string>('');
  const [fileExtension, setFileExtension] = useState<string>('cpp');
  const [importAsContest, setImportAsContest] = useState<boolean>(true);

  // Synchronize defaults on modal open
  useEffect(() => {
    if (isModalOpen) {
      // Checked all received problems by default
      const names = receivedProblems.map((p) => p.name);
      setSelectedProblems(names);

      // Select the first problem as active for preview
      if (names.length > 0) {
        setActiveProblemName(names[0]);
      }

      // Default target directory to project root path
      if (rootPath) {
        setTargetDir(rootPath);
      }
    }
  }, [isModalOpen, receivedProblems, rootPath]);

  if (!isModalOpen || receivedProblems.length === 0) return null;

  const activeProblem = receivedProblems.find((p) => p.name === activeProblemName) || receivedProblems[0];

  const handleToggleSelectProblem = (name: string) => {
    setSelectedProblems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    setSelectedProblems(receivedProblems.map((p) => p.name));
  };

  const handleSelectNone = () => {
    setSelectedProblems([]);
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await selectProjectFolder();
      if (selected) {
        setTargetDir(selected);
      }
    } catch (err) {
      console.error('Failed to select target folder:', err);
    }
  };

  const handleImportAsNew = async () => {
    if (selectedProblems.length === 0) {
      notify.warn('Cảnh báo', 'Vui lòng chọn ít nhất một bài toán để import.');
      return;
    }
    if (!targetDir) {
      notify.error('Lỗi', 'Vui lòng chọn thư mục đích.');
      return;
    }
    await importSelected(targetDir, fileExtension, selectedProblems, importAsContest);
  };

  const handleOverwrite = async () => {
    if (selectedProblems.length !== 1) {
      notify.warn('Cảnh báo', 'Vui lòng chỉ chọn duy nhất 1 bài toán để ghi đè.');
      return;
    }
    const problemToOverwrite = receivedProblems.find((p) => p.name === selectedProblems[0]);
    if (problemToOverwrite) {
      await overwriteActiveFile(problemToOverwrite);
    }
  };

  const isOverwriteEnabled = selectedProblems.length === 1 && activeFile !== null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-[var(--zcp-duration)]">
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_4px_20px_rgba(0,0,0,0.4)] w-[820px] h-[540px] flex flex-col overflow-hidden text-[var(--zcp-text-primary)] font-sans">
        
        {/* Header */}
        <div className="h-11 px-4 border-b border-[var(--zcp-border)] flex items-center justify-between shrink-0 bg-[var(--zcp-bg-sidebar)]">
          <div className="flex items-center gap-2">
            <span className="codicon codicon-cloud-download text-[var(--zcp-accent)] text-sm" />
            <span className="text-xs font-bold tracking-wider">COMPETITIVE COMPANION IMPORT</span>
            <span className="text-[11px] text-[var(--zcp-text-muted)] bg-[var(--zcp-bg-editor)] px-2 py-0.5 rounded border border-[var(--zcp-border)] max-w-[320px] truncate">
              {currentGroup || "Unknown Contest"}
            </span>
          </div>
          <button 
            onClick={clearProblems} 
            className="text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] transition-colors cursor-pointer"
          >
            <span className="codicon codicon-close text-[14px]" />
          </button>
        </div>

        {/* Content Panel (Left & Right Split) */}
        <div className="flex-1 flex min-h-0">
          
          {/* Left Column - Problems List */}
          <div className="w-[260px] bg-[var(--zcp-bg-sidebar)] border-r border-[var(--zcp-border)] flex flex-col p-3 gap-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--zcp-text-muted)] pb-1 border-b border-[var(--zcp-border)]">
              <span>PROBLEMS ({receivedProblems.length})</span>
              <div className="flex gap-2">
                <button onClick={handleSelectAll} className="hover:text-[var(--zcp-text-primary)] cursor-pointer">All</button>
                <span>|</span>
                <button onClick={handleSelectNone} className="hover:text-[var(--zcp-text-primary)] cursor-pointer">None</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
              {receivedProblems.map((problem) => {
                const isSelected = selectedProblems.includes(problem.name);
                const isActive = activeProblemName === problem.name;
                return (
                  <div
                    key={problem.name}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-[var(--zcp-radius-sm)] border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[var(--zcp-bg-editor)] border-[var(--zcp-accent)]/40 shadow-xs' 
                        : 'border-transparent hover:bg-[var(--zcp-bg-editor)]/50'
                    }`}
                    onClick={() => setActiveProblemName(problem.name)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()} // Prevent toggling active preview
                      onChange={() => handleToggleSelectProblem(problem.name)}
                      className="w-3.5 h-3.5 rounded-[var(--zcp-radius-sm)] accent-[var(--zcp-accent)] cursor-pointer border-[var(--zcp-border)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate text-[var(--zcp-text-primary)]">
                        {problem.name}
                      </div>
                      <div className="text-[10px] text-[var(--zcp-text-muted)] truncate">
                        {problem.tests.length} tests • {problem.timeLimit}ms
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Preview Area */}
          <div className="flex-grow flex flex-col p-4 bg-[var(--zcp-bg-editor)] min-w-0 overflow-y-auto">
            {activeProblem ? (
              <div className="flex flex-col gap-4 h-full">
                
                {/* Details Section */}
                <div className="flex flex-col gap-1.5 border-b border-[var(--zcp-border)] pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-sm font-bold text-[var(--zcp-text-primary)] select-text">
                      {activeProblem.name}
                    </h2>
                    <a
                      href={activeProblem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[var(--zcp-accent)] hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Open Link</span>
                      <span className="codicon codicon-link-external text-[10px]" />
                    </a>
                  </div>
                  <div className="flex gap-4 text-[11px] text-[var(--zcp-text-muted)] mt-1">
                    <span className="flex items-center gap-1 bg-[var(--zcp-bg-sidebar)] px-2 py-0.5 rounded border border-[var(--zcp-border)]">
                      <span className="codicon codicon-watch text-[11px]" />
                      Time Limit: <strong>{activeProblem.timeLimit} ms</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-[var(--zcp-bg-sidebar)] px-2 py-0.5 rounded border border-[var(--zcp-border)]">
                      <span className="codicon codicon-server text-[11px]" />
                      Memory Limit: <strong>{activeProblem.memoryLimit} MB</strong>
                    </span>
                  </div>
                </div>

                {/* Testcase Scroll Area */}
                <div className="flex-1 flex flex-col min-h-0 gap-2">
                  <span className="text-[10px] font-bold text-[var(--zcp-text-muted)] tracking-wider">
                    TESTCASES PREVIEW ({activeProblem.tests.length})
                  </span>
                  
                  <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                    {activeProblem.tests.map((test, index) => (
                      <div key={index} className="border border-[var(--zcp-border)] rounded bg-[var(--zcp-bg-sidebar)] overflow-hidden flex flex-col">
                        <div className="bg-[var(--zcp-bg-sidebar)] px-3 py-1.5 text-[10px] font-bold border-b border-[var(--zcp-border)] flex items-center justify-between text-[var(--zcp-text-secondary)]">
                          <span>Sample Test #{index + 1}</span>
                        </div>
                        <div className="grid grid-cols-2 min-h-[60px] divide-x divide-[var(--zcp-border)]">
                          <div className="p-2.5 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-[var(--zcp-text-muted)]">INPUT</span>
                            <pre className="text-[10px] font-mono text-[var(--zcp-text-primary)] whitespace-pre-wrap select-text max-h-[120px] overflow-y-auto leading-relaxed">
                              {test.input || <span className="italic text-[var(--zcp-text-muted)]">(empty)</span>}
                            </pre>
                          </div>
                          <div className="p-2.5 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-[var(--zcp-text-muted)]">EXPECTED OUTPUT</span>
                            <pre className="text-[10px] font-mono text-[var(--zcp-text-primary)] whitespace-pre-wrap select-text max-h-[120px] overflow-y-auto leading-relaxed">
                              {test.output || <span className="italic text-[var(--zcp-text-muted)]">(empty)</span>}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-grow flex items-center justify-center text-xs text-[var(--zcp-text-muted)]">
                Select a problem to preview testcases
              </div>
            )}
          </div>

        </div>

        {/* Footer Area with Options */}
        <div className="border-t border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] p-3.5 flex flex-col gap-3 shrink-0 select-none">
          {/* Path selection & extension selector */}
          <div className="flex gap-4 items-center">
            <div className="flex-grow flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[var(--zcp-text-muted)] tracking-wider">
                TARGET PROJECT DIRECTORY
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetDir}
                  onChange={(e) => setTargetDir(e.target.value)}
                  placeholder="Select folder inside project..."
                  className="flex-grow bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] focus-visible-outline"
                />
                <button
                  onClick={handleBrowseFolder}
                  className="px-3 py-1.5 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] hover:bg-[var(--zcp-bg-editor)]/70 text-xs font-semibold transition-all cursor-pointer"
                >
                  Browse...
                </button>
              </div>
            </div>

            <div className="w-[120px] flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[var(--zcp-text-muted)] tracking-wider">
                LANGUAGE/EXTENSION
              </label>
              <select
                value={fileExtension}
                onChange={(e) => setFileExtension(e.target.value)}
                className="w-full bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] focus-visible-outline cursor-pointer"
              >
                <option value="cpp">C++ (.cpp)</option>
                <option value="py">Python (.py)</option>
              </select>
            </div>
          </div>

          {/* Import as Contest Checkbox */}
          <div className="flex items-center gap-2 px-0.5 py-1">
            <input
              type="checkbox"
              id="import-as-contest"
              checked={importAsContest}
              onChange={(e) => setImportAsContest(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[var(--zcp-border)] accent-[var(--zcp-accent)] cursor-pointer bg-[var(--zcp-bg-editor)]"
            />
            <label htmlFor="import-as-contest" className="text-xs text-[var(--zcp-text-secondary)] select-none cursor-pointer flex items-center gap-1.5 hover:text-[var(--zcp-text-primary)] transition-colors">
              <span>Tạo thư mục contest riêng &amp; dùng tên bài đầy đủ (Ví dụ: <span className="font-semibold text-[var(--zcp-text-primary)]">A. AI Finds Nothing Here.cpp</span>)</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between items-center pt-1 border-t border-[var(--zcp-border)]/40 mt-1">
            <button
              onClick={clearProblems}
              className="text-xs font-semibold px-4 py-1.5 rounded-[var(--zcp-radius-sm)] hover:bg-[var(--zcp-bg-editor)] transition-colors cursor-pointer text-[var(--zcp-text-secondary)]"
            >
              Cancel
            </button>

            <div className="flex gap-2">
              {isOverwriteEnabled && (
                <button
                  onClick={handleOverwrite}
                  className="px-4 py-1.5 text-xs font-bold rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-accent)] text-[var(--zcp-accent)] hover:bg-[var(--zcp-accent)]/10 transition-all cursor-pointer"
                >
                  Overwrite Active File ({activeFile?.split(/[\\/]/).pop()})
                </button>
              )}

              <button
                onClick={handleImportAsNew}
                disabled={selectedProblems.length === 0}
                className="px-5 py-1.5 text-xs font-bold rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-accent)] text-white hover:brightness-[1.05] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
              >
                Import Checked ({selectedProblems.length})
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});
