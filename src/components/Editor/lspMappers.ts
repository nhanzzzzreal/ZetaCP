// src/components/Editor/lspMappers.ts

export const CP_BUILTINS = [
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

export const mapCompletionKind = (lspKind: number, monaco: any) => {
  const kinds = monaco.languages.CompletionItemKind;
  const kindsArray = [
    null,
    kinds.Text, kinds.Method, kinds.Function, kinds.Constructor,
    kinds.Field, kinds.Variable, kinds.Class, kinds.Interface,
    kinds.Module, kinds.Property, kinds.Unit, kinds.Value,
    kinds.Enum, kinds.Keyword, kinds.Snippet, kinds.Color,
    kinds.File, kinds.Reference, kinds.Folder, kinds.EnumMember,
    kinds.Constant, kinds.Struct, kinds.Event, kinds.Operator,
    kinds.TypeParameter
  ];
  return kindsArray[lspKind] ?? kinds.Variable;
};

export const mapLspSeverity = (severity: number, monaco: any) => {
  switch (severity) {
    case 1: return monaco.MarkerSeverity.Error;
    case 2: return monaco.MarkerSeverity.Warning;
    case 3: return monaco.MarkerSeverity.Info;
    case 4: return monaco.MarkerSeverity.Hint;
    default: return monaco.MarkerSeverity.Error;
  }
};

export const parseHoverContent = (content: any) => {
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

export const uriToPath = (uri: string) => {
  if (!uri.startsWith('file://')) return uri;
  let clean = uri;
  if (uri.startsWith('file:///')) {
    clean = uri.slice(8);
  } else if (uri.startsWith('file://')) {
    clean = uri.slice(7);
  }
  return clean.replace(/\//g, '\\');
};

function filterCppItems(items: any[]) {
  return items.filter((item: any) => {
    const label = item.label || '';
    const trimmed = typeof label === 'string' ? label.trim() : '';
    if (trimmed.startsWith('__gcd') || trimmed.startsWith('__builtin_') || trimmed.startsWith('__lg')) {
      return true;
    }
    if (trimmed.startsWith('__')) {
      return false;
    }
    if (trimmed.startsWith('_') && trimmed.length > 1 && trimmed[1] === trimmed[1].toUpperCase()) {
      return false;
    }
    return true;
  });
}

function getCompletionRange(item: any, defaultRange: any, position: any) {
  if (item.textEdit && item.textEdit.range) {
    const r = item.textEdit.range;
    const startCol = r.start.character + 1;
    const endCol = r.end.character + 1;
    const cursorCol = position.column;
    if (r.start.line + 1 === position.lineNumber &&
        startCol <= cursorCol &&
        endCol >= cursorCol - 1) {
      return {
        startLineNumber: r.start.line + 1,
        startColumn: startCol,
        endLineNumber: r.end.line + 1,
        endColumn: endCol
      };
    }
  }
  return defaultRange;
}

function formatDocumentation(documentation: any) {
  if (documentation && typeof documentation === 'object') {
    return {
      value: documentation.value,
      isTrusted: true
    };
  }
  if (typeof documentation === 'string') {
    return {
      value: documentation,
      isTrusted: true
    };
  }
  return undefined;
}

export function parseLspCompletions(
  res: any,
  monaco: any,
  defaultRange: any,
  position: any,
  lang: string
) {
  if (!res) return [];
  const rawItems = Array.isArray(res) ? res : (res.items || []);
  const items = lang === 'cpp' ? [...filterCppItems(rawItems), ...CP_BUILTINS] : rawItems;

  return items.map((item: any) => {
    const range = getCompletionRange(item, defaultRange, position);
    const insertText = item.textEdit?.newText || item.insertText || item.label;
    const label = typeof item.label === 'string' ? item.label.trim() : item.label;
    const insertRules = item.insertTextFormat === 2 
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
      : undefined;

    return {
      label,
      kind: mapCompletionKind(item.kind || 6, monaco),
      insertText,
      detail: item.detail || '',
      documentation: formatDocumentation(item.documentation),
      range: { insert: range, replace: range },
      insertTextRules: insertRules,
      sortText: item.sortText,
      filterText: item.filterText
    };
  });
}

function mapLspLocation(loc: any, monaco: any) {
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
}

export function parseLspDefinition(res: any, monaco: any) {
  if (!res) return null;
  if (Array.isArray(res)) {
    return res.map((loc) => mapLspLocation(loc, monaco)).filter(Boolean) as any;
  }
  return mapLspLocation(res, monaco);
}

export const getLanguage = (fileName: string | null) => {
  if (!fileName) return 'cpp';
  if (fileName.endsWith('.py')) return 'python';
  return 'cpp';
};

export const getLspLang = (fileName: string | null) => {
  return getLanguage(fileName) === 'python' ? 'python' : 'cpp';
};

