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

type KnownFileType = 'image' | 'pdf' | 'md' | 'word';
type OverlayFileType = KnownFileType | 'fileviewer';

interface LocalFileViewerProps {
  id: string;
  type: OverlayFileType;
  filePath: string;
}

// --- Content encoding for 'fileviewer' type ---
// Format: "<detectedType>:<absolutePath>"  e.g. "pdf:/home/user/prob.pdf"
// Falls back to plain path for legacy types (image/pdf/md/word).

const CONTENT_PREFIX_SEPARATOR = ':';

const encodeFileviewerContent = (detectedType: KnownFileType, path: string): string =>
  `${detectedType}${CONTENT_PREFIX_SEPARATOR}${path}`;

const decodeFileviewerContent = (content: string): { detectedType: KnownFileType | null; path: string } => {
  const knownTypes: KnownFileType[] = ['image', 'pdf', 'md', 'word'];
  const separatorIdx = content.indexOf(CONTENT_PREFIX_SEPARATOR);
  if (separatorIdx > 0) {
    const prefix = content.slice(0, separatorIdx) as KnownFileType;
    if (knownTypes.includes(prefix)) {
      return { detectedType: prefix, path: content.slice(separatorIdx + 1) };
    }
  }
  return { detectedType: null, path: content };
};

const detectTypeFromExtension = (filePath: string): KnownFileType | null => {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md') return 'md';
  if (['docx', 'doc'].includes(ext)) return 'word';
  return null;
};

const getExtensionsForType = (type: OverlayFileType): string[] => {
  if (type === 'image') return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  if (type === 'pdf') return ['pdf'];
  if (type === 'md') return ['md'];
  if (type === 'word') return ['docx', 'doc'];
  if (type === 'fileviewer') return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf', 'md', 'docx', 'doc'];
  return [];
};

// --- Helper loaders ---

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
      ignoreHeight: true,
    });
  } catch (e) {
    console.error('Error rendering docx:', e);
    container.innerHTML = `<div class="p-4 text-xs text-red-400">Cannot render this Word document. The file might be corrupted or unsupported.</div>`;
  }
};

// --- Sub-renderers ---

const ImageRenderer: React.FC<{ id: string; assetUrl: string }> = ({ id, assetUrl }) => (
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

const PdfRenderer: React.FC<{ assetUrl: string }> = ({ assetUrl }) => (
  <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden relative">
    <div className="flex-1 min-h-0 bg-[#2a2a2a]">
      <iframe src={assetUrl} className="w-full h-full border-none" title="PDF Local Reader" />
    </div>
  </div>
);

const MdRenderer: React.FC<{ id: string; mdContent: string }> = ({ id, mdContent }) => (
  <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden relative">
    <ZoomPanContainer id={id} enableTextSelect={true}>
      <div className="max-w-3xl mx-auto text-left select-text">
        <MarkdownViewer content={mdContent} />
      </div>
    </ZoomPanContainer>
  </div>
);

const WordRenderer: React.FC<{ id: string; containerRef: React.RefObject<HTMLDivElement> }> = ({ id, containerRef }) => (
  <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden relative">
    <ZoomPanContainer id={id} enableTextSelect={true}>
      <div
        ref={containerRef}
        className="p-6 bg-white text-black font-sans select-text min-h-full [&_.docx-preview]:mx-auto [&_.docx-preview]:max-w-3xl [&_.docx-preview]:bg-white [&_.docx-preview_table]:border-collapse [&_.docx-preview_table]:border [&_.docx-preview_table_td]:border [&_.docx-preview_table_td]:p-1"
      />
    </ZoomPanContainer>
  </div>
);

// --- Empty picker (for 'fileviewer' before a file is chosen) ---

const FilePickerEmpty: React.FC<{ onSelect: () => void }> = ({ onSelect }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#2a2a2a] text-center select-none gap-3">
    <span className="codicon codicon-file text-[48px] text-neutral-600" />
    <div>
      <h3 className="text-sm font-bold text-neutral-200 mb-1">No file selected</h3>
      <p className="text-[11px] text-neutral-500 max-w-[220px] leading-relaxed">
        Supports PNG, JPG, GIF, WebP, PDF, Markdown, DOCX
      </p>
    </div>
    <button
      onClick={onSelect}
      className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded text-white transition-colors"
    >
      <FolderOpen className="w-3.5 h-3.5" />
      Select File
    </button>
  </div>
);

// --- Error state ---

const FileNotFound: React.FC<{ filePath: string; onSelect: () => void }> = ({ filePath, onSelect }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#2a2a2a] text-center select-none">
    <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" strokeWidth={1.5} />
    <h3 className="text-sm font-bold text-neutral-200 mb-1">File not found</h3>
    <p className="text-xs text-neutral-500 max-w-xs mb-4 font-mono leading-relaxed truncate">
      {filePath}
    </p>
    <button
      onClick={onSelect}
      className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded text-white transition-colors"
    >
      <FolderOpen className="w-3.5 h-3.5" />
      Select Another File
    </button>
  </div>
);

// --- Main component ---

export const LocalFileViewer: React.FC<LocalFileViewerProps> = ({ id, type, filePath: rawFilePath }) => {
  const updateOverlay = useOverlayStore((state) => state.updateOverlay);

  // For 'fileviewer', decode the detected type + real path from encoded content
  const { detectedType, path: resolvedPath } = type === 'fileviewer'
    ? decodeFileviewerContent(rawFilePath)
    : { detectedType: type as KnownFileType, path: rawFilePath };

  const effectiveType: KnownFileType | null = detectedType;

  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [mdContent, setMdContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resolvedPath || !effectiveType) {
      setFileExists(false);
      return;
    }
    let cancelled = false;
    const verify = async () => {
      try {
        setLoading(true);
        const ok = await exists(resolvedPath);
        if (cancelled) return;
        setFileExists(ok);
        if (ok && effectiveType === 'md') {
          await loadMdContent(resolvedPath, setMdContent);
        } else if (ok && effectiveType === 'word') {
          setTimeout(() => renderWordContent(resolvedPath, docxContainerRef.current), 100);
        }
      } catch (err) {
        console.error('Error checking file:', err);
        if (!cancelled) setFileExists(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    verify();
    return () => { cancelled = true; };
  }, [resolvedPath, effectiveType]);

  const handleSelectFile = async () => {
    try {
      const extensions = getExtensionsForType(type);
      const selected = await openDialog({
        multiple: false,
        title: 'Select File',
        filters: extensions.length > 0 ? [{ name: 'Supported Files', extensions }] : undefined,
      });

      if (typeof selected !== 'string') return;

      const fileName = selected.split(/[/\\]/).pop() || 'File';
      if (type === 'fileviewer') {
        const detected = detectTypeFromExtension(selected);
        if (!detected) return;
        const encoded = encodeFileviewerContent(detected, selected);
        updateOverlay(id, { content: encoded, title: fileName });
      } else {
        updateOverlay(id, { content: selected, title: fileName });
      }
    } catch (err) {
      console.error('Error selecting file:', err);
    }
  };

  // 'fileviewer' but no file chosen yet
  if (type === 'fileviewer' && !resolvedPath) {
    return <FilePickerEmpty onSelect={handleSelectFile} />;
  }

  if (loading || fileExists === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 bg-[#2a2a2a]">
        Loading file data...
      </div>
    );
  }

  if (!fileExists) {
    return <FileNotFound filePath={resolvedPath} onSelect={handleSelectFile} />;
  }

  const assetUrl = convertFileSrc(resolvedPath);

  if (effectiveType === 'image') return <ImageRenderer id={id} assetUrl={assetUrl} />;
  if (effectiveType === 'pdf') return <PdfRenderer assetUrl={assetUrl} />;
  if (effectiveType === 'md') return <MdRenderer id={id} mdContent={mdContent} />;
  if (effectiveType === 'word') return <WordRenderer id={id} containerRef={docxContainerRef} />;

  return null;
};
