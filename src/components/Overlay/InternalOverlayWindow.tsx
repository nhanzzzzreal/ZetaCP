// src/components/Overlay/InternalOverlayWindow.tsx

import React, { useRef, useState, useEffect } from 'react';
import { Overlay, useOverlayStore } from '../../stores/useOverlayStore';
import { OverlayWidgetRenderer } from './OverlayWidgetRenderer';
import { useOverlayDragResize } from './hooks/useOverlayDragResize';
import { OverlayTitlebar } from './components/OverlayTitlebar';
import { OverlayResizeHandles } from './components/OverlayResizeHandles';

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

  const { handleDragStart, handleResizeStart } = useOverlayDragResize(
    overlay,
    isMaximized,
    windowRef,
    onFocus,
    onPositionChange,
    onSizeChange
  );

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

  const handleWindowClick = () => {
    onFocus(overlay.id);
  };

  const calculatedZIndex = overlay.isPinned ? overlay.zIndex + 10000 : overlay.zIndex;
  const currentFilePath = useOverlayStore(state => state.currentFilePath);
  const isFromDifferentFile = overlay.filePath !== currentFilePath;
  const isHidden = overlay.isMinimized || !overlay.isVisible || isFromDifferentFile;

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
      className={`flex flex-col bg-[#2a2a2a]/95 backdrop-blur-md text-neutral-100 overflow-hidden rounded border border-transparent select-none transition-opacity duration-150 font-mono ${
        isHidden ? 'pointer-events-none' : 'pointer-events-auto'
      } ${
        overlay.isPinned ? 'ring-1 ring-indigo-500/50 border-indigo-500/40' : ''
      }`}
    >
      <OverlayTitlebar
        overlay={overlay}
        isMaximized={isMaximized}
        setIsMaximized={setIsMaximized}
        showOpacitySlider={showOpacitySlider}
        setShowOpacitySlider={setShowOpacitySlider}
        sliderRef={sliderRef}
        onDragStart={handleDragStart}
        onPin={onPin}
        onMinimize={onMinimize}
        onClose={onClose}
        onOpacityChange={onOpacityChange}
      />

      <div className="flex-1 min-h-0 bg-[#2a2a2a] text-neutral-300 relative text-sm flex flex-col">
        <OverlayWidgetRenderer overlay={overlay} />
      </div>

      {!isMaximized && <OverlayResizeHandles onResizeStart={handleResizeStart} />}
    </div>
  );
};
