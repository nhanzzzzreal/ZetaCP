// src/components/Editor/MonacoEditor.tsx

import { useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { getLanguage, getLspLang } from './lspMappers';
import {
  defineMonacoTheme,
  setupCursorTracking,
  setupInitialContent,
  registerCompletionProvider,
  registerHoverProvider,
  registerDefinitionProvider,
} from './lspProviders';
import { useDiagnostics, useFileLoader, useLspChange } from './useMonacoHooks';

const getEditorOptions = (fontSize: number, fontFamily: string) => ({
  fontSize,
  fontFamily,
  lineHeight: 0,
  minimap: { enabled: false },
  lineNumbers: 'on' as const,
  scrollbar: { vertical: 'visible' as const, horizontal: 'visible' as const },
  automaticLayout: true,
  cursorBlinking: 'smooth' as const,
  cursorSmoothCaretAnimation: 'on' as const,
});

function MonacoEditorEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--zcp-bg-editor)] text-[var(--zcp-text-secondary)] text-xs select-none">
      Select a source file (.cpp, .py) from the file tree to start editing.
    </div>
  );
}

function MonacoEditorInstance({
  activeFile,
  onMount,
  triggerLspDidChange,
}: {
  activeFile: string;
  onMount: (editor: any, monaco: any) => void;
  triggerLspDidChange: (filePath: string, content: string, language: string) => void;
}) {
  const setActiveFileContent = useProjectStore((s) => s.setActiveFileContent);
  const setFileDirty = useProjectStore((s) => s.setFileDirty);
  const settings = useSettingsStore((state) => state.settings);
  const fontSize = settings?.font?.size ?? 14;
  const fontFamily = settings?.font?.editor ?? 'Consolas, "Cascadia Code", "Courier New", monospace';

  const onChange = useCallback((val: string | undefined) => {
    const current = useProjectStore.getState().activeFileContent;
    if (val !== undefined && val !== current) {
      setActiveFileContent(val);
      setFileDirty(activeFile, true);
      triggerLspDidChange(activeFile, val, getLspLang(activeFile));
    }
  }, [activeFile, triggerLspDidChange, setActiveFileContent, setFileDirty]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--zcp-bg-editor)]">
      <div className="flex-1 min-h-0">
        <Editor
          path={activeFile}
          height="100%"
          language={getLanguage(activeFile)}
          theme="vscode-dark"
          onChange={onChange}
          onMount={onMount}
          options={getEditorOptions(fontSize, fontFamily)}
        />
      </div>
    </div>
  );
}

function MonacoEditorActive({ activeFile }: { activeFile: string }) {
  const rootPath = useProjectStore((s) => s.rootPath);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const providersRef = useRef<any[]>([]);
  const activeFileRef = useRef<string | null>(null);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useDiagnostics(monacoRef);
  useFileLoader(activeFile, rootPath, editorRef);
  const { triggerLspDidChange, flushLspDidChange } = useLspChange();

  useEffect(() => {
    return () => {
      providersRef.current.forEach((p: any) => p.dispose());
      providersRef.current = [];
    };
  }, []);

  const onMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    defineMonacoTheme(monaco);
    setupCursorTracking(editor);
    setupInitialContent(editor, activeFile);
    providersRef.current.forEach((p: any) => p.dispose());
    const langs = ['cpp', 'python'];
    langs.forEach((lang) => {
      providersRef.current.push(
        registerCompletionProvider(monaco, lang, activeFileRef, flushLspDidChange),
        registerHoverProvider(monaco, lang, activeFileRef, flushLspDidChange),
        registerDefinitionProvider(monaco, lang, activeFileRef, flushLspDidChange)
      );
    });
  }, [activeFile, flushLspDidChange]);

  return <MonacoEditorInstance activeFile={activeFile} onMount={onMount} triggerLspDidChange={triggerLspDidChange} />;
}

export function MonacoEditor() {
  const activeFile = useProjectStore((s) => s.activeFile);
  if (!activeFile) {
    return <MonacoEditorEmptyState />;
  }
  return <MonacoEditorActive activeFile={activeFile} />;
}
