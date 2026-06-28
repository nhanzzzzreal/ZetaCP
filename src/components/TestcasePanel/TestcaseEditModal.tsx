// src/components/TestcasePanel/TestcaseEditModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface TestcaseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  testcaseName: string;
  initialInput: string;
  initialExpected: string;
  actualOutput?: string;
  hasResult?: boolean;
  onSave: (input: string, expected: string) => void;
  isRunning: boolean;
}

export const TestcaseEditModal: React.FC<TestcaseEditModalProps> = ({
  isOpen,
  onClose,
  testcaseName,
  initialInput,
  initialExpected,
  actualOutput = '',
  hasResult = false,
  onSave,
  isRunning,
}) => {
  const [input, setInput] = useState(initialInput);
  const [expected, setExpected] = useState(initialExpected);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const modalRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in window event listeners (Escape key)
  const latestInput = useRef(input);
  const latestExpected = useRef(expected);

  useEffect(() => {
    latestInput.current = input;
    latestExpected.current = expected;
  }, [input, expected]);

  // Sync state if initial values change (e.g. from hot reload or outside edits)
  useEffect(() => {
    if (isOpen) {
      setInput(initialInput);
      setExpected(initialExpected);
    }
  }, [isOpen, initialInput, initialExpected]);

  // Helper to save and trigger close
  const handleSaveAndClose = () => {
    onSave(input, expected);
    onClose();
  };

  // Close modal on escape key (with auto-save)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSave(latestInput.current, latestExpected.current);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSave]);

  useFocusTrap(isOpen, modalRef);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-[var(--zcp-duration)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSaveAndClose();
      }}
    >
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_12px_40px_rgba(0,0,0,0.5)] w-[95vw] max-w-7xl h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-[var(--zcp-duration)] text-[var(--zcp-text-primary)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] shrink-0">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[var(--zcp-text-active)] leading-tight">Edit Testcase Data</span>
            <span className="text-[11px] text-[var(--zcp-text-secondary)] font-mono">{testcaseName}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Layout Toggle Segmented Control */}
            <div className="flex items-center bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setLayout('horizontal')}
                title="Horizontal Layout (Side-by-side)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[11px] font-bold transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
                  layout === 'horizontal'
                    ? 'bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-active)]'
                    : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]/50'
                }`}
              >
                <span className="codicon codicon-split-horizontal text-[13px]" />
                <span>Horizontal</span>
              </button>
              <button
                type="button"
                onClick={() => setLayout('vertical')}
                title="Vertical Layout (Stacked)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[11px] font-bold transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
                  layout === 'vertical'
                    ? 'bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-active)]'
                    : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]/50'
                }`}
              >
                <span className="codicon codicon-split-vertical text-[13px]" />
                <span>Vertical</span>
              </button>
            </div>

            <button
              onClick={handleSaveAndClose}
              className="p-1.5 text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] rounded-[var(--zcp-radius-sm)] transition-all cursor-pointer"
            >
              <span className="codicon codicon-close text-[14px] flex items-center justify-center" />
            </button>
          </div>
        </div>

        {/* Content Editors */}
        <div className="flex-1 min-h-0 p-4 bg-[var(--zcp-bg-editor)] overflow-hidden">
          <div
            className={`w-full h-full flex ${
              layout === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-4'
            }`}
          >
            {/* Input Editor Block */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="flex items-center justify-between mb-1.5 px-1 shrink-0 select-none">
                <span className="text-[10px] text-[var(--zcp-text-secondary)] uppercase tracking-wider font-bold font-sans flex items-center gap-1.5">
                  <span className="codicon codicon-terminal text-[12px] text-blue-400" />
                  Input
                </span>
              </div>
              <CodeMirrorEditor
                value={input}
                onChange={setInput}
                className="flex-1 border border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
                readOnly={isRunning}
                placeholder="Enter input data..."
              />
            </div>

            {/* Expected Output Editor Block */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="flex items-center justify-between mb-1.5 px-1 shrink-0 select-none">
                <span className="text-[10px] text-[var(--zcp-text-secondary)] uppercase tracking-wider font-bold font-sans flex items-center gap-1.5">
                  <span className="codicon codicon-pass-filled text-[12px] text-green-400" />
                  Expected Output
                </span>
              </div>
              <CodeMirrorEditor
                value={expected}
                onChange={setExpected}
                className="flex-1 border border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
                readOnly={isRunning}
                placeholder="Enter expected answer..."
              />
            </div>

            {/* Actual Output Editor Block */}
            {hasResult && (
              <div className="flex-1 flex flex-col min-w-0 min-h-0 animate-in fade-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between mb-1.5 px-1 shrink-0 select-none">
                  <span className="text-[10px] text-[var(--zcp-text-secondary)] uppercase tracking-wider font-bold font-sans flex items-center gap-1.5">
                    <span className="codicon codicon-info text-[12px] text-amber-400" />
                    Actual Output
                  </span>
                </div>
                <CodeMirrorEditor
                  value={actualOutput}
                  readOnly={true}
                  className="flex-1 border border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
                  placeholder="No run results yet..."
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
