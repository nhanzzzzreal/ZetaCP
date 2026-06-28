// src/components/Overlay/OverlayPlusMenu.tsx

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  FileText, 
  Image, 
  FileCode2,
  FileEdit,
  PenTool
} from 'lucide-react';
import { useOverlayStore, Overlay } from '../../stores/useOverlayStore';

export const OverlayPlusMenu: React.FC = () => {
  const { addOverlay } = useOverlayStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (type: Overlay['type']) => {
    addOverlay(type);
    setIsOpen(false);
  };

  const menuItems = [
    {
      type: 'scratchpad' as const,
      label: 'Sketchpad',
      desc: 'Sketch geometry & freehand vectors',
      icon: <PenTool className="w-4 h-4 text-neutral-400/80" strokeWidth={1.5} />,
    },
    {
      type: 'notes' as const,
      label: 'Text Notes',
      desc: 'Text editor with CodeMirror 6',
      icon: <FileEdit className="w-4 h-4 text-neutral-400/80" strokeWidth={1.5} />,
    },
    {
      type: 'md' as const,
      label: 'Markdown Viewer',
      desc: 'Read local Markdown (.md) files',
      icon: <FileText className="w-4 h-4 text-neutral-400/80" strokeWidth={1.5} />,
    },
    {
      type: 'image' as const,
      label: 'Image Viewer',
      desc: 'View images (.png, .jpg, .gif)',
      icon: <Image className="w-4 h-4 text-neutral-400/80" strokeWidth={1.5} />,
    },
    {
      type: 'pdf' as const,
      label: 'PDF Viewer',
      desc: 'Read problem statement PDF (.pdf)',
      icon: <FileCode2 className="w-4 h-4 text-neutral-400/80" strokeWidth={1.5} />,
    },
    {
      type: 'word' as const,
      label: 'Word Document',
      desc: 'Open problem statement Word file (.docx, .doc)',
      icon: <FileText className="w-4 h-4 text-neutral-400/80" strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="relative flex items-center" ref={menuRef}>
      {/* Dropdown Menu (Opens upwards) */}
      {isOpen && (
        <div 
          className="absolute bottom-full right-0 mb-1.5 w-64 bg-[#2a2a2a] border border-[var(--zcp-border)] rounded shadow-2xl py-1.5 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-150 font-mono"
          style={{ transformOrigin: 'bottom right' }}
        >
          <div className="px-3 py-1.5 border-b border-neutral-800 mb-1">
            <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
              Add Overlay Window
            </span>
          </div>

          <div className="flex flex-col">
            {menuItems.map((item) => (
              <button
                key={item.type}
                onClick={() => handleSelect(item.type)}
                className="w-full px-3 py-2 flex items-start gap-3 hover:bg-[#333333] transition-colors text-left group"
              >
                <div className="mt-0.5 p-1 bg-[#202020] rounded group-hover:bg-[#1a1a1a] transition-colors">
                  {item.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-neutral-500 truncate">
                    {item.desc}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Titlebar Plus Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="h-[18px] px-2 flex items-center gap-1 bg-white/10 hover:bg-white/15 active:scale-[0.97] border border-white/10 hover:border-white/20 text-white/90 hover:text-white transition-all duration-150 select-none rounded-[var(--zcp-radius-sm)] font-sans text-[9px] font-bold uppercase tracking-wider cursor-pointer focus-visible-outline" 
        title="Add helper tool (Overlay)"
      >
        <Plus className="w-2.5 h-2.5 text-white shrink-0" strokeWidth={2.5} />
        <span>Add Overlay</span>
      </button>
    </div>
  );
};
