import React from 'react';
import { useOverlayStore } from '../../stores/useOverlayStore';
import { InternalOverlayWindow } from './InternalOverlayWindow';
import { ask } from '@tauri-apps/plugin-dialog';

export const InternalOverlayContainer: React.FC = () => {
  const { 
    overlays, 
    closeOverlay, 
    minimizeOverlay, 
    togglePin, 
    updatePosition, 
    updateSize, 
    updateOverlay, 
    bringToFront 
  } = useOverlayStore();

  // Render all overlays to keep components mounted (preserves Tldraw canvas, scroll state, zoom state)
  // Hide/show and click-through interactions are handled by CSS inside InternalOverlayWindow

  const handleClose = async (id: string) => {
    const confirmed = await ask(
      'This window will be permanently deleted from the database and cannot be undone. Are you sure you want to close?',
      {
        title: 'Confirm Delete Window',
        kind: 'warning',
        okLabel: 'Delete Permanently',
        cancelLabel: 'Cancel'
      }
    );
    if (confirmed) {
      await closeOverlay(id);
    }
  };

  const handleMinimize = async (id: string) => {
    await minimizeOverlay(id);
  };

  const handlePin = async (id: string) => {
    await togglePin(id);
  };

  const handleOpacityChange = (id: string, opacity: number) => {
    updateOverlay(id, { opacity });
  };

  const handlePositionChange = (id: string, x: number, y: number) => {
    updatePosition(id, x, y);
  };

  const handleSizeChange = (id: string, w: number, h: number) => {
    updateSize(id, w, h);
  };

  const handleFocus = (id: string) => {
    bringToFront(id);
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50 select-none">
      {overlays.map((overlay) => (
        <InternalOverlayWindow 
          key={overlay.id} 
          overlay={overlay}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onPin={handlePin}
          onOpacityChange={handleOpacityChange}
          onPositionChange={handlePositionChange}
          onSizeChange={handleSizeChange}
          onFocus={handleFocus}
        />
      ))}
    </div>
  );
};
