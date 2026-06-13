import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, placeholder as placeholderExt } from '@codemirror/view';
import { cn } from '../lib/utils';

interface CodeMirrorAreaProps {
  value: string;
  onChange?: (val: string) => void;
  onBlur?: (val: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

export const CodeMirrorArea: React.FC<CodeMirrorAreaProps> = ({
  value,
  onChange,
  onBlur,
  readOnly,
  placeholder,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onBlurRef.current = onBlur; }, [onBlur]);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      EditorView.editable.of(!readOnly),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "transparent" },
        ".cm-scroller": { overflow: "auto", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.4" },
        ".cm-gutters": {
          backgroundColor: "#252526",
          color: "#6b7280",
          borderRight: "1px solid #333",
          minWidth: "40px",
          paddingRight: "8px"
        },
        ".cm-content": { color: "#d1d5db", padding: "8px 4px", caretColor: "#d1d5db" },
        ".cm-cursor, .cm-dropCursor": { 
          borderLeftColor: "#d1d5db",
          transition: "left 0.08s cubic-bezier(0.2, 0, 0, 1), top 0.08s cubic-bezier(0.2, 0, 0, 1)"
        },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#264f78" },
        "&.cm-focused": { outline: "none" }
      }, { dark: true }),
      EditorView.domEventHandlers({
        blur: (e, view) => {
          if (onBlurRef.current) onBlurRef.current(view.state.doc.toString());
        }
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      })
    ];

    if (placeholder) extensions.push(placeholderExt(placeholder));

    const state = EditorState.create({ doc: value || '', extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => { view.destroy(); viewRef.current = null; };
  }, [placeholder, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value || '' } });
    }
  }, [value]);

  return (
    <div 
      ref={containerRef} 
      className={cn("overflow-hidden bg-[#1e1e1e] outline-none transition-shadow text-left", className)} 
    />
  );
};