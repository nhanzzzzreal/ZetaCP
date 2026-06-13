// src/components/StatusBar/StatusBar.tsx

import React from 'react';
import { useProjectStore } from '../../stores/useProjectStore';

export const StatusBar: React.FC = () => {
  const activeFile = useProjectStore((s) => s.activeFile);
  const cursorPos = useProjectStore((s) => s.cursorPos);
  const branchName = 'main';

  // Simple language mapping based on file extension
  const getLanguageLabel = (file: string | null) => {
    if (!file) return 'Plain Text';
    const ext = file.split('.').pop()?.toLowerCase();
    if (ext === 'cpp' || ext === 'cc' || ext === 'h') return 'C++';
    if (ext === 'py') return 'Python';
    if (ext === 'txt') return 'Plain Text';
    if (ext === 'md') return 'Markdown';
    return ext ? ext.toUpperCase() : 'Plain Text';
  };

  return (
    <div className="h-[var(--zcp-statusbar-height)] bg-[var(--zcp-bg-statusbar)] text-[var(--zcp-text-active)] flex justify-between items-center px-3 select-none text-[12px] shrink-0 font-sans z-50">
      {/* Left side: Git branch & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
          <span className="codicon codicon-source-control text-[13px] flex items-center" />
          <span>{branchName}</span>
        </div>
        <div className="flex items-center gap-1 hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
          <span className="codicon codicon-sync text-[12px] flex items-center" />
        </div>
      </div>

      {/* Right side: cursor pos, spaces, encoding, language */}
      <div className="flex items-center gap-3">
        {activeFile && (
          <>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
            </div>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>Spaces: 4</span>
            </div>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>UTF-8</span>
            </div>
            <div className="hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
              <span>{getLanguageLabel(activeFile)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-center hover:bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer">
          <span className="codicon codicon-bell text-[12px] flex items-center" />
        </div>
      </div>
    </div>
  );
};
