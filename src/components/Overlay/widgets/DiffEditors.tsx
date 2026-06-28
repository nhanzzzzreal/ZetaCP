import { useEffect, useRef } from 'react';
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

export interface DiffLine {
  line: number;
  expected: string;
  actual: string;
}

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
      backgroundColor: '#2a2a2a',
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

interface MergeEditorProps {
  expected: string;
  actual: string;
}

export function MergeEditor({ expected, actual }: MergeEditorProps) {
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
    backgroundColor: '#2a2a2a',
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

interface UnifiedEditorProps {
  diffLines: DiffLine[];
}

export function UnifiedEditor({ diffLines }: UnifiedEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) { 
      viewRef.current.destroy(); 
      viewRef.current = null; 
    }

    const state = EditorState.create({
      doc: buildUnifiedText(diffLines),
      extensions: [...baseExtensions, unifiedTheme, unifiedLineHighlight],
    });
    viewRef.current = new EditorView({ state, parent: hostRef.current });

    return () => { 
      viewRef.current?.destroy(); 
      viewRef.current = null; 
    };
  }, [diffLines]);

  return <div ref={hostRef} className="h-full w-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:h-full" />;
}
