// src/components/TestcasePanel/DiffViewerModal.tsx

import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { MergeView } from '@codemirror/merge';
import { oneDark } from '@codemirror/theme-one-dark';
import { useOverlayStore } from '../../stores/useOverlayStore';

// ─── Public types ────────────────────────────────────────────────────────────

export interface DiffLine {
  line: number;
  expected: string;
  actual: string;
}

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  testcaseId: string;
  testcaseName: string;
  diffLines: DiffLine[];
}

// ─── Layout mode (only 2 modes: split & unified) ───────────────────────────────

type Layout = 'split' | 'unified';

// ─── Build plain text from DiffLine[] ────────────────────────────────────────

function buildTexts(diffLines: DiffLine[]): { expected: string; actual: string } {
  if (diffLines.length === 0) return { expected: '', actual: '' };
  return {
    expected: diffLines.map(l => l.expected).join('\n'),
    actual:   diffLines.map(l => l.actual).join('\n'),
  };
}

// ─── CodeMirror base extensions ───────────────────────────────────────────────

const baseExtensions = [
  oneDark,
  lineNumbers(),
  highlightActiveLine(),
  EditorView.editable.of(false),
  EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '12px',
      fontFamily: 'Consolas, "Cascadia Mono", monospace',
      backgroundColor: '#1f1f1f',
    },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { padding: '8px 0' },
    '.cm-gutters': { backgroundColor: '#161616', borderRight: '1px solid #262626' },
    '.cm-changedLine': { backgroundColor: 'rgba(239,68,68,0.12) !important' },
    '.cm-changedText': {
      backgroundColor: 'rgba(239,68,68,0.35) !important',
      borderRadius: '2px',
    },
    '.cm-mergeView .cm-b .cm-changedLine': { backgroundColor: 'rgba(34,197,94,0.12) !important' },
    '.cm-mergeView .cm-b .cm-changedText': { backgroundColor: 'rgba(34,197,94,0.35) !important' },
  }),
];

// ─── Split view via @codemirror/merge MergeView ──────────────────────────────

interface MergeEditorProps {
  expected: string;
  actual: string;
}

function MergeEditor({ expected, actual }: MergeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    
    try {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const mergeView = new MergeView({
        a: {
          doc: expected,
          extensions: baseExtensions,
        },
        b: {
          doc: actual,
          extensions: baseExtensions,
        },
        parent: hostRef.current,
        highlightChanges: true,
        gutter: true,
        collapseUnchanged: {
          margin: 3,
          minSize: 4,
        },
      });

      viewRef.current = mergeView;
    } catch (err) {
      console.error("Error initializing CodeMirror MergeView:", err);
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [expected, actual]);

  return <div ref={hostRef} className="w-full h-full cm-diff-split-container" />;
}

// ─── Unified view via custom decorator ───────────────────────────────────────

interface UnifiedEditorProps {
  diffLines: DiffLine[];
}

function UnifiedEditor({ diffLines }: UnifiedEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const docText = diffLines.map(line => {
        if (line.expected !== line.actual) {
          return `- ${line.expected}\n+ ${line.actual}`;
        }
        return `  ${line.expected}`;
      }).join('\n');

      const view = new EditorView({
        state: EditorState.create({
          doc: docText,
          extensions: [
            oneDark,
            lineNumbers(),
            highlightActiveLine(),
            EditorView.editable.of(false),
            EditorView.theme({
              '&': {
                height: '100%',
                fontSize: '12px',
                fontFamily: 'Consolas, "Cascadia Mono", monospace',
                backgroundColor: '#1f1f1f',
              },
              '.cm-scroller': { overflow: 'auto' },
              '.cm-content': { padding: '8px 0' },
              '.cm-gutters': { backgroundColor: '#161616', borderRight: '1px solid #262626' },
            }),
          ],
        }),
        parent: containerRef.current,
      });

      viewRef.current = view;
    } catch (err) {
      console.error("Error initializing CodeMirror Unified EditorView:", err);
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [diffLines]);

  return <div ref={containerRef} className="w-full h-full" />;
}

// ─── DiffViewerModal Component ───────────────────────────────────────────────

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  testcaseId,
  testcaseName,
  diffLines,
}) => {
  const [layout, setLayout] = useState<Layout>('split');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modal = modalRef.current;
    if (modal) {
      const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;

      const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length === 0) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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

        {/* ── Header ── */}
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
            {/* Detach button */}
            <button
              onClick={handleDetach}
              title="Detach diff window"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[11px] font-bold text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]/50 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
            >
              <span className="codicon codicon-link-external text-[13px] flex items-center justify-center" />
              Detach
            </button>

            {/* Layout Segmented Control — only Split & Unified */}
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

        {/* ── Column labels (split only) ── */}
        {layout === 'split' && (
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
        )}

        {/* ── Unified label ── */}
        {layout === 'unified' && (
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[var(--zcp-border)] bg-[var(--zcp-bg-sidebar)]/40 text-[10px] uppercase tracking-widest shrink-0 font-sans">
            <span className="flex items-center gap-1.5 text-[var(--zcp-verdict-wa)] font-bold">
              <span className="font-mono">-</span> Expected
            </span>
            <span className="text-[var(--zcp-text-secondary)]">•</span>
            <span className="flex items-center gap-1.5 text-[var(--zcp-verdict-ac)] font-bold">
              <span className="font-mono">+</span> Actual
            </span>
            <span className="text-[var(--zcp-text-secondary)]">•</span>
            <span className="text-[var(--zcp-text-secondary)]">Unchanged lines collapsed</span>
          </div>
        )}

        {/* ── Content ── */}
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
