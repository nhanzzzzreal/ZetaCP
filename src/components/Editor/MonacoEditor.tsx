// src/components/Editor/MonacoEditor.tsx

import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { readTextFile } from '../../lib/tauri-bridge';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

export function MonacoEditor() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const activeFile = useProjectStore((s) => s.activeFile);
  const setActiveFileContent = useProjectStore((s) => s.setActiveFileContent);
  const setFileDirty = useProjectStore((s) => s.setFileDirty);
  const setFileContent = useProjectStore((s) => s.setFileContent);
  const editorRef = useRef<any>(null);

  const settings = useSettingsStore((state) => state.settings);
  const fontSize = settings?.font?.size ?? 14;
  const fontFamily = settings?.font?.editor ?? 'Consolas, "Cascadia Code", "Courier New", monospace';
  
  // Load file content from disk when the active file changes
  useEffect(() => {
    let active = true;

    const loadFile = async () => {
      if (!rootPath || !activeFile) {
        setActiveFileContent('');
        return;
      }

      // 1. Check cache in Zustand store
      const cached = useProjectStore.getState().fileContents[activeFile];
      if (cached !== undefined) {
        // Cache hit: update activeFileContent and let Monaco manage the model (keep cursor & undo stack)
        if (active) {
          setActiveFileContent(cached);
        }
        return;
      }

      // 2. Cache miss: read file from disk
      try {
        const text = await readTextFile(activeFile, rootPath);
        if (active) {
          // Save to cache
          setFileContent(activeFile, text);
          setActiveFileContent(text);
          
          // Set value directly to the Monaco Editor model for the initial load
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              model.setValue(text);
            }
          }
        }
      } catch (err) {
        console.error('Failed to read source file:', err);
      }
    };

    loadFile();

    return () => {
      // Cancel async task if activeFile changes before disk read completes
      active = false;
    };
  }, [activeFile, rootPath, setActiveFileContent, setFileContent]);

  const getLanguage = (fileName: string | null) => {
    if (!fileName) return 'cpp';
    if (fileName.endsWith('.py')) return 'python';
    return 'cpp';
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    monaco.editor.defineTheme('vscode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'cccccc' }
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editor.lineHighlightBackground': '#282828',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editorGutter.background': '#1e1e1e',
      }
    });
    monaco.editor.setTheme('vscode-dark');

    // Track cursor position and save to store for Status Bar display
    editor.onDidChangeCursorPosition((e: any) => {
      const { setCursorPos } = useProjectStore.getState();
      setCursorPos({ line: e.position.lineNumber, column: e.position.column });
    });

    // Set initial content on editor mount (e.g., restoring old session)
    const model = editor.getModel();
    if (model && activeFile) {
      const cached = useProjectStore.getState().fileContents[activeFile] || useProjectStore.getState().activeFileContent;
      if (cached) {
        model.setValue(cached);
      }
    }
  };

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--zcp-bg-editor)] text-[var(--zcp-text-secondary)] text-xs select-none">
        Select a source file (.cpp, .py) from the file tree to start editing.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--zcp-bg-editor)]">
      <div className="flex-1 min-h-0">
        <Editor
          path={activeFile} // Use path to manage multiple models, allowing extremely fast tab switching (no re-mount instance)
          height="100%"
          language={getLanguage(activeFile)}
          theme="vscode-dark"
          // NOTE: Remove the value={activeFileContent} property to switch the editor to Uncontrolled mode.
          // This prevents the library from auto-calling setValue and firing fake onChange events with old data when switching tabs (causing data swap).
          onChange={(val) => {
            // This event is now ONLY triggered by actual user typing actions
            const currentContent = useProjectStore.getState().activeFileContent;
            if (val !== currentContent) {
              setActiveFileContent(val || '');
              if (activeFile) {
                setFileDirty(activeFile, true);
              }
            }
          }}
          onMount={handleEditorDidMount}
          options={{
            fontSize: fontSize,
            fontFamily: fontFamily,
            lineHeight: 0,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
            },
            automaticLayout: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
          }}
        />
      </div>
    </div>
  );
}
