import React from 'react';

interface OverlayResizeHandlesProps {
  onResizeStart: (e: React.MouseEvent, direction: string) => void;
}

export const OverlayResizeHandles: React.FC<OverlayResizeHandlesProps> = ({ onResizeStart }) => {
  return (
    <>
      {/* Cạnh */}
      <div
        className="absolute right-0 top-0 w-1 h-full cursor-ew-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 'e')}
      />
      <div
        className="absolute left-0 top-0 w-1 h-full cursor-ew-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 'w')}
      />
      <div
        className="absolute left-0 bottom-0 h-1 w-full cursor-ns-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 's')}
      />
      <div
        className="absolute left-0 top-0 h-1 w-full cursor-ns-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 'n')}
      />

      {/* Góc */}
      <div
        className="absolute right-0 bottom-0 w-2.5 h-2.5 cursor-nwse-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 'se')}
      />
      <div
        className="absolute left-0 bottom-0 w-2.5 h-2.5 cursor-nesw-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 'sw')}
      />
      <div
        className="absolute right-0 top-0 w-2.5 h-2.5 cursor-nesw-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 'ne')}
      />
      <div
        className="absolute left-0 top-0 w-2.5 h-2.5 cursor-nwse-resize z-50"
        onMouseDown={(e) => onResizeStart(e, 'nw')}
      />
    </>
  );
};
