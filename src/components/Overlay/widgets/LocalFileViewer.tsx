// src/components/Overlay/widgets/LocalFileViewer.tsx

import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, FolderOpen } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists, readFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { renderAsync as renderDocx } from 'docx-preview';
import { useOverlayStore } from '../../../stores/useOverlayStore';
import { useProjectStore } from '../../../stores/useProjectStore';
import { readTextFile } from '../../../lib/tauri-bridge';
import { MarkdownViewer } from './MarkdownViewer';
import { ZoomPanContainer } from './ZoomPanContainer';

interface LocalFileViewerProps {
  id: string;
  type: 'image' | 'pdf' | 'md' | 'word';
  filePath: string;
}

const loadMdContent = async (filePath: string, setMdContent: (content: string) => void) => {
  const rootPath = useProjectStore.getState().rootPath || '';
  const content = await readTextFile(filePath, rootPath);
  setMdContent(content);
};

const renderWordContent = async (filePath: string, container: HTMLDivElement | null) => {
  if (!container) return;
  try {
    const fileData = await readFile(filePath);
    container.innerHTML = '';
    await renderDocx(fileData, container, undefined, {
      className: 'docx-preview',
      inWrapper: false,
      ignoreWidth: true,
      ignoreHeight: true
    });
  } catch (e) {
    console.error('Error rendering docx:', e);
    container.innerHTML = `<div class="p-4 text-xs text-red-400">Cannot render this Word document. The file might be corrupted or unsupported.</div>`;
  }
};

const getExtensionsForType = (type: string): string[] => {
  if (type === 'image') return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  if (type === 'pdf') return ['pdf'];
  if (type === 'md') return ['md'];
  if (type === 'word') return ['docx', 'doc'];
  return [];
};

export const LocalFileViewer: React.FC<LocalFileViewerProps> = ({ id, type, filePath }) => {
  const updateOverlay = useOverlayStore((state) => state.updateOverlay);
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [mdContent, setMdContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function verifyFile() {
      if (!filePath) {
        setFileExists(false);
        return;
      }
      try {
        setLoading(true);
        const fileExist = await exists(filePath);
        setFileExists(fileExist);
        if (fileExist) {
          if (type === 'md') {
            await loadMdContent(filePath, setMdContent);
          } else if (type === 'word') {
            setTimeout(() => renderWordContent(filePath, docxContainerRef.current), 100);
          }
        }
      } catch (err) {
        console.error('Error checking file:', err);
        setFileExists(false);
      } finally {
        setLoading(false);
      }
    }
    verifyFile();
  }, [filePath, type]);

  const handleSelectFile = async () => {
    try {
      const extensions = getExtensionsForType(type);
      const selected = await openDialog({
        multiple: false,
        title: `Select ${type.toUpperCase()} File`,
        filters: extensions.length > 0 ? [{ name: type.toUpperCase(), extensions }] : undefined
      });

      if (typeof selected === 'string') {
        const fileName = selected.split(/[\\/]/).pop() || `${type.toUpperCase()} File`;
        updateOverlay(id, { content: selected, title: fileName });
      }
    } catch (err) {
      console.error('Error selecting file:', err);
    }
  };

  if (loading || fileExists === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 bg-[#2a2a2a]">
        Loading file data...
      </div>
    );
  }

  if (!fileExists) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#2a2a2a] text-center select-none">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" strokeWidth={1.5} />
        <h3 className="text-sm font-bold text-neutral-200 mb-1">
          {filePath ? 'File not found' : 'File not configured'}
        </h3>
        <p className="text-xs text-neutral-500 max-w-xs mb-4 font-mono leading-relaxed truncate-3-lines">
          {filePath ? filePath : 'Please select a file to view its content.'}
        </p>
        <button
          onClick={handleSelectFile}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded text-white transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Select File
        </button>
      </div>
    );
  }

  const assetUrl = convertFileSrc(filePath);

  if (type === 'image') {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden relative group">
        <ZoomPanContainer id={id}>
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={assetUrl}
              alt="Local File"
              className="max-w-[95%] max-h-[95%] object-contain rounded border border-[#2b2b2b]/50 shadow-2xl pointer-events-none"
            />
          </div>
        </ZoomPanContainer>
      </div>
    );
  }

  if (type === 'pdf') {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden relative">
        <div className="flex-1 min-h-0 bg-[#2a2a2a]">
          <iframe src={assetUrl} className="w-full h-full border-none" title="PDF Local Reader" />
        </div>
      </div>
    );
  }

  if (type === 'md') {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden relative">
        <ZoomPanContainer id={id} enableTextSelect={true}>
          <div className="max-w-3xl mx-auto text-left select-text">
            <MarkdownViewer content={mdContent} />
          </div>
        </ZoomPanContainer>
      </div>
    );
  }

  if (type === 'word') {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden relative">
        <ZoomPanContainer id={id} enableTextSelect={true}>
          <div 
            ref={docxContainerRef}
            className="p-6 bg-white text-black font-sans select-text min-h-full [&_.docx-preview]:mx-auto [&_.docx-preview]:max-w-3xl [&_.docx-preview]:bg-white [&_.docx-preview_table]:border-collapse [&_.docx-preview_table]:border [&_.docx-preview_table_td]:border [&_.docx-preview_table_td]:p-1"
          />
        </ZoomPanContainer>
      </div>
    );
  }

  return null;
};
