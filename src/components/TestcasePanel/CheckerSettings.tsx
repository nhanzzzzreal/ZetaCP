// src/components/TestcasePanel/CheckerSettings.tsx

import React from 'react';
import { selectCheckerFile } from '../../lib/tauri-bridge';

interface CheckerSettingsProps {
  checkerType: string;
  setCheckerType: (val: string) => void;
  customCheckerPath: string;
  setCustomCheckerPath: (val: string) => void;
  customCheckerBinary: string;
  checkerCompileError: string;
  setCheckerCompileError: (val: string) => void;
  checkerCompileSuccess: boolean;
  setCheckerCompileSuccess: (val: boolean) => void;
  isCompilingChecker: boolean;
  handleCompileChecker: (path: string, typeOverride?: string) => Promise<void>;
}

export const CheckerSettings: React.FC<CheckerSettingsProps> = ({
  checkerType,
  setCheckerType,
  customCheckerPath,
  setCustomCheckerPath,
  customCheckerBinary,
  checkerCompileError,
  setCheckerCompileError,
  checkerCompileSuccess,
  setCheckerCompileSuccess,
  isCompilingChecker,
  handleCompileChecker,
}) => {
  const isCustom = ['themis_checker', 'testlib_checker', 'cms_checker', 'coci_checker', 'peg_checker', 'dmoj_checker', 'custom'].includes(checkerType);

  const handleSelectFile = async () => {
    try {
      const selected = await selectCheckerFile();
      if (selected) {
        setCustomCheckerPath(selected);
        await handleCompileChecker(selected);
      }
    } catch (err) {
      console.error("Error selecting checker file:", err);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Checker</label>
        <select
          value={checkerType}
          onChange={async (e) => {
            const type = e.target.value;
            setCheckerType(type);
            const needsCompile = ['themis_checker', 'testlib_checker', 'cms_checker', 'coci_checker', 'peg_checker', 'dmoj_checker', 'custom'].includes(type);
            if (needsCompile && customCheckerPath.trim()) {
              await handleCompileChecker(customCheckerPath, type);
            } else {
              setCheckerCompileError('');
              setCheckerCompileSuccess(false);
            }
          }}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full focus-visible-outline cursor-pointer"
        >
          <option value="ignore_trailing_space">Ignore Trailing Space</option>
          <option value="strictly_the_same">Exact Match / Strict</option>
          <option value="yes_no_ignore_case">Yes/No (Case-insensitive)</option>
          <option value="floating_point_3">Floating point 10^-3 error</option>
          <option value="floating_point_6">Floating point 10^-6 error</option>
          <option value="floating_point_9">Floating point 10^-9 error</option>
          <option value="themis_checker">Themis Checker</option>
          <option value="testlib_checker">Testlib Checker</option>
          <option value="cms_checker">CMS Checker</option>
          <option value="coci_checker">COCI Checker</option>
          <option value="peg_checker">PEG Checker</option>
          <option value="dmoj_checker">DMOJ Checker</option>
          <option value="custom">Custom Checker (Other)</option>
        </select>
      </div>

      {isCustom && (
        <div className="p-3 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-[var(--zcp-duration)]">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Checker Path</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customCheckerPath}
                onChange={e => {
                  setCustomCheckerPath(e.target.value);
                  setCheckerCompileError('');
                  setCheckerCompileSuccess(false);
                }}
                placeholder="Checker file path (.cpp, .py, .exe)..."
                className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-[12px] px-2.5 py-1.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] w-full flex-1 min-w-0 focus-visible-outline"
              />
              <button
                type="button"
                onClick={handleSelectFile}
                className="h-[26px] px-3 bg-[var(--zcp-bg-sidebar)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-primary)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-[11px] font-medium transition active:scale-95 flex items-center justify-center cursor-pointer"
              >
                Browse...
              </button>
            </div>
          </div>

          {customCheckerPath.trim() && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--zcp-text-muted)] font-normal truncate max-w-[200px]" title={customCheckerBinary}>
                {customCheckerBinary ? `Binary: ${customCheckerBinary.split('/').pop()}` : 'Not compiled'}
              </span>
              <button
                type="button"
                onClick={() => handleCompileChecker(customCheckerPath)}
                disabled={isCompilingChecker}
                className="h-[26px] px-3 bg-[var(--zcp-bg-sidebar)] hover:bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-primary)] rounded-[var(--zcp-radius-sm)] border border-[var(--zcp-border)] text-[11px] font-medium transition active:scale-95 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                {isCompilingChecker ? (
                  <>
                    <span className="w-2.5 h-2.5 border-2 border-[var(--zcp-text-secondary)] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Compiling...</span>
                  </>
                ) : (
                  <span>Compile Checker</span>
                )}
              </button>
            </div>
          )}

          {checkerCompileSuccess && (
            <div className="text-[11px] text-[var(--zcp-verdict-ac)] font-medium bg-[var(--zcp-verdict-ac)]/10 border border-[var(--zcp-verdict-ac)]/25 px-2 py-1 rounded-[var(--zcp-radius-sm)]">
              ✓ Checker compiled/copied successfully!
            </div>
          )}
          {checkerCompileError && (
            <div className="text-[11px] text-[var(--zcp-verdict-wa)] font-medium bg-[var(--zcp-verdict-wa)]/10 border border-[var(--zcp-verdict-wa)]/25 px-2 py-1 rounded-[var(--zcp-radius-sm)] max-h-[100px] overflow-y-auto font-mono whitespace-pre-wrap">
              Error: {checkerCompileError}
            </div>
          )}
        </div>
      )}
    </>
  );
};
