import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, MousePointer, Hand } from 'lucide-react';
import { useZoomPan } from './useZoomPan';

interface ZoomPanContainerProps {
  id: string;
  children: React.ReactNode;
  enableTextSelect?: boolean;
}

export const ZoomPanContainer: React.FC<ZoomPanContainerProps> = ({ 
  id,
  children, 
  enableTextSelect = false
}) => {
  const {
    scale,
    position,
    toolMode,
    setToolMode,
    containerRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
    handleToolbarZoom,
    handleReset,
    isPanningNow
  } = useZoomPan(id, enableTextSelect);

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

      {/* Floating Control Toolbar */}
      <div 
        className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center gap-3 shadow-2xl z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto"
        onMouseDown={e => e.stopPropagation()}
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
