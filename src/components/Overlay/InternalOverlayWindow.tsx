// src/components/Overlay/InternalOverlayWindow.tsx

import React, { useRef, useState, useEffect } from 'react';
import { Pin, Minus, Maximize2, X, Copy, Droplets } from 'lucide-react';
import { Overlay, useOverlayStore } from '../../stores/useOverlayStore';
import { OverlayWidgetRenderer } from './OverlayWidgetRenderer';

interface InternalOverlayWindowProps {
  overlay: Overlay;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onPin: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSizeChange: (id: string, w: number, h: number) => void;
  onFocus: (id: string) => void;
}

export const InternalOverlayWindow: React.FC<InternalOverlayWindowProps> = ({ 
  overlay,
  onClose,
  onMinimize,
  onPin,
  onOpacityChange,
  onPositionChange,
  onSizeChange,
  onFocus
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // ── Drag & Resize States ──────────────────────────────────────────────────
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowStartPos = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Close opacity popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(event.target as Node)) {
        setShowOpacitySlider(false);
      }
    };
    if (showOpacitySlider) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOpacitySlider]);

  // ── Đưa cửa sổ lên trước khi click ──────────────────────────────────────────
  const handleWindowClick = () => {
    onFocus(overlay.id);
  };

  // ── Kéo thả (Drag) ────────────────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    onFocus(overlay.id);

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    windowStartPos.current = { x: overlay.x, y: overlay.y, w: overlay.width, h: overlay.height };

    let currentX = overlay.x;
    let currentY = overlay.y;

    const handleDragMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartPos.current.x;
      const dy = moveEvent.clientY - dragStartPos.current.y;
      
      let newX = windowStartPos.current.x + dx;
      let newY = windowStartPos.current.y + dy;

      // Giới hạn kéo thả: Cho phép kéo tự do toàn màn hình
      const minVisible = 60;
      const parentWidth = window.innerWidth;
      const parentHeight = window.innerHeight;

      newX = Math.max(-overlay.width + minVisible, Math.min(newX, parentWidth - minVisible));
      newY = Math.max(0, Math.min(newY, parentHeight - minVisible));

      if (windowRef.current) {
        windowRef.current.style.left = `${newX}px`;
        windowRef.current.style.top = `${newY}px`;
      }
      currentX = newX;
      currentY = newY;
    };

    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      // Sync trạng thái cuối cùng lên parent và DB
      onPositionChange(overlay.id, currentX, currentY);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  // ── Thay đổi kích thước (Resize) ──────────────────────────────────────────
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus(overlay.id);

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    windowStartPos.current = { x: overlay.x, y: overlay.y, w: overlay.width, h: overlay.height };

    let currentW = overlay.width;
    let currentH = overlay.height;
    let currentX = overlay.x;
    let currentY = overlay.y;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartPos.current.x;
      const dy = moveEvent.clientY - dragStartPos.current.y;

      let newW = windowStartPos.current.w;
      let newH = windowStartPos.current.h;
      let newX = windowStartPos.current.x;
      let newY = windowStartPos.current.y;

      const minW = 250;
      const minH = 180;

      if (direction.includes('e')) {
        newW = Math.max(minW, windowStartPos.current.w + dx);
      }
      if (direction.includes('s')) {
        newH = Math.max(minH, windowStartPos.current.h + dy);
      }
      if (direction.includes('w')) {
        const potentialW = windowStartPos.current.w - dx;
        if (potentialW >= minW) {
          newW = potentialW;
          newX = windowStartPos.current.x + dx;
        }
      }
      if (direction.includes('n')) {
        const potentialH = windowStartPos.current.h - dy;
        if (potentialH >= minH) {
          newH = potentialH;
          newY = windowStartPos.current.y + dy;
        }
      }

      if (windowRef.current) {
        windowRef.current.style.width = `${newW}px`;
        windowRef.current.style.height = `${newH}px`;
        windowRef.current.style.left = `${newX}px`;
        windowRef.current.style.top = `${newY}px`;
      }
      currentW = newW;
      currentH = newH;
      currentX = newX;
      currentY = newY;
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      // Sync trạng thái kích thước & toạ độ cuối cùng
      onSizeChange(overlay.id, currentW, currentH);
      if (currentX !== windowStartPos.current.x || currentY !== windowStartPos.current.y) {
        onPositionChange(overlay.id, currentX, currentY);
      }
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // ── Pin / Unpin (Always on top giả lập qua zIndex cực cao) ───────────────────
  const calculatedZIndex = overlay.isPinned ? overlay.zIndex + 10000 : overlay.zIndex;

  const currentFilePath = useOverlayStore(state => state.currentFilePath);
  const isFromDifferentFile = overlay.filePath !== currentFilePath;
  const isHidden = overlay.isMinimized || !overlay.isVisible || isFromDifferentFile;

  // ── Style Maximize vs Normal ──────────────────────────────────────────────
  const windowStyle: React.CSSProperties = isMaximized
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: calculatedZIndex + 5000,
        opacity: isHidden ? 0 : (overlay.opacity || 1.0),
        pointerEvents: isHidden ? 'none' : 'auto',
        visibility: isHidden ? 'hidden' : 'visible',
      }
    : {
        position: 'absolute',
        left: overlay.x,
        top: overlay.y,
        width: overlay.width,
        height: overlay.height,
        zIndex: calculatedZIndex,
        opacity: isHidden ? 0 : (overlay.opacity || 1.0),
        pointerEvents: isHidden ? 'none' : 'auto',
        visibility: isHidden ? 'hidden' : 'visible',
      };

  return (
    <div
      ref={windowRef}
      style={windowStyle}
      onClick={handleWindowClick}
      className={`flex flex-col bg-[#1e1e1e]/95 backdrop-blur-md text-neutral-100 overflow-hidden rounded border border-transparent select-none transition-opacity duration-150 font-mono ${
        isHidden ? 'pointer-events-none' : 'pointer-events-auto'
      } ${
        overlay.isPinned ? 'ring-1 ring-indigo-500/50 border-indigo-500/40' : ''
      }`}
    >
      {/* ── Custom Titlebar (Drag Region) ────────────────────────────────── */}
      <div
        className="flex items-center justify-between h-8 bg-[#161616] shrink-0 cursor-move relative border-none"
        onMouseDown={handleDragStart}
        onDoubleClick={() => setIsMaximized(!isMaximized)}
      >
        {/* Left: title + type */}
        <div className="flex items-center gap-2 pl-3 min-w-0 pointer-events-none">
          <span className={`w-2 h-2 rounded-full shrink-0 ${overlay.isPinned ? 'bg-indigo-400' : 'bg-neutral-500'}`} />
          <span className="text-xs font-bold text-neutral-200 truncate max-w-[180px]">
            {overlay.title}
          </span>
        </div>

        {/* Right: window controls */}
        <div className="flex items-stretch h-full relative" onMouseDown={(e) => e.stopPropagation()}>
          {/* Opacity Control Button */}
          <div className="relative flex items-center h-full">
            <button
              onClick={() => setShowOpacitySlider(!showOpacitySlider)}
              className={`w-9 h-full flex items-center justify-center transition-colors hover:bg-[#222222] ${
                showOpacitySlider ? 'text-indigo-400' : 'text-neutral-500 hover:text-neutral-200'
              }`}
              title="Opacity"
            >
              <Droplets className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            {showOpacitySlider && (
              <div 
                ref={sliderRef}
                className="absolute right-0 top-full mt-1 bg-[#1e1e1e] border border-transparent rounded shadow-2xl p-2.5 z-[20000] flex flex-col gap-1.5 w-36 items-start font-mono"
              >
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                  Opacity: {Math.round((overlay.opacity || 1.0) * 100)}%
                </span>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={overlay.opacity || 1.0}
                  onChange={(e) => onOpacityChange(overlay.id, parseFloat(e.target.value))}
                  className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Pin */}
          <button
            onClick={() => onPin(overlay.id)}
            className={`w-9 h-full flex items-center justify-center transition-colors ${
              overlay.isPinned
                ? 'text-indigo-400 hover:bg-[#222222]'
                : 'text-neutral-500 hover:bg-[#222222] hover:text-neutral-200'
            }`}
            title={overlay.isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin className={`w-3 h-3 ${overlay.isPinned ? 'fill-indigo-400/30' : ''}`} strokeWidth={1.5} />
          </button>

          {/* Minimize → ẩn vào Taskbar */}
          <button
            onClick={() => onMinimize(overlay.id)}
            className="w-9 h-full flex items-center justify-center text-neutral-500 hover:bg-[#222222] hover:text-neutral-200 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3" strokeWidth={1.5} />
          </button>

          {/* Maximize */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="w-9 h-full flex items-center justify-center text-neutral-500 hover:bg-[#222222] hover:text-neutral-200 transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Copy className="w-3 h-3" strokeWidth={1.5} /> : <Maximize2 className="w-3 h-3" strokeWidth={1.5} />}
          </button>

          {/* Close */}
          <button
            onClick={() => onClose(overlay.id)}
            className="w-9 h-full flex items-center justify-center text-neutral-500 hover:bg-red-600 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Widget Content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-[#1e1e1e] text-neutral-300 relative text-sm flex flex-col">
        <OverlayWidgetRenderer overlay={overlay} />
      </div>

      {/* ── Resize Handles (Chỉ hiển thị khi không maximized) ──────────────── */}
      {!isMaximized && (
        <>
          {/* Cạnh */}
          <div
            className="absolute right-0 top-0 w-1 h-full cursor-ew-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
          <div
            className="absolute left-0 top-0 w-1 h-full cursor-ew-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div
            className="absolute left-0 bottom-0 h-1 w-full cursor-ns-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div
            className="absolute left-0 top-0 h-1 w-full cursor-ns-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />

          {/* Góc */}
          <div
            className="absolute right-0 bottom-0 w-2.5 h-2.5 cursor-nwse-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
          <div
            className="absolute left-0 bottom-0 w-2.5 h-2.5 cursor-nesw-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            className="absolute right-0 top-0 w-2.5 h-2.5 cursor-nesw-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className="absolute left-0 top-0 w-2.5 h-2.5 cursor-nwse-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
        </>
      )}
    </div>
  );
};
