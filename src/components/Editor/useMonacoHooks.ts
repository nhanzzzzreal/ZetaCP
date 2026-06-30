// src/components/Editor/useMonacoHooks.ts

import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { readTextFile, lspDidOpen, lspDidChange } from '../../lib/tauri-bridge';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSnippetStore } from '../../stores/useSnippetStore';
import { uriToPath, mapLspSeverity, getLspLang } from './lspMappers';

function handleLspDiagnostics(payload: any, monaco: any) {
  if (!monaco) return;
  const { language, uri, diagnostics } = payload;
  const filePath = uriToPath(uri);
  const targetModel = monaco.editor.getModels().find((m: any) => {
    const mPath = m.uri.path;
    const cleanPath = filePath.replace(/\\/g, '/');
    return mPath.endsWith(cleanPath) || cleanPath.endsWith(mPath);
  });
  if (targetModel) {
    const markers = diagnostics.map((d: any) => ({
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      message: d.message,
      severity: mapLspSeverity(d.severity, monaco),
      source: d.source || (language === 'cpp' ? 'clangd' : 'pylsp')
    }));
    monaco.editor.setModelMarkers(targetModel, 'lsp', markers);
  }
}

export function useDiagnostics(monacoRef: React.MutableRefObject<any>) {
  useEffect(() => {
    const unlistenPromise = listen<any>('lsp://diagnostics', (event) => {
      handleLspDiagnostics(event.payload, monacoRef.current);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [monacoRef]);
}

function applyDefaultSnippetIfEmpty(text: string, lang: string, activeFile: string): string {
  if (text.trim() !== '') return text;
  const defaultSnippet = useSnippetStore.getState().snippets.find(
    (s) => s.language === lang && s.is_default === 1
  );
  if (defaultSnippet) {
    useProjectStore.getState().setFileDirty(activeFile, true);
    return defaultSnippet.code;
  }
  return text;
}

async function loadCachedFile(activeFile: string, cached: string, active: boolean, editor: any) {
  if (!active) return;
  useProjectStore.getState().setActiveFileContent(cached);
  if (editor?.getModel() && editor.getModel().getValue() !== cached) {
    editor.getModel().setValue(cached);
  }
  try {
    await lspDidOpen(getLspLang(activeFile), activeFile, cached);
  } catch (err: unknown) {
    console.warn('LSP didOpen failed:', err);
  }
}

async function loadFreshFile(
  activeFile: string,
  rootPath: string,
  active: boolean,
  editor: any,
  actions: { setActiveFileContent: (val: string) => void; setFileContent: (file: string, val: string) => void }
) {
  let text = await readTextFile(activeFile, rootPath);
  if (!active) return;
  text = applyDefaultSnippetIfEmpty(text, getLspLang(activeFile), activeFile);
  actions.setFileContent(activeFile, text);
  actions.setActiveFileContent(text);
  if (editor?.getModel()) {
    editor.getModel().setValue(text);
  }
  try {
    await lspDidOpen(getLspLang(activeFile), activeFile, text);
  } catch (err: unknown) {
    console.warn('LSP didOpen failed:', err);
  }
}

async function performLoadFile(
  activeFile: string,
  rootPath: string,
  active: boolean,
  editor: any,
  actions: { setActiveFileContent: (val: string) => void; setFileContent: (file: string, val: string) => void }
) {
  const cached = useProjectStore.getState().fileContents[activeFile];
  if (cached !== undefined) {
    await loadCachedFile(activeFile, cached, active, editor);
  } else {
    try {
      await loadFreshFile(activeFile, rootPath, active, editor, actions);
    } catch (err: unknown) {
      console.error('Failed to read source file:', err);
    }
  }
}

export function useFileLoader(
  activeFile: string | null,
  rootPath: string | null,
  editorRef: React.MutableRefObject<any>
) {
  const setActiveFileContent = useProjectStore((s) => s.setActiveFileContent);
  const setFileContent = useProjectStore((s) => s.setFileContent);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!rootPath || !activeFile) {
        setActiveFileContent('');
        return;
      }
      await performLoadFile(activeFile, rootPath, active, editorRef.current, {
        setActiveFileContent,
        setFileContent,
      });
    };
    load();
    return () => {
      active = false;
    };
  }, [activeFile, rootPath, setActiveFileContent, setFileContent, editorRef]);
}

export function useLspChange() {
  const lspChangeTimeoutRef = useRef<any>(null);

  const triggerLspDidChange = useCallback((filePath: string, content: string, language: string) => {
    if (lspChangeTimeoutRef.current) {
      clearTimeout(lspChangeTimeoutRef.current);
    }
    lspChangeTimeoutRef.current = setTimeout(async () => {
      try {
        await lspDidChange(language, filePath, content);
      } catch (err: unknown) {
        console.warn('Failed to send LSP didChange:', err);
      }
    }, 150);
  }, []);

  const flushLspDidChange = useCallback(async (filePath: string, content: string, language: string) => {
    if (lspChangeTimeoutRef.current) {
      clearTimeout(lspChangeTimeoutRef.current);
      lspChangeTimeoutRef.current = null;
    }
    try {
      await lspDidChange(language, filePath, content);
    } catch (err: unknown) {
      console.warn('Failed to flush LSP didChange:', err);
    }
  }, []);

  return { triggerLspDidChange, flushLspDidChange };
}
