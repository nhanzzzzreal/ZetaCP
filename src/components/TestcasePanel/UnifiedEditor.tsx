import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { DiffLine } from '../../types/testcase';

interface UnifiedEditorProps {
  diffLines: DiffLine[];
}

export function UnifiedEditor({ diffLines }: UnifiedEditorProps) {
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
