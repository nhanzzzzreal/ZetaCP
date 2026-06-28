// src/components/StressTester/GeneratedCodeModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { notify } from '../../stores/useNotificationStore';

import { generateWorkspaceCode } from './blocks/generatorService';

export interface GeneratedCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeneratedCodeModal: React.FC<GeneratedCodeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'python' | 'cpp'>('python');
  const [pythonCode, setPythonCode] = useState('');
  const [cppCode, setCppCode] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const ws = (window as unknown as { activeBlocklyWorkspace?: any }).activeBlocklyWorkspace;
        if (ws) {
          setPythonCode(generateWorkspaceCode(ws, 'python'));
          setCppCode(generateWorkspaceCode(ws, 'cpp'));
        }
      } catch (e) {
        console.error('Error generating code for modal viewer:', e);
      }
    }
  }, [isOpen]);

  const activeCode = activeTab === 'python' ? pythonCode : cppCode;

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const extensions = [
      lineNumbers(),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      activeTab === 'python' ? python() : cpp(),
      oneDark,
      EditorView.theme(
        {
          '&': { height: '100%', backgroundColor: '#1e1e1e' },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '13px',
            lineHeight: '1.5',
          },
          '.cm-gutters': {
            backgroundColor: '#252526',
            color: '#6b7280',
            borderRight: '1px solid #333',
            minWidth: '40px',
          },
          '.cm-content': { color: '#d1d5db', padding: '8px 4px' },
          '&.cm-focused': { outline: 'none' },
        },
        { dark: true }
      ),
    ];

    const state = EditorState.create({
      doc: activeCode || '',
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isOpen, activeTab, activeCode]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      notify.success('Copied', 'Source code copied to clipboard');
    } catch {
      notify.error('Copy Error', 'Failed to copy source code');
    }
  };

  const handleExportCode = async () => {
    try {
      const isPython = activeTab === 'python';
      const filePath = await save({
        defaultPath: isPython ? 'generator.py' : 'generator.cpp',
        filters: isPython
          ? [{ name: 'Python Source', extensions: ['py'] }]
          : [{ name: 'C++ Source', extensions: ['cpp', 'h'] }],
      });

      if (filePath) {
        await writeTextFile(filePath, activeCode);
        notify.success('Export Successful', `Source code saved to: ${filePath}`);
      }
    } catch (err) {
      notify.fromTauriError('Export Error', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="flex flex-col w-full max-w-4xl h-[80vh] bg-[#1e1e1e] border border-[#454545] rounded-lg shadow-2xl overflow-hidden text-[#d4d4d4] font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#2d2d2d] border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2">
            <span className="codicon codicon-code text-[#007acc] text-base" />
            <h2 className="text-sm font-semibold text-white">Generated Source Code</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#858585] hover:text-white rounded hover:bg-[#3c3c3c] transition-colors cursor-pointer"
            title="Close"
          >
            <span className="codicon codicon-close text-base flex items-center justify-center" />
          </button>
        </div>

        {/* Language Tabs */}
        <div className="flex border-b border-[#3c3c3c] bg-[#252526]">
          <button
            type="button"
            onClick={() => setActiveTab('python')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'python'
                ? 'border-[#007acc] text-white font-semibold bg-[#1e1e1e]'
                : 'border-transparent text-[#858585] hover:text-[#cccccc]'
            }`}
          >
            <span className="codicon codicon-symbol-keyword text-[#3572A5]" />
            Python 3
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cpp')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'cpp'
                ? 'border-[#007acc] text-white font-semibold bg-[#1e1e1e]'
                : 'border-transparent text-[#858585] hover:text-[#cccccc]'
            }`}
          >
            <span className="codicon codicon-symbol-class text-[#f34b7d]" />
            C++ (testlib.h)
          </button>
        </div>

        {/* Editor Body */}
        <div className="flex-1 min-h-0 relative bg-[#1e1e1e] overflow-hidden">
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#252526] border-t border-[#3c3c3c]">
          <span className="text-xs text-[#858585]">
            Source code generated automatically from Blockly Canvas
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 bg-[#3a3d3e] hover:bg-[#4e5254] text-white rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="codicon codicon-copy text-[14px]" />
              Copy
            </button>
            <button
              type="button"
              onClick={handleExportCode}
              className="px-3 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="codicon codicon-export text-[14px]" />
              Export Code
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#3a3d3e] hover:bg-[#4e5254] text-white rounded text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
