// src/components/Overlay/widgets/Scratchpad.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useOverlayStore } from '../../../stores/useOverlayStore';

interface ScratchpadProps {
  id: string;
  initialContent: string;
}

export const Scratchpad: React.FC<ScratchpadProps> = ({ id, initialContent }) => {
  const updateOverlay = useOverlayStore((state) => state.updateOverlay);
  const [text, setText] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const [lineCount, setLineCount] = useState(1);

  // Calculate lines and update store with debounce/blur
  useEffect(() => {
    const lines = text.split('\n').length;
    setLineCount(Math.max(lines, 1));
  }, [text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    updateOverlay(id, { content: val });
  };

  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
    const lines = textBeforeCursor.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    setCursorPos({ line, column });
  };

  // Generate line numbers column
  const lineNumbers = Array.from({ length: lineCount }, (_, idx) => idx + 1);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs overflow-hidden">
      {/* Editor Body */}
      <div className="flex-1 flex min-h-0 relative select-text">
        {/* Line Numbers gutter */}
        <div className="w-9 bg-[#1e1e1e] border-r border-[#2d2d2d] py-2 text-right pr-2 select-none text-neutral-600 shrink-0 overflow-hidden">
          {lineNumbers.map((num) => (
            <div key={num} className="h-[18px] leading-[18px]">
              {num}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onSelect={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onMouseUp={handleSelectionChange}
          className="flex-1 bg-[#1e1e1e] text-[#d4d4d4] p-2 border-0 outline-none resize-none overflow-y-auto leading-[18px] whitespace-pre placeholder-neutral-600 focus:ring-0 select-text selection:bg-[#264f78]"
          placeholder="// Start drafting here..."
          spellCheck={false}
          style={{
            fontFamily: 'Consolas, "Courier New", monospace',
          }}
        />
      </div>

      {/* Editor Footer / Status bar */}
      <div className="h-6 bg-[#007acc] text-white px-3 flex items-center justify-between select-none text-[10px] font-sans font-medium shrink-0">
        <div className="flex items-center gap-3">
          <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
          <span>{text.length} chars</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider">Scratchpad</span>
          <span className="bg-[#ffffff20] px-1 py-0.5 rounded text-[9px]">UTF-8</span>
        </div>
      </div>
    </div>
  );
};
