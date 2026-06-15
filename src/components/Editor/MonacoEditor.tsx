// src/components/Editor/MonacoEditor.tsx

import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { readTextFile } from '../../lib/tauri-bridge';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useSnippetStore } from '../../stores/useSnippetStore';

// Map LSP CompletionItemKind to Monaco CompletionItemKind
const mapCompletionKind = (lspKind: number, monaco: any) => {
  const kinds = monaco.languages.CompletionItemKind;
  switch (lspKind) {
    case 1: return kinds.Text;
    case 2: return kinds.Method;
    case 3: return kinds.Function;
    case 4: return kinds.Constructor;
    case 5: return kinds.Field;
    case 6: return kinds.Variable;
    case 7: return kinds.Class;
    case 8: return kinds.Interface;
    case 9: return kinds.Module;
    case 10: return kinds.Property;
    case 11: return kinds.Unit;
    case 12: return kinds.Value;
    case 13: return kinds.Enum;
    case 14: return kinds.Keyword;
    case 15: return kinds.Snippet;
    case 16: return kinds.Color;
    case 17: return kinds.File;
    case 18: return kinds.Reference;
    case 19: return kinds.Folder;
    case 20: return kinds.EnumMember;
    case 21: return kinds.Constant;
    case 22: return kinds.Struct;
    case 23: return kinds.Event;
    case 24: return kinds.Operator;
    case 25: return kinds.TypeParameter;
    default: return kinds.Variable;
  }
};

// Map LSP DiagnosticSeverity to Monaco MarkerSeverity
const mapLspSeverity = (severity: number, monaco: any) => {
  switch (severity) {
    case 1: return monaco.MarkerSeverity.Error;
    case 2: return monaco.MarkerSeverity.Warning;
    case 3: return monaco.MarkerSeverity.Info;
    case 4: return monaco.MarkerSeverity.Hint;
    default: return monaco.MarkerSeverity.Error;
  }
};

// Convert LSP Hover content to Monaco IMarkdownString
const parseHoverContent = (content: any) => {
  if (typeof content === 'string') {
    return { value: content };
  }
  if (content && typeof content === 'object') {
    if (content.kind === 'markdown' || content.kind === 'plaintext') {
      return { value: content.value };
    }
    if (content.language && content.value) {
      return { value: '```' + content.language + '\n' + content.value + '\n```' };
    }
  }
  return { value: '' };
};

const CP_BUILTINS = [
  {
    label: "__builtin_popcount",
    kind: 3,
    insertText: "__builtin_popcount(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_popcount(unsigned int x)",
    documentation: "Returns the number of 1-bits in x (binary representation)."
  },
  {
    label: "__builtin_popcountll",
    kind: 3,
    insertText: "__builtin_popcountll(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_popcountll(unsigned long long x)",
    documentation: "Returns the number of 1-bits in x (binary representation) for 64-bit integer."
  },
  {
    label: "__builtin_clz",
    kind: 3,
    insertText: "__builtin_clz(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_clz(unsigned int x)",
    documentation: "Returns the number of leading 0-bits in x, starting at the most significant bit position. Undefined if x is 0."
  },
  {
    label: "__builtin_clzll",
    kind: 3,
    insertText: "__builtin_clzll(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_clzll(unsigned long long x)",
    documentation: "Returns the number of leading 0-bits in x, starting at the most significant bit position for 64-bit integer. Undefined if x is 0."
  },
  {
    label: "__builtin_ctz",
    kind: 3,
    insertText: "__builtin_ctz(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_ctz(unsigned int x)",
    documentation: "Returns the number of trailing 0-bits in x, starting at the least significant bit position. Undefined if x is 0."
  },
  {
    label: "__builtin_ctzll",
    kind: 3,
    insertText: "__builtin_ctzll(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_ctzll(unsigned long long x)",
    documentation: "Returns the number of trailing 0-bits in x, starting at the least significant bit position for 64-bit integer. Undefined if x is 0."
  },
  {
    label: "__builtin_parity",
    kind: 3,
    insertText: "__builtin_parity(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_parity(unsigned int x)",
    documentation: "Returns the parity of x, i.e. the number of 1-bits in x modulo 2."
  },
  {
    label: "__builtin_parityll",
    kind: 3,
    insertText: "__builtin_parityll(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_parityll(unsigned long long x)",
    documentation: "Returns the parity of x modulo 2 for 64-bit integer."
  },
  {
    label: "__builtin_ffs",
    kind: 3,
    insertText: "__builtin_ffs(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_ffs(int x)",
    documentation: "Returns 1 + the index of the least significant 1-bit of x, or 0 if x is zero."
  },
  {
    label: "__builtin_ffsll",
    kind: 3,
    insertText: "__builtin_ffsll(${1:x})",
    insertTextFormat: 2,
    detail: "int __builtin_ffsll(long long x)",
    documentation: "Returns 1 + the index of the least significant 1-bit of x for 64-bit integer, or 0 if x is zero."
  },
  {
    label: "__gcd",
    kind: 3,
    insertText: "__gcd(${1:x}, ${2:y})",
    insertTextFormat: 2,
    detail: "template<typename _EuclideanRingElement> _EuclideanRingElement __gcd(_EuclideanRingElement __m, _EuclideanRingElement __n)",
    documentation: "Returns the greatest common divisor of two values (part of std library extensions)."
  },
  {
    label: "__lg",
    kind: 3,
    insertText: "__lg(${1:x})",
    insertTextFormat: 2,
    detail: "int __lg(int x) / long long __lg(long long x)",
    documentation: "Returns the floor of the binary logarithm of x (equivalent to 31 - __builtin_clz(x))."
  }
];

// Parse LSP completions response to Monaco suggestions
const parseLspCompletions = (res: any, monaco: any, defaultRange: any, position: any, lang: string) => {
  if (!res) return [];
  const items = Array.isArray(res) ? res : (res.items || []);

  // Filter out internal compiler/library clutter for C++ (competitive programming)
  let filteredItems = items;
  if (lang === 'cpp') {
    filteredItems = items.filter((item: any) => {
      const label = item.label || '';
      const trimmed = typeof label === 'string' ? label.trim() : '';
      
      // Keep popular competitive programming extensions starting with double underscores
      if (trimmed.startsWith('__gcd') || trimmed.startsWith('__builtin_') || trimmed.startsWith('__lg')) {
        return true;
      }
      
      // Filter out other double underscore symbols (like __val, __x, etc.)
      if (trimmed.startsWith('__')) {
        return false;
      }
      
      // Filter out symbols starting with an underscore followed by an uppercase letter (e.g., _M_..., _S_..., _Tp)
      if (trimmed.startsWith('_') && trimmed.length > 1 && trimmed[1] === trimmed[1].toUpperCase()) {
        return false;
      }
      
      return true;
    });

    // Manually append C++ CP builtins
    filteredItems = [
      ...filteredItems,
      ...CP_BUILTINS
    ];
  }

  return filteredItems.map((item: any) => {
    let range = defaultRange;
    if (item.textEdit && item.textEdit.range) {
      const r = item.textEdit.range;
      const startCol = r.start.character + 1;
      const endCol = r.end.character + 1;
      const cursorCol = position.column;
      
      // Use the LSP textEdit range if it's on the same line and contains/is adjacent to the cursor
      if (r.start.line + 1 === position.lineNumber &&
          startCol <= cursorCol &&
          endCol >= cursorCol - 1) {
        range = {
          startLineNumber: r.start.line + 1,
          startColumn: startCol,
          endLineNumber: r.end.line + 1,
          endColumn: endCol
        };
      }
    }
    
    let insertText = item.insertText || item.label;
    if (item.textEdit && item.textEdit.newText) {
      insertText = item.textEdit.newText;
    }

    let documentation = item.documentation;
    if (documentation && typeof documentation === 'object') {
      documentation = {
        value: documentation.value,
        isTrusted: true
      };
    } else if (typeof documentation === 'string') {
      documentation = {
        value: documentation,
        isTrusted: true
      };
    }

    const label = typeof item.label === 'string' ? item.label.trim() : item.label;

    return {
      label: label,
      kind: mapCompletionKind(item.kind || 6, monaco),
      insertText: insertText,
      detail: item.detail || '',
      documentation: documentation,
      range: {
        insert: range,
        replace: range
      },
      insertTextRules: item.insertTextFormat === 2 ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
      sortText: item.sortText,
      filterText: item.filterText
    };
  });
};

// Parse LSP Definition to Monaco definition format
const parseLspDefinition = (res: any, monaco: any) => {
  if (!res) return null;
  
  const mapLocation = (loc: any) => {
    const uri = loc.uri || loc.targetUri;
    const range = loc.range || loc.targetSelectionRange || loc.targetRange;
    if (!uri || !range) return null;
    
    return {
      uri: monaco.Uri.parse(uri),
      range: {
        startLineNumber: range.start.line + 1,
        startColumn: range.start.character + 1,
        endLineNumber: range.end.line + 1,
        endColumn: range.end.character + 1
      }
    };
  };

  if (Array.isArray(res)) {
    return res.map(mapLocation).filter(Boolean) as any;
  }
  
  return mapLocation(res);
};

// Normalize file URI to local Windows/Linux path
const uriToPath = (uri: string) => {
  if (!uri.startsWith('file://')) return uri;
  let clean = uri;
  if (uri.startsWith('file:///')) {
    clean = uri.slice(8);
  } else if (uri.startsWith('file://')) {
    clean = uri.slice(7);
  }
  return clean.replace(/\//g, '\\');
};

export function MonacoEditor() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const activeFile = useProjectStore((s) => s.activeFile);
  const setActiveFileContent = useProjectStore((s) => s.setActiveFileContent);
  const setFileDirty = useProjectStore((s) => s.setFileDirty);
  const setFileContent = useProjectStore((s) => s.setFileContent);
  
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const providersRef = useRef<any[]>([]);
  const activeFileRef = useRef<string | null>(null);
  const lspChangeTimeoutRef = useRef<any>(null);

  const settings = useSettingsStore((state) => state.settings);
  const fontSize = settings?.font?.size ?? 14;
  const fontFamily = settings?.font?.editor ?? 'Consolas, "Cascadia Code", "Courier New", monospace';

  const getLanguage = (fileName: string | null) => {
    if (!fileName) return 'cpp';
    if (fileName.endsWith('.py')) return 'python';
    return 'cpp';
  };

  const getLspLang = (fileName: string | null) => {
    return getLanguage(fileName) === 'python' ? 'python' : 'cpp';
  };

  // Sync activeFile to a mutable ref to avoid stale closures in global Monaco providers
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  // Debounced didChange sender
  const triggerLspDidChange = (filePath: string, content: string, language: string) => {
    if (lspChangeTimeoutRef.current) {
      clearTimeout(lspChangeTimeoutRef.current);
    }
    lspChangeTimeoutRef.current = setTimeout(async () => {
      try {
        await invoke('lsp_did_change', { language, filePath, content });
      } catch (err) {
        console.warn('Failed to send LSP didChange:', err);
      }
    }, 150);
  };

  const flushLspDidChange = async (filePath: string, content: string, language: string) => {
    if (lspChangeTimeoutRef.current) {
      clearTimeout(lspChangeTimeoutRef.current);
      lspChangeTimeoutRef.current = null;
    }
    try {
      await invoke('lsp_did_change', { language, filePath, content });
    } catch (err) {
      console.warn('Failed to flush LSP didChange:', err);
    }
  };

  // 1. Listen for diagnostics notifications from Tauri backend
  useEffect(() => {
    const unlistenPromise = listen<any>('lsp://diagnostics', (event) => {
      const payload = event.payload;
      const { language, uri, diagnostics } = payload;
      
      const filePath = uriToPath(uri);
      const monaco = monacoRef.current;
      
      if (monaco) {
        const models = monaco.editor.getModels();
        const targetModel = models.find((m: any) => {
          const mPath = m.uri.path;
          return mPath.endsWith(filePath.replace(/\\/g, '/')) || filePath.replace(/\\/g, '/').endsWith(mPath);
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
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // 2. Load file content and send lsp_did_open
  useEffect(() => {
    let active = true;

    const loadFile = async () => {
      if (!rootPath || !activeFile) {
        setActiveFileContent('');
        return;
      }

      const lang = getLspLang(activeFile);
      const cached = useProjectStore.getState().fileContents[activeFile];

      if (cached !== undefined) {
        if (active) {
          setActiveFileContent(cached);
          
          // Send didOpen to LSP
          try {
            await invoke('lsp_did_open', { language: lang, filePath: activeFile, content: cached });
          } catch (e) {
            console.warn('LSP initialization or didOpen failed (probably server starting up):', e);
          }
        }
        return;
      }

      try {
        let text = await readTextFile(activeFile, rootPath);
        if (active) {
          let isAutoInserted = false;
          if (text.trim() === '') {
            const lang = getLspLang(activeFile);
            const defaultSnippet = useSnippetStore.getState().snippets.find(
              (s) => s.language === lang && s.is_default === 1
            );
            if (defaultSnippet) {
              text = defaultSnippet.code;
              isAutoInserted = true;
            }
          }

          setFileContent(activeFile, text);
          setActiveFileContent(text);
          
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              model.setValue(text);
            }
          }

          if (isAutoInserted) {
            useProjectStore.getState().setFileDirty(activeFile, true);
          }
          
          // Send didOpen to LSP
          try {
            await invoke('lsp_did_open', { language: lang, filePath: activeFile, content: text });
          } catch (e) {
            console.warn('LSP didOpen failed:', e);
          }
        }
      } catch (err) {
        console.error('Failed to read source file:', err);
      }
    };

    loadFile();

    return () => {
      active = false;
    };
  }, [activeFile, rootPath, setActiveFileContent, setFileContent]);

  // Clean up registered Monaco providers on unmount
  const disposeProviders = () => {
    providersRef.current.forEach((p: any) => p.dispose());
    providersRef.current = [];
  };

  useEffect(() => {
    return () => {
      disposeProviders();
    };
  }, []);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
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

    // Register global LSP providers in Monaco
    disposeProviders();

    const langs = ['cpp', 'python'];
    langs.forEach((lang) => {
      // 1. Completion Provider
      const completionProvider = monaco.languages.registerCompletionItemProvider(lang, {
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

          let lspSuggestions: any[] = [];
          try {
            await flushLspDidChange(file, _model.getValue(), lang);

            const res: any = await invoke('lsp_get_completions', {
              language: lang,
              filePath: file,
              line: position.lineNumber - 1,
              character: position.column - 1
            });
            
            lspSuggestions = parseLspCompletions(res, monaco, defaultRange, position, lang);
          } catch (err) {
            console.warn(`LSP completion failed for ${lang}:`, err);
          }

          // Fetch custom snippets from the Zustand store
          const snippets = useSnippetStore.getState().snippets || [];
          const customSnippets = snippets.filter(
            (s) => s.language.toLowerCase() === lang.toLowerCase()
          );

          const snippetCompletions = customSnippets.map((snippet) => ({
            label: snippet.trigger,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.code,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: snippet.description,
            documentation: {
              value: snippet.code,
              isTrusted: true
            },
            range: { insert: defaultRange, replace: defaultRange }
          }));

          return { suggestions: [...lspSuggestions, ...snippetCompletions] };
        }
      });
      providersRef.current.push(completionProvider);

      // 2. Hover Provider
      const hoverProvider = monaco.languages.registerHoverProvider(lang, {
        provideHover: async (_model: any, position: any) => {
          const file = activeFileRef.current;
          if (!file || getLspLang(file) !== lang) return null;
          try {
            await flushLspDidChange(file, _model.getValue(), lang);

            const res: any = await invoke('lsp_get_hover', {
              language: lang,
              filePath: file,
              line: position.lineNumber - 1,
              character: position.column - 1
            });
            if (!res || !res.contents) return null;
            
            let contents: any[] = [];
            const rawContents = res.contents;
            if (Array.isArray(rawContents)) {
              contents = rawContents.map(c => parseHoverContent(c));
            } else {
              contents = [parseHoverContent(rawContents)];
            }
            return { contents };
          } catch (err) {
            console.warn(`LSP hover failed for ${lang}:`, err);
            return null;
          }
        }
      });
      providersRef.current.push(hoverProvider);

      // 3. Definition Provider
      const definitionProvider = monaco.languages.registerDefinitionProvider(lang, {
        provideDefinition: async (_model: any, position: any) => {
          const file = activeFileRef.current;
          if (!file || getLspLang(file) !== lang) return null;
          try {
            await flushLspDidChange(file, _model.getValue(), lang);

            const res: any = await invoke('lsp_get_definition', {
              language: lang,
              filePath: file,
              line: position.lineNumber - 1,
              character: position.column - 1
            });
            return parseLspDefinition(res, monaco);
          } catch (err) {
            console.warn(`LSP definition failed for ${lang}:`, err);
            return null;
          }
        }
      });
      providersRef.current.push(definitionProvider);
    });
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
          path={activeFile}
          height="100%"
          language={getLanguage(activeFile)}
          theme="vscode-dark"
          onChange={(val) => {
            const currentContent = useProjectStore.getState().activeFileContent;
            if (val !== currentContent) {
              setActiveFileContent(val || '');
              if (activeFile) {
                setFileDirty(activeFile, true);
                const lang = getLspLang(activeFile);
                triggerLspDidChange(activeFile, val || '', lang);
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
