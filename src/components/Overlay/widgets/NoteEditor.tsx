// src/components/Overlay/widgets/NoteEditor.tsx

import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { useOverlayStore } from '../../../stores/useOverlayStore';

interface NoteEditorProps {
  id: string;
  initialContent: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ id, initialContent }) => {
  const updateContent = useOverlayStore((state) => state.updateContent);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const updateTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Extenstion cơ bản cho Note Editor
    const extensions = [
      oneDark,
      history(),
      drawSelection(),
      highlightActiveLine(),
      EditorView.lineWrapping, // Tự động xuống dòng khi dài
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '12px',
          fontFamily: 'Consolas, "Cascadia Code", "JetBrains Mono", monospace',
          backgroundColor: '#2a2a2a',
        },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { padding: '8px 0', caretColor: '#528bff' },
        '.cm-gutters': { display: 'none' }, // Bỏ cột số dòng cho Note tối giản
        '&.cm-focused': { outline: 'none' }
      }),
      // Lắng nghe thay đổi nội dung để auto-save
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString();
          if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
          
          updateTimeoutRef.current = setTimeout(() => {
            updateContent(id, content);
          }, 300); // 300ms debounce
        }
      })
    ];

    const state = EditorState.create({
      doc: initialContent,
      extensions
    });

    const view = new EditorView({
      state,
      parent: editorRef.current
    });

    viewRef.current = view;

    // Focus vào editor ngay khi mở
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, [id]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden select-text">
      {/* CodeMirror container */}
      <div 
        ref={editorRef} 
        className="flex-1 min-h-0 [&_.cm-editor]:h-full [&_.cm-scroller]:h-full"
      />
      
      {/* Ghi chú footer */}
      <div className="h-5 bg-[#202020] border-t border-[#2d2d2d] px-3 flex items-center justify-between text-neutral-500 text-[9px] font-sans font-semibold shrink-0 select-none">
        <span>CodeMirror 6 Editor</span>
        <span>Autosave</span>
      </div>
    </div>
  );
};
