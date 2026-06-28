import React from 'react';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { TestcaseMeta, TestcaseResult, TestcaseData } from '../../types/testcase';
import { useTestcaseStore } from '../../stores/useTestcaseStore';

interface TestcaseItemExpandedProps {
  meta: TestcaseMeta;
  data: TestcaseData | null;
  result: TestcaseResult | null;
  isRunning: boolean;
  localInput: string;
  localExpected: string;
  setLocalInput: (val: string) => void;
  setLocalExpected: (val: string) => void;
}

export const TestcaseItemExpanded: React.FC<TestcaseItemExpandedProps> = ({
  meta,
  data,
  result,
  isRunning,
  localInput,
  localExpected,
  setLocalInput,
  setLocalExpected,
}) => {
  return (
    <div 
      className="space-y-2 mt-1.5 border-t border-[var(--zcp-border)] pt-1.5 pr-2 animate-slide-down font-[var(--zcp-font-ui)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Input</span>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(localInput);
              }}
              className="text-[10px] text-[var(--zcp-text-muted)] hover:text-[var(--zcp-text-active)] cursor-pointer transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
        <CodeMirrorEditor
          key={`${meta.id}-input`}
          value={localInput}
          onChange={setLocalInput}
          onBlur={(val) => {
            if (val !== (data?.input || '')) {
              useTestcaseStore.getState().updateTestcaseData(meta.id, val, data?.expectedOutput || '');
            }
          }}
          className="w-full h-24 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
          readOnly={isRunning}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Expected Answer</span>
          <button 
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(localExpected);
            }}
            className="text-[10px] text-[var(--zcp-text-muted)] hover:text-[var(--zcp-text-active)] cursor-pointer transition-colors"
          >
            Copy
          </button>
        </div>
        <CodeMirrorEditor
          key={`${meta.id}-expected`}
          value={localExpected}
          onChange={setLocalExpected}
          onBlur={(val) => {
            if (val !== (data?.expectedOutput || '')) {
              useTestcaseStore.getState().updateTestcaseData(meta.id, data?.input || '', val);
            }
          }}
          className="w-full h-24 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
          readOnly={isRunning}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Actual Output</span>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(result?.actualOutput || '');
              }}
              className="text-[10px] text-[var(--zcp-text-muted)] hover:text-[var(--zcp-text-active)] cursor-pointer transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
        <CodeMirrorEditor
          key={`${meta.id}-actual`}
          readOnly
          value={result?.actualOutput || ''}
          placeholder="No output yet"
          className="w-full h-24 bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] overflow-hidden"
        />
      </div>
    </div>
  );
};
