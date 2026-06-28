import React, { useEffect, useState, useRef } from 'react';

const zoomCache = new Map<string, { scale: number; position: { x: number; y: number } }>();

export const useZoomPan = (id: string, enableTextSelect = false) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(() => zoomCache.get(id)?.scale ?? 1);
  const [position, setPosition] = useState(() => zoomCache.get(id)?.position ?? { x: 0, y: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [toolMode, setToolMode] = useState<'pan' | 'select'>(enableTextSelect ? 'select' : 'pan');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    zoomCache.set(id, { scale, position });
  }, [id, scale, position]);

  useEffect(() => {
    if (!enableTextSelect) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (e.code === 'Space' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
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
      nextScale = Math.max(0.3, Math.min(nextScale, 10));

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const newPosX = mouseX - (mouseX - position.x) * (nextScale / scale);
        const newPosY = mouseY - (mouseY - position.y) * (nextScale / scale);
        setScale(nextScale);
        setPosition({ x: newPosX, y: newPosY });
      }
    } else if (scale !== 1) {
      e.preventDefault();
      setPosition(pos => ({
        x: pos.x - e.deltaX * 0.8,
        y: pos.y - e.deltaY * 0.8
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const isPanActive = toolMode === 'pan' || isSpacePressed || e.button === 1;
    if (!isPanActive) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleToolbarZoom = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cX = rect.width / 2;
    const cY = rect.height / 2;
    let nextScale = scale + factor;
    nextScale = Math.max(0.3, Math.min(nextScale, 10));
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

  return {
    scale,
    setScale,
    position,
    setPosition,
    isDragging,
    toolMode,
    setToolMode,
    isSpacePressed,
    containerRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
    handleToolbarZoom,
    handleReset,
    isPanningNow
  };
};
