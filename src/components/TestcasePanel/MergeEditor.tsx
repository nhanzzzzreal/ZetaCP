import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { lineNumbers, highlightActiveLine, EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

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

interface MergeEditorProps {
  expected: string;
  actual: string;
}

export function MergeEditor({ expected, actual }: MergeEditorProps) {
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
