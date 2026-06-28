// src/components/Editor/lspProviders.ts

import { lspGetCompletions, lspGetHover, lspGetDefinition } from '../../lib/tauri-bridge';
import { useSnippetStore } from '../../stores/useSnippetStore';
import { useProjectStore } from '../../stores/useProjectStore';
import {
  parseLspCompletions,
  parseHoverContent,
  parseLspDefinition,
  getLspLang
} from './lspMappers';

export function defineMonacoTheme(monaco: any) {
  monaco.editor.defineTheme('vscode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [{ token: '', foreground: 'cccccc' }],
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
}

export function setupCursorTracking(editor: any) {
  editor.onDidChangeCursorPosition((e: any) => {
    const { setCursorPos } = useProjectStore.getState();
    setCursorPos({ line: e.position.lineNumber, column: e.position.column });
  });
}

export function setupInitialContent(editor: any, activeFile: string | null) {
  const model = editor.getModel();
  if (model && activeFile) {
    const cached = useProjectStore.getState().fileContents[activeFile] || useProjectStore.getState().activeFileContent;
    if (cached) {
      model.setValue(cached);
    }
  }
}

function getSnippetCompletions(monaco: any, lang: string, defaultRange: any) {
  const snippets = useSnippetStore.getState().snippets || [];
  const customSnippets = snippets.filter(
    (s) => s.language.toLowerCase() === lang.toLowerCase()
  );
  return customSnippets.map((snippet) => ({
    label: snippet.trigger,
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: snippet.code,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: snippet.description,
    documentation: { value: snippet.code, isTrusted: true },
    range: { insert: defaultRange, replace: defaultRange }
  }));
}

async function fetchLspCompletions(
  lang: string,
  file: string,
  content: string,
  position: any,
  defaultRange: any,
  monaco: any,
  flushLspDidChange: (filePath: string, content: string, language: string) => Promise<void>
) {
  try {
    await flushLspDidChange(file, content, lang);
    const res = await lspGetCompletions(lang, file, position.lineNumber - 1, position.column - 1);
    return parseLspCompletions(res, monaco, defaultRange, position, lang);
  } catch (err) {
    console.warn(`LSP completion failed for ${lang}:`, err);
    return [];
  }
}

export function registerCompletionProvider(
  monaco: any,
  lang: string,
  activeFileRef: React.MutableRefObject<string | null>,
  flushLspDidChange: (filePath: string, content: string, language: string) => Promise<void>
) {
  return monaco.languages.registerCompletionItemProvider(lang, {
    triggerCharacters: ['.', '>', ':', '/', '('],
    provideCompletionItems: async (_model: any, position: any) => {
      const file = activeFileRef.current;
      if (!file || getLspLang(file) !== lang) return { suggestions: [] };
      const word = _model.getWordUntilPosition(position);
      const defaultRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      const lspSuggestions = await fetchLspCompletions(
        lang, file, _model.getValue(), position, defaultRange, monaco, flushLspDidChange
      );
      const snippetCompletions = getSnippetCompletions(monaco, lang, defaultRange);
      return { suggestions: [...lspSuggestions, ...snippetCompletions] };
    }
  });
}

export function registerHoverProvider(
  monaco: any,
  lang: string,
  activeFileRef: React.MutableRefObject<string | null>,
  flushLspDidChange: (filePath: string, content: string, language: string) => Promise<void>
) {
  return monaco.languages.registerHoverProvider(lang, {
    provideHover: async (_model: any, position: any) => {
      const file = activeFileRef.current;
      if (!file || getLspLang(file) !== lang) return null;
      try {
        await flushLspDidChange(file, _model.getValue(), lang);
        const res: any = await lspGetHover(lang, file, position.lineNumber - 1, position.column - 1);
        if (!res || !res.contents) return null;
        const rawContents = res.contents;
        const contents = Array.isArray(rawContents)
          ? rawContents.map(c => parseHoverContent(c))
          : [parseHoverContent(rawContents)];
        return { contents };
      } catch (err) {
        console.warn(`LSP hover failed for ${lang}:`, err);
        return null;
      }
    }
  });
}

export function registerDefinitionProvider(
  monaco: any,
  lang: string,
  activeFileRef: React.MutableRefObject<string | null>,
  flushLspDidChange: (filePath: string, content: string, language: string) => Promise<void>
) {
  return monaco.languages.registerDefinitionProvider(lang, {
    provideDefinition: async (_model: any, position: any) => {
      const file = activeFileRef.current;
      if (!file || getLspLang(file) !== lang) return null;
      try {
        await flushLspDidChange(file, _model.getValue(), lang);
        const res: any = await lspGetDefinition(lang, file, position.lineNumber - 1, position.column - 1);
        return parseLspDefinition(res, monaco);
      } catch (err) {
        console.warn(`LSP definition failed for ${lang}:`, err);
        return null;
      }
    }
  });
}
