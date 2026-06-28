import React from 'react';
import { Pin, Minus, Maximize2, X, Copy, Droplets } from 'lucide-react';
import { Overlay } from '../../../stores/useOverlayStore';

interface OverlayTitlebarProps {
  overlay: Overlay;
  isMaximized: boolean;
  setIsMaximized: (val: boolean) => void;
  showOpacitySlider: boolean;
  setShowOpacitySlider: (val: boolean) => void;
  sliderRef: React.RefObject<HTMLDivElement>;
  onDragStart: (e: React.MouseEvent) => void;
  onPin: (id: string) => void;
  onMinimize: (id: string) => void;
  onClose: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
}

export const OverlayTitlebar: React.FC<OverlayTitlebarProps> = ({
  overlay,
  isMaximized,
  setIsMaximized,
  showOpacitySlider,
  setShowOpacitySlider,
  sliderRef,
  onDragStart,
  onPin,
  onMinimize,
  onClose,
  onOpacityChange
}) => {
  return (
    <div
      className="flex items-center justify-between h-8 bg-[#202020] shrink-0 cursor-move relative border-none"
      onMouseDown={onDragStart}
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
              className="absolute right-0 top-full mt-1 bg-[#2a2a2a] border border-transparent rounded shadow-2xl p-2.5 z-[20000] flex flex-col gap-1.5 w-36 items-start font-mono"
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

        {/* Minimize */}
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
  );
};
