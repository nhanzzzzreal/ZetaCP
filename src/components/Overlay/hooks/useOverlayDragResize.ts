import React, { useRef } from 'react';
import { Overlay } from '../../../stores/useOverlayStore';

interface ResizeProps {
  direction: string;
  dx: number;
  dy: number;
  start: { x: number; y: number; w: number; h: number };
}

const calculateResize = ({ direction, dx, dy, start }: ResizeProps) => {
  let w = start.w;
  let h = start.h;
  let x = start.x;
  let y = start.y;
  const minW = 250;
  const minH = 180;

  if (direction.includes('e')) w = Math.max(minW, start.w + dx);
  if (direction.includes('s')) h = Math.max(minH, start.h + dy);
  if (direction.includes('w') && start.w - dx >= minW) {
    w = start.w - dx;
    x = start.x + dx;
  }
  if (direction.includes('n') && start.h - dy >= minH) {
    h = start.h - dy;
    y = start.y + dy;
  }
  return { w, h, x, y };
};

interface DragMoveProps {
  moveEvent: MouseEvent;
  dragStart: { x: number; y: number };
  windowStart: { x: number; y: number; w: number; h: number };
  overlayWidth: number;
  windowRef: React.RefObject<HTMLDivElement>;
}

const performDragMove = ({ moveEvent, dragStart, windowStart, overlayWidth, windowRef }: DragMoveProps) => {
  const dx = moveEvent.clientX - dragStart.x;
  const dy = moveEvent.clientY - dragStart.y;
  let newX = windowStart.x + dx;
  let newY = windowStart.y + dy;
  const minVisible = 60;
  const parentWidth = window.innerWidth;
  const parentHeight = window.innerHeight;
  newX = Math.max(-overlayWidth + minVisible, Math.min(newX, parentWidth - minVisible));
  newY = Math.max(0, Math.min(newY, parentHeight - minVisible));
  if (windowRef.current) {
    windowRef.current.style.left = `${newX}px`;
    windowRef.current.style.top = `${newY}px`;
  }
  return { newX, newY };
};

export const useOverlayDragResize = (
  overlay: Overlay,
  isMaximized: boolean,
  windowRef: React.RefObject<HTMLDivElement>,
  onFocus: (id: string) => void,
  onPositionChange: (id: string, x: number, y: number) => void,
  onSizeChange: (id: string, w: number, h: number) => void
) => {
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowStartPos = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleDragStart = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    onFocus(overlay.id);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    windowStartPos.current = { x: overlay.x, y: overlay.y, w: overlay.width, h: overlay.height };
    let currentX = overlay.x;
    let currentY = overlay.y;

    const handleDragMove = (moveEvent: MouseEvent) => {
      const { newX, newY } = performDragMove({
        moveEvent,
        dragStart: dragStartPos.current,
        windowStart: windowStartPos.current,
        overlayWidth: overlay.width,
        windowRef
      });
      currentX = newX;
      currentY = newY;
    };

    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      onPositionChange(overlay.id, currentX, currentY);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

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
      const { w, h, x, y } = calculateResize({
        direction,
        dx,
        dy,
        start: windowStartPos.current
      });
      if (windowRef.current) {
        windowRef.current.style.width = `${w}px`;
        windowRef.current.style.height = `${h}px`;
        windowRef.current.style.left = `${x}px`;
        windowRef.current.style.top = `${y}px`;
      }
      currentW = w;
      currentH = h;
      currentX = x;
      currentY = y;
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      onSizeChange(overlay.id, currentW, currentH);
      if (currentX !== windowStartPos.current.x || currentY !== windowStartPos.current.y) {
        onPositionChange(overlay.id, currentX, currentY);
      }
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  return { handleDragStart, handleResizeStart };
};
