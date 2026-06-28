import React from 'react';

const parseMatch = (matchedStr: string, key: number): React.ReactNode => {
  if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
    return (
      <strong key={key} className="font-bold text-indigo-300">
        {matchedStr.slice(2, -2)}
      </strong>
    );
  }
  if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
    return (
      <code key={key} className="bg-[#2d2d2d] text-amber-400 px-1 py-0.5 rounded font-mono text-[10px] border border-neutral-700">
        {matchedStr.slice(1, -1)}
      </code>
    );
  }
  return matchedStr;
};

function renderInlineMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  let currentText = text;
  const regex = /(\*\*.*?\*\*|`.*?`)/;
  let match = currentText.match(regex);
  let key = 0;

  while (match) {
    const matchedStr = match[0];
    const index = match.index || 0;
    if (index > 0) {
      parts.push(currentText.substring(0, index));
    }
    parts.push(parseMatch(matchedStr, key++));
    currentText = currentText.substring(index + matchedStr.length);
    match = currentText.match(regex);
  }

  if (currentText) {
    parts.push(currentText);
  }

  return parts.length > 0 ? parts : text;
}

const renderMarkdownLine = (line: string, idx: number): React.ReactNode => {
  if (line.startsWith('# ')) {
    return (
      <h1 key={idx} className="text-sm font-bold border-b border-[#2d2d2d] pb-1.5 mt-3 mb-2 text-indigo-400 font-sans">
        {line.substring(2)}
      </h1>
    );
  }
  if (line.startsWith('## ')) {
    return (
      <h2 key={idx} className="text-xs font-semibold mt-3 mb-1 text-cyan-400 font-sans">
        {line.substring(3)}
      </h2>
    );
  }
  if (line.startsWith('### ')) {
    return (
      <h3 key={idx} className="text-[11px] font-semibold mt-2.5 mb-1 text-neutral-200 font-sans">
        {line.substring(4)}
      </h3>
    );
  }
  if (line.startsWith('* ') || line.startsWith('- ')) {
    return (
      <li key={idx} className="ml-3.5 list-disc my-0.5 leading-relaxed text-neutral-300 font-sans text-xs">
        {renderInlineMarkdown(line.substring(2))}
      </li>
    );
  }
  if (line.trim() === '---') {
    return <hr key={idx} className="border-[#2d2d2d] my-3" />;
  }
  if (line.trim() === '') {
    return <div key={idx} className="h-1.5" />;
  }
  return (
    <p key={idx} className="my-1 leading-relaxed text-neutral-300 font-sans text-xs whitespace-pre-wrap select-text">
      {renderInlineMarkdown(line)}
    </p>
  );
};

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  if (!content) return <div className="text-xs text-neutral-600 italic">Empty document.</div>;
  const lines = content.split('\n');
  return (
    <div className="space-y-0.5 select-text">
      {lines.map((line, idx) => renderMarkdownLine(line, idx))}
    </div>
  );
};
