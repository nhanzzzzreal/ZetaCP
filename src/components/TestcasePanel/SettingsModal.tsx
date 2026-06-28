// src/components/TestcasePanel/SettingsModal.tsx

import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { FileSettings } from '../../types/testcase';
import { CheckerSettings } from './CheckerSettings';
import { compileChecker } from '../../lib/tauri-bridge';

interface SettingsModalProps {
  activeFile: string;
  fileSettings: FileSettings | null;
  onSave: (settings: FileSettings) => Promise<void>;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  activeFile,
  fileSettings,
  onSave,
  onClose,
}) => {
  const [compilerFlags, setCompilerFlags] = useState('-O2 -std=c++17');
  const [interpreterFlags, setInterpreterFlags] = useState('');
  const [ioMode, setIoMode] = useState<'stdio' | 'file'>('stdio');
  const [inputFile, setInputFile] = useState('');
  const [outputFile, setOutputFile] = useState('');
  const [timeLimitStr, setTimeLimitStr] = useState('1000');
  const [memoryLimitStr, setMemoryLimitStr] = useState('256');
  const [runMode, setRunMode] = useState<'parallel' | 'sequential'>('parallel');

  const [checkerType, setCheckerType] = useState('ignore_trailing_space');
  const [customCheckerPath, setCustomCheckerPath] = useState('');
  const [customCheckerBinary, setCustomCheckerBinary] = useState('');
  const [checkerCompileError, setCheckerCompileError] = useState('');
  const [checkerCompileSuccess, setCheckerCompileSuccess] = useState(false);
  const [isCompilingChecker, setIsCompilingChecker] = useState(false);

  const handleCompileChecker = async (path: string, typeOverride?: string) => {
    if (!path.trim()) {
      return;
    }
    setIsCompilingChecker(true);
    setCheckerCompileError('');
    setCheckerCompileSuccess(false);

    try {
      const projectRoot = useProjectStore.getState().rootPath || '';
      const type = typeOverride ?? checkerType;
      if (path.toLowerCase().endsWith('.exe') && type !== 'themis_checker') {
        throw new Error("Only Themis Checker accepts .exe files");
      }
      const result = await compileChecker(path, type, projectRoot);
      if (result.success) {
        setCheckerCompileSuccess(true);
        setCustomCheckerBinary(result.binaryPath);
      } else {
        setCheckerCompileError(result.stderr || 'Checker compilation failed.');
      }
    } catch (err: unknown) {
      setCheckerCompileError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCompilingChecker(false);
    }
  };

  useEffect(() => {
    if (fileSettings) {
      setCompilerFlags(fileSettings.compilerFlags);
      setInterpreterFlags(fileSettings.interpreterFlags);
      setIoMode(fileSettings.ioMode);
      setInputFile(fileSettings.inputFile);
      setOutputFile(fileSettings.outputFile);
      setTimeLimitStr(fileSettings.timeLimitMs.toString());
      setMemoryLimitStr(Math.round(fileSettings.memoryLimitKb / 1024).toString());
      setRunMode(fileSettings.runMode);
      setCheckerType(fileSettings.checkerType || 'ignore_trailing_space');
      setCustomCheckerPath(fileSettings.customCheckerPath || '');
      setCustomCheckerBinary(fileSettings.customCheckerBinary || '');
      setCheckerCompileError('');
      setCheckerCompileSuccess(false);
    }
  }, [fileSettings]);

  const handleSave = async () => {
    const parsedTime = parseInt(timeLimitStr, 10) || 1000;
    const parsedMemory = (parseInt(memoryLimitStr, 10) * 1024) || 262144;
    await onSave({
      ...(fileSettings || {}),
      filePath: activeFile,
      compilerFlags,
      interpreterFlags,
      ioMode,
      inputFile,
      outputFile,
      timeLimitMs: parsedTime,
      memoryLimitKb: parsedMemory,
      runMode,
      checkerType,
      customCheckerPath,
      customCheckerBinary,
    } as FileSettings);
    onClose();
  };

  const filename = activeFile.split('/').pop() || '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 select-none animate-in fade-in duration-[var(--zcp-duration)]">
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-5 w-[480px] flex flex-col gap-4 animate-in zoom-in-95 duration-[var(--zcp-duration)] font-[var(--zcp-font-ui)]">
        <div className="flex items-center justify-between border-b border-[var(--zcp-border)] pb-2">
          <span className="text-[13px] font-semibold text-[var(--zcp-text-primary)] flex items-center gap-1.5">
            <span className="codicon codicon-settings-gear text-[14px] text-[var(--zcp-text-secondary)]" />
            Problem Settings ({filename})
          </span>
          <button onClick={onClose} className="text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] transition-colors flex items-center justify-center cursor-pointer">
            <span className="codicon codicon-close text-[14px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 max-h-[70vh] pr-1 scrollbar-thin">
          {activeFile.endsWith('.py') ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Python Interpreter Flags</label>
              <input type="text" value={interpreterFlags} onChange={e => setInterpreterFlags(e.target.value)} placeholder="e.g. -u (default empty)" className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full font-[var(--zcp-font-mono)] focus-visible-outline" />
              <span className="text-[11px] text-[var(--zcp-text-muted)] mt-1 font-normal leading-normal">Arguments passed directly to the Python interpreter.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">g++ Compiler Flags</label>
              <input type="text" value={compilerFlags} onChange={e => setCompilerFlags(e.target.value)} placeholder="Default: -O2 -std=c++17" className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full font-[var(--zcp-font-mono)] focus-visible-outline" />
              <span className="text-[11px] text-[var(--zcp-text-muted)] mt-1 font-normal leading-normal">Compiler flags used when compiling C++ files.</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Judge Mode</label>
            <select value={runMode} onChange={e => setRunMode(e.target.value as 'parallel' | 'sequential')} className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer">
              <option value="parallel">Parallel Judge</option>
              <option value="sequential">Sequential Judge</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">I/O Mode</label>
            <select value={ioMode} onChange={e => setIoMode(e.target.value as 'stdio' | 'file')} className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer">
              <option value="stdio">Standard I/O (cin/cout, stdin/stdout)</option>
              <option value="file">File I/O (freopen file read/write)</option>
            </select>
          </div>

          {ioMode === 'file' && (
            <div className="grid grid-cols-2 gap-3 p-2.5 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] animate-in slide-in-from-top-2 duration-[var(--zcp-duration)]">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Input File Name</label>
                <input type="text" value={inputFile} onChange={e => setInputFile(e.target.value)} placeholder={`${filename.split('.')[0] || 'solution'}.inp`} className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Output File Name</label>
                <input type="text" value={outputFile} onChange={e => setOutputFile(e.target.value)} placeholder={`${filename.split('.')[0] || 'solution'}.out`} className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline" />
              </div>
            </div>
          )}

          <CheckerSettings
            checkerType={checkerType}
            setCheckerType={setCheckerType}
            customCheckerPath={customCheckerPath}
            setCustomCheckerPath={setCustomCheckerPath}
            customCheckerBinary={customCheckerBinary}
            checkerCompileError={checkerCompileError}
            setCheckerCompileError={setCheckerCompileError}
            checkerCompileSuccess={checkerCompileSuccess}
            setCheckerCompileSuccess={setCheckerCompileSuccess}
            isCompilingChecker={isCompilingChecker}
            handleCompileChecker={handleCompileChecker}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Time Limit (ms)</label>
              <input type="text" value={timeLimitStr} onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setTimeLimitStr(val); }} placeholder="1000" className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Memory Limit (MB)</label>
              <input type="text" value={memoryLimitStr} onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setMemoryLimitStr(val); }} placeholder="256" className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--zcp-border)] pt-3 mt-1 shrink-0">
          <button type="button" onClick={onClose} className="h-[26px] px-3.5 bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-[11px] font-medium transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="h-[26px] px-4 bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] text-[11px] font-medium hover:opacity-90 transition active:scale-95 cursor-pointer">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
