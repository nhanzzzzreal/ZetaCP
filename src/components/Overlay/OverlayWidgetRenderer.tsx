// src/components/Overlay/OverlayWidgetRenderer.tsx

import React from 'react';
import { Overlay } from '../../stores/useOverlayStore';
import { ScratchpadCanvas } from './widgets/ScratchpadCanvas';
import { NoteEditor } from './widgets/NoteEditor';
import { LocalFileViewer } from './widgets/LocalFileViewer';
import { DiffViewerWidget } from './widgets/DiffViewerWidget';
import { CalculatorWidget } from './widgets/CalculatorWidget';
import { GraphVisualizerWidget } from './widgets/GraphVisualizerWidget';

interface OverlayWidgetRendererProps {
  overlay: Overlay;
}

export const OverlayWidgetRenderer: React.FC<OverlayWidgetRendererProps> = ({ overlay }) => {
  switch (overlay.type) {
    case 'scratchpad':
      return <ScratchpadCanvas id={overlay.id} initialContent={overlay.content} />;
    
    case 'notes':
      return <NoteEditor id={overlay.id} initialContent={overlay.content} />;
    
    case 'image':
    case 'pdf':
    case 'md':
    case 'word':
      return <LocalFileViewer id={overlay.id} type={overlay.type} filePath={overlay.content} />;

    case 'fileviewer':
      return <LocalFileViewer id={overlay.id} type="fileviewer" filePath={overlay.content} />;
    
    case 'diff':
      return <DiffViewerWidget id={overlay.id} content={overlay.content} />;
    
    case 'calculator':
      return <CalculatorWidget overlay={overlay} />;
    
    case 'graph':
    case 'graph-viewer':
      return <GraphVisualizerWidget overlay={overlay} />;
    
    default:
      return (
        <div className="p-4 text-xs text-neutral-400 bg-[#2a2a2a] h-full flex items-center justify-center select-none">
          Unsupported widget type: {overlay.type}
        </div>
      );
  }
};
