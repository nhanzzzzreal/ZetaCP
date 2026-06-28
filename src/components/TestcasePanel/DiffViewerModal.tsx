// src/components/TestcasePanel/DiffViewerModal.tsx

import React, { useRef, useState } from 'react';
import { useOverlayStore } from '../../stores/useOverlayStore';
import { DiffLine } from '../../types/testcase';
import { MergeEditor } from './MergeEditor';
import { UnifiedEditor } from './UnifiedEditor';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  testcaseId: string;
  testcaseName: string;
  diffLines: DiffLine[];
}

type Layout = 'split' | 'unified';

function buildTexts(diffLines: DiffLine[]): { expected: string; actual: string } {
  if (diffLines.length === 0) return { expected: '', actual: '' };
  return {
    expected: diffLines.map(l => l.expected).join('\n'),
    actual:   diffLines.map(l => l.actual).join('\n'),
  };
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  testcaseId,
  testcaseName,
  diffLines,
}) => {
  const [layout, setLayout] = useState<Layout>('split');
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isOpen, modalRef);

  if (!isOpen) return null;

  const { expected, actual } = buildTexts(diffLines);
  const totalDiff  = diffLines.filter(l => l.expected !== l.actual).length;
  const totalLines = diffLines.length;
  const addOverlay = useOverlayStore(state => state.addOverlay);

  const handleDetach = async () => {
    try {
      await addOverlay(
        'diff', 
        `Diff — ${testcaseName}`, 
        JSON.stringify({ testcaseId, expected, actual })
      );
      onClose();
    } catch (err) {
      console.error("Error detaching diff window:", err);
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-[var(--zcp-duration)]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-[var(--zcp-duration)] text-[var(--zcp-text-primary)]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[var(--zcp-text-active)] leading-tight">Output Diff</span>
              <span className="text-[11px] text-[var(--zcp-text-secondary)] font-mono">{testcaseName}</span>
            </div>
            {totalLines > 0 && (
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--zcp-verdict-wa)]/10 text-[var(--zcp-verdict-wa)] border border-[var(--zcp-verdict-wa)]/20 font-mono font-semibold">
                  -{totalDiff}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--zcp-verdict-ac)]/10 text-[var(--zcp-verdict-ac)] border border-[var(--zcp-verdict-ac)]/20 font-mono font-semibold">
                  +{totalDiff}
                </span>
                <span className="text-[10px] text-[var(--zcp-text-secondary)] font-mono">
                  {totalDiff}/{totalLines} lines differ
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDetach}
              title="Detach diff window"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[11px] font-bold text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]/50 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
            >
              <span className="codicon codicon-link-external text-[13px] flex items-center justify-center" />
              Detach
            </button>

            <div className="flex items-center bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setLayout('split')}
                title="Split view — side-by-side"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[11px] font-bold transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
                  layout === 'split'
                    ? 'bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-active)]'
                    : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]/50'
                }`}
              >
                <span className="codicon codicon-split-horizontal text-[13px]" />
                Split
              </button>
              <button
                type="button"
                onClick={() => setLayout('unified')}
                title="Unified view — single column"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[11px] font-bold transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
                  layout === 'unified'
                    ? 'bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-active)]'
                    : 'text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]/50'
                }`}
              >
                <span className="codicon codicon-list-flat text-[13px]" />
                Unified
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)] rounded-[var(--zcp-radius-sm)] transition-all cursor-pointer"
            >
              <span className="codicon codicon-close text-[14px] flex items-center justify-center" />
            </button>
          </div>
        </div>

        {/* Labels */}
        {layout === 'split' ? (
          <div className="flex shrink-0 border-b border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)]/40 text-[10px] font-bold uppercase tracking-widest font-sans">
            <div className="flex-1 px-4 py-1.5 flex items-center gap-2 text-[var(--zcp-verdict-wa)] border-r border-[var(--zcp-border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--zcp-verdict-wa)] inline-block" />
              Expected Output
            </div>
            <div className="flex-1 px-4 py-1.5 flex items-center gap-2 text-[var(--zcp-verdict-ac)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--zcp-verdict-ac)] inline-block" />
              Actual Output
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)]/40 text-[10px] uppercase tracking-widest shrink-0 font-sans">
            <span className="flex items-center gap-1.5 text-[var(--zcp-verdict-wa)] font-bold">
              <span className="font-mono">-</span> Expected
            </span>
            <span className="text-[var(--zcp-text-secondary)]">•</span>
            <span className="flex items-center gap-1.5 text-[var(--zcp-verdict-ac)] font-bold">
              <span className="font-mono">+</span> Actual
            </span>
            <span className="text-[var(--zcp-text-secondary)]">•</span>
            <span className="text-[var(--zcp-text-secondary)] font-medium">Unchanged lines collapsed</span>
          </div>
        )}

        {/* Content */}
        {diffLines.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--zcp-text-secondary)]">
            No diff data to display.
          </div>
        ) : totalDiff === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <span className="codicon codicon-check text-[32px] text-[var(--zcp-verdict-ac)]" />
            <span className="text-sm font-semibold text-[var(--zcp-verdict-ac)]">All lines match perfectly!</span>
            <span className="text-xs text-[var(--zcp-text-secondary)]">{totalLines} lines — No differences found.</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-[#1f1f1f]">
            {layout === 'unified'
              ? <UnifiedEditor diffLines={diffLines} />
              : <MergeEditor expected={expected} actual={actual} />
            }
          </div>
        )}
      </div>
    </div>
  );
};
