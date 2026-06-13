// src/components/Overlay/widgets/DiffViewerWidget.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Columns2, AlignJustify, CheckCircle2 } from 'lucide-react';
import { EditorState } from '@codemirror/state';
import { 
  EditorView, 
  lineNumbers, 
  highlightActiveLine, 
  ViewPlugin, 
  Decoration, 
  DecorationSet 
} from '@codemirror/view';
import { MergeView } from '@codemirror/merge';
import { oneDark } from '@codemirror/theme-one-dark';
import { RangeSetBuilder } from '@codemirror/state';
import { invoke } from '@tauri-apps/api/core';

export interface DiffLine {
  line: number;
  expected: string;
  actual: string;
}

type Layout = 'split' | 'unified';


// ─── CodeMirror base extensions ───────────────────────────────────────────────
const baseExtensions = [
  oneDark,
  lineNumbers(),
  highlightActiveLine(),
  EditorView.editable.of(false),
  EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '11px',
      fontFamily: 'Consolas, "Cascadia Code", "JetBrains Mono", monospace',
      backgroundColor: '#1f1f1f',
    },
    '.cm-scroller': { overflow: 'auto', height: '100%' },
    '.cm-content': { padding: '6px 0' },
    '.cm-gutters': { backgroundColor: 'var(--bg-medium, #161616)', borderRight: '1px solid var(--border-subtle, #262626)', color: 'var(--text-secondary, #858585)' },
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

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const mv = new MergeView({
      parent: hostRef.current,
      a: { doc: expected, extensions: baseExtensions },
      b: { doc: actual,   extensions: baseExtensions },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });

    viewRef.current = mv;

    return () => {
      mv.destroy();
      viewRef.current = null;
    };
  }, [expected, actual]);

  return (
    <div
      ref={hostRef}
      className="h-full w-full overflow-hidden [&_.cm-mergeView]:h-full [&_.cm-mergeView]:overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:h-full"
    />
  );
}

// ─── Unified diff view (single-pane, GitHub-style) ───────────────────────────
function buildUnifiedText(diffLines: DiffLine[]): string {
  if (diffLines.length === 0) return '';
  const lines: string[] = [];
  diffLines.forEach(dl => {
    if (dl.expected === dl.actual) {
      lines.push(` ${dl.expected}`);
    } else {
      lines.push(`-${dl.expected}`);
      lines.push(`+${dl.actual}`);
    }
  });
  return lines.join('\n');
}

const unifiedTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '11px',
    fontFamily: 'Consolas, "Cascadia Code", "JetBrains Mono", monospace',
    backgroundColor: '#1f1f1f',
  },
  '.cm-scroller': { overflow: 'auto', height: '100%' },
  '.cm-content': { padding: '6px 0' },
  '.cm-gutters': { backgroundColor: 'var(--bg-medium, #161616)', borderRight: '1px solid var(--border-subtle, #262626)', color: 'var(--text-secondary, #858585)' },
  '.cm-line-deleted': {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderLeft: '3px solid #ef4444',
    paddingLeft: '4px',
  },
  '.cm-line-added': {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderLeft: '3px solid #22c55e',
    paddingLeft: '4px',
  },
});

const deletedLineDeco = Decoration.line({ class: 'cm-line-deleted' });
const addedLineDeco   = Decoration.line({ class: 'cm-line-added'   });

const unifiedLineHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }
    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
          const line = view.state.doc.lineAt(pos);
          const text = line.text;
          if (text.startsWith('-')) builder.add(line.from, line.from, deletedLineDeco);
          else if (text.startsWith('+')) builder.add(line.from, line.from, addedLineDeco);
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

function UnifiedEditor({ diffLines }: { diffLines: DiffLine[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; }

    const state = EditorState.create({
      doc: buildUnifiedText(diffLines),
      extensions: [...baseExtensions, unifiedTheme, unifiedLineHighlight],
    });
    viewRef.current = new EditorView({ state, parent: hostRef.current });

    return () => { viewRef.current?.destroy(); viewRef.current = null; };
  }, [diffLines]);

  return <div ref={hostRef} className="h-full w-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:h-full" />;
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface DiffViewerWidgetProps {
  id: string;
  content: string; // JSON string chứa { testcaseId, expected, actual }
}

export const DiffViewerWidget: React.FC<DiffViewerWidgetProps> = ({ content }) => {
  const [layout, setLayout] = useState<Layout>('split');
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsedData, setParsedData] = useState<{ expected: string; actual: string } | null>(null);

  useEffect(() => {
    async function loadDiff() {
      try {
        setLoading(true);
        const data = JSON.parse(content);
        const expected = data.expected || '';
        const actual = data.actual || '';
        setParsedData({ expected, actual });

        const diffs = await invoke<DiffLine[]>('compute_diff', { expected, actual });
        setDiffLines(diffs);
      } catch (err) {
        console.error('Error loading diff widget:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDiff();
  }, [content]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 bg-[#1f1f1f]">
        Loading comparison data...
      </div>
    );
  }

  const { expected, actual } = parsedData || { expected: '', actual: '' };
  const totalDiff  = diffLines.filter(l => l.expected !== l.actual).length;
  const totalLines = diffLines.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1f1f1f] overflow-hidden select-none">
      {/* Sub-header toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2b2b2b]/30 bg-[#1e1e1e] shrink-0">
        <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
          {totalDiff}/{totalLines} lines differ
        </span>
        <div className="flex items-center bg-[var(--bg-medium)] border border-[var(--bg-secondary)] rounded p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setLayout('split')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              layout === 'split'
                ? 'bg-indigo-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Columns2 className="w-3 h-3" />
            Split
          </button>
          <button
            type="button"
            onClick={() => setLayout('unified')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              layout === 'unified'
                ? 'bg-indigo-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <AlignJustify className="w-3 h-3" />
            Unified
          </button>
        </div>
      </div>

      {/* Column Labels */}
      {layout === 'split' ? (
        <div className="flex shrink-0 border-b border-[var(--bg-secondary)] bg-[var(--bg-medium)]/40 text-[9px] font-bold uppercase tracking-widest text-neutral-500">
          <div className="flex-1 px-3 py-1 flex items-center gap-1.5 border-r border-[var(--bg-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            Expected
          </div>
          <div className="flex-1 px-3 py-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Actual
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-1 border-b border-[var(--bg-secondary)] bg-[var(--bg-medium)]/40 text-[9px] uppercase tracking-widest text-neutral-500 shrink-0">
          <span className="flex items-center gap-1.5"><span className="font-mono text-red-400">-</span> Expected</span>
          <span>•</span>
          <span className="flex items-center gap-1.5"><span className="font-mono text-green-400">+</span> Actual</span>
        </div>
      )}

      {/* Main Diff Content */}
      <div className="flex-1 min-h-0 bg-[#1f1f1f] relative">
        {diffLines.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">
            No diff data available.
          </div>
        ) : totalDiff === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1f1f1f]">
            <CheckCircle2 className="w-8 h-8 text-green-500/80" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-green-400">All lines match!</span>
            <span className="text-[10px] text-neutral-500">{totalLines} lines — No differences.</span>
          </div>
        ) : (
          <div className="h-full w-full">
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
