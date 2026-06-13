// src/components/Overlay/widgets/LocalFileViewer.tsx

import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, FolderOpen, ZoomIn, ZoomOut, RotateCcw, MousePointer, Hand } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists, readFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { renderAsync as renderDocx } from 'docx-preview';
import { useOverlayStore } from '../../../stores/useOverlayStore';
import { useProjectStore } from '../../../stores/useProjectStore';
import { readTextFile } from '../../../lib/tauri-bridge';

interface LocalFileViewerProps {
  id: string;
  type: 'image' | 'pdf' | 'md' | 'word';
  filePath: string;
}

export const LocalFileViewer: React.FC<LocalFileViewerProps> = ({ id, type, filePath }) => {
  const updateOverlay = useOverlayStore((state) => state.updateOverlay);
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [mdContent, setMdContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // 1. Kiểm thử tệp tồn tại và đọc nội dung
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
            const rootPath = useProjectStore.getState().rootPath || '';
            const content = await readTextFile(filePath, rootPath);
            setMdContent(content);
          } else if (type === 'word') {
            const fileData = await readFile(filePath);
            // Render docx
            setTimeout(async () => {
              if (docxContainerRef.current) {
                docxContainerRef.current.innerHTML = '';
                try {
                  await renderDocx(fileData, docxContainerRef.current, undefined, {
                    className: 'docx-preview',
                    inWrapper: false,
                    ignoreWidth: true,
                    ignoreHeight: true
                  });
                } catch (e) {
                  console.error('Error rendering docx:', e);
                  if (docxContainerRef.current) {
                    docxContainerRef.current.innerHTML = `<div class="p-4 text-xs text-red-400">Cannot render this Word document. The file might be corrupted or unsupported.</div>`;
                  }
                }
              }
            }, 100);
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

  // 2. Click Chọn tệp mới
  const handleSelectFile = async () => {
    try {
      const extensions = 
        type === 'image' ? ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] :
        type === 'pdf' ? ['pdf'] :
        type === 'md' ? ['md'] :
        type === 'word' ? ['docx', 'doc'] : [];

      const title = `Select ${type.toUpperCase()} File`;

      const selected = await openDialog({
        multiple: false,
        title,
        filters: extensions.length > 0 ? [{ name: type.toUpperCase(), extensions }] : undefined
      });

      if (selected && typeof selected === 'string') {
        const fileName = selected.split(/[\\/]/).pop() || `${type.toUpperCase()} File`;
        updateOverlay(id, { 
          content: selected, 
          title: fileName 
        });
      }
    } catch (err) {
      console.error('Error selecting file:', err);
    }
  };

  // ──── Loading State ────
  if (loading || fileExists === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 bg-[#151515]">
        Loading file data...
      </div>
    );
  }

  // ──── Error UI (File không tồn tại) ────
  if (!fileExists) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#181818] text-center select-none">
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

  // ──── Hiển thị theo định dạng ────
  const assetUrl = convertFileSrc(filePath);

  switch (type) {
    case 'image':
      return (
        <div className="flex-1 flex flex-col h-full bg-[#151515] overflow-hidden relative group">
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

    case 'pdf':
      return (
        <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden relative">
          <div className="flex-1 min-h-0 bg-[#252526]">
            <iframe
              src={assetUrl}
              className="w-full h-full border-none"
              title="PDF Local Reader"
            />
          </div>
        </div>
      );

    case 'md':
      return (
        <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] overflow-hidden relative">
          <ZoomPanContainer id={id} enableTextSelect={true}>
            <div className="max-w-3xl mx-auto text-left select-text">
              <MarkdownViewer content={mdContent} />
            </div>
          </ZoomPanContainer>
        </div>
      );

    case 'word':
      return (
        <div className="flex-1 flex flex-col h-full bg-[#1a1a1a] overflow-hidden relative">
          <ZoomPanContainer id={id} enableTextSelect={true}>
            <div 
              ref={docxContainerRef}
              className="p-6 bg-white text-black font-sans select-text min-h-full [&_.docx-preview]:mx-auto [&_.docx-preview]:max-w-3xl [&_.docx-preview]:bg-white [&_.docx-preview_table]:border-collapse [&_.docx-preview_table]:border [&_.docx-preview_table_td]:border [&_.docx-preview_table_td]:p-1"
            />
          </ZoomPanContainer>
        </div>
      );

    default:
      return null;
  }
};

// ─── Zoom Pan Container Component ─────────────────────────────────────────
const zoomCache = new Map<string, { scale: number; position: { x: number; y: number } }>();

interface ZoomPanContainerProps {
  id: string;
  children: React.ReactNode;
  enableTextSelect?: boolean;
}

const ZoomPanContainer: React.FC<ZoomPanContainerProps> = ({ 
  id,
  children, 
  enableTextSelect = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Khôi phục scale và position từ cache nếu có
  const [scale, setScale] = useState(() => {
    return zoomCache.get(id)?.scale ?? 1;
  });
  const [position, setPosition] = useState(() => {
    return zoomCache.get(id)?.position ?? { x: 0, y: 0 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [toolMode, setToolMode] = useState<'pan' | 'select'>(enableTextSelect ? 'select' : 'pan');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Lưu trạng thái vào cache mỗi khi scale hoặc position thay đổi
  useEffect(() => {
    zoomCache.set(id, { scale, position });
  }, [id, scale, position]);

  // Lắng nghe phím Spacebar để kích hoạt chế độ kéo tạm thời
  useEffect(() => {
    if (!enableTextSelect) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enableTextSelect]);

  const handleWheel = (e: React.WheelEvent) => {
    const shouldZoom = e.ctrlKey || toolMode === 'pan';
    if (shouldZoom) {
      e.preventDefault();
      const zoomFactor = 0.15;
      let nextScale = scale + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
      nextScale = Math.max(0.3, Math.min(nextScale, 10)); // Hỗ trợ zoom tối đa 10x (1000%)

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom hội tụ chính xác vào vị trí con trỏ chuột
        const newPosX = mouseX - (mouseX - position.x) * (nextScale / scale);
        const newPosY = mouseY - (mouseY - position.y) * (nextScale / scale);

        setScale(nextScale);
        setPosition({ x: newPosX, y: newPosY });
      }
    } else {
      // Cuộn chuột bình thường khi đã zoom (scale !== 1)
      if (scale !== 1) {
        e.preventDefault();
        setPosition(pos => ({
          x: pos.x - e.deltaX * 0.8,
          y: pos.y - e.deltaY * 0.8
        }));
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return; // Chỉ cho phép chuột trái hoặc giữa

    const isPanActive = toolMode === 'pan' || isSpacePressed || e.button === 1;
    if (!isPanActive) return;

    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const nextX = e.clientX - dragStart.current.x;
    const nextY = e.clientY - dragStart.current.y;
    setPosition({ x: nextX, y: nextY });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Zoom từ toolbar (hội tụ vào tâm của viewport)
  const handleToolbarZoom = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cX = rect.width / 2;
    const cY = rect.height / 2;

    let nextScale = scale + factor;
    nextScale = Math.max(0.3, Math.min(nextScale, 10)); // Hỗ trợ zoom tối đa 10x (1000%)

    const newPosX = cX - (cX - position.x) * (nextScale / scale);
    const newPosY = cY - (cY - position.y) * (nextScale / scale);

    setScale(nextScale);
    setPosition({ x: newPosX, y: newPosY });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const isPanningNow = toolMode === 'pan' || isSpacePressed;

  return (
    <div 
      ref={containerRef}
      className={`flex-1 w-full h-full relative overflow-hidden select-none bg-[#121212] group ${
        isPanningNow ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
    >
      {/* Zoomable Wrapper */}
      <div 
        className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0'
        }}
      >
        <div 
          className={`w-full h-full p-4 max-w-full max-h-full ${
            isPanningNow ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
          onWheel={(e) => {
            const shouldZoom = e.ctrlKey || toolMode === 'pan';
            if (shouldZoom || scale !== 1) {
              e.stopPropagation();
            }
          }}
          style={{
            overflow: scale !== 1 ? 'hidden' : 'auto'
          }}
        >
          {children}
        </div>
      </div>

      {/* Floating Control Toolbar - Tự động ẩn đi khi ko rê chuột vào cửa sổ */}
      <div 
        className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center gap-3 shadow-2xl z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto"
        onMouseDown={e => e.stopPropagation()} // Ngăn drag window
      >
        {enableTextSelect && (
          <>
            <button
              onClick={() => setToolMode('select')}
              className={`p-1 rounded transition-colors text-xs font-bold flex items-center gap-1 ${
                toolMode === 'select' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Select text"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span className="text-[10px]">Select</span>
            </button>
            <button
              onClick={() => setToolMode('pan')}
              className={`p-1 rounded transition-colors text-xs font-bold flex items-center gap-1 ${
                toolMode === 'pan' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Pan tool (Hold Spacebar)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span className="text-[10px]">Pan</span>
            </button>
            <div className="w-px h-3.5 bg-neutral-800" />
          </>
        )}

        <button
          onClick={() => handleToolbarZoom(-0.25)}
          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono font-bold text-neutral-400 min-w-[32px] text-center select-none">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => handleToolbarZoom(0.25)}
          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3.5 bg-neutral-800" />
        <button
          onClick={handleReset}
          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded transition-colors"
          title="Reset Zoom & Position"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ─── Markdown Viewer Component ──────────────────────────────────────────────
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

    if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-bold text-indigo-300">
          {matchedStr.slice(2, -2)}
        </strong>
      );
    } else if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      parts.push(
        <code key={key++} className="bg-[#2d2d2d] text-amber-400 px-1 py-0.5 rounded font-mono text-[10px] border border-neutral-700">
          {matchedStr.slice(1, -1)}
        </code>
      );
    }

    currentText = currentText.substring(index + matchedStr.length);
    match = currentText.match(regex);
  }

  if (currentText) {
    parts.push(currentText);
  }

  return parts.length > 0 ? parts : text;
}

const MarkdownViewer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return <div className="text-xs text-neutral-600 italic">Empty document.</div>;
  
  const lines = content.split('\n');
  const rendered = lines.map((line, idx) => {
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
  });

  return <div className="space-y-0.5 select-text">{rendered}</div>;
};
