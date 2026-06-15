// src/components/Settings/SnippetEditor.tsx

import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, drawSelection, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';

interface SnippetEditorProps {
  value: string;
  onChange: (val: string) => void;
  language: string; // 'cpp' | 'python'
  readOnly?: boolean;
  className?: string;
}

export const SnippetEditor: React.FC<SnippetEditorProps> = React.memo(({
  value,
  onChange,
  language,
  readOnly = false,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Base extensions
    const extensions = [
      oneDark,
      lineNumbers(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      EditorView.editable.of(!readOnly),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
          fontFamily: 'Consolas, "Cascadia Code", "JetBrains Mono", monospace',
          backgroundColor: '#1e1e1e',
        },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { padding: '8px 0', caretColor: '#528bff' },
        '.cm-gutters': {
          backgroundColor: '#1e1e1e',
          color: '#858585',
          borderRight: 'none',
          minWidth: '35px',
          paddingRight: '8px',
          textAlign: 'right'
        },
        '&.cm-focused': { outline: 'none' }
      }, { dark: true }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      })
    ];

    // Language syntax highlighting
    if (language === 'cpp') {
      extensions.push(cpp());
    } else if (language === 'python') {
      extensions.push(python());
    }

    const state = EditorState.create({
      doc: value || '',
      extensions
    });

    const view = new EditorView({
      state,
      parent: containerRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, readOnly]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value || '' }
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden border border-[var(--zcp-border-default,#333)] rounded-md ${className}`}
    />
  );
});

SnippetEditor.displayName = 'SnippetEditor';
