// src/components/DocsViewer/DocsViewerWindow.tsx

import React, { useEffect, useState, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { ArrowLeft, ArrowRight, RotateCw, Home, Minus, Square, Copy, X } from 'lucide-react';

interface DocsViewerWindowProps {
  docsType: string;
}

export const DocsViewerWindow: React.FC<DocsViewerWindowProps> = ({ docsType }) => {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const title = docsType === 'cp-algorithms' ? 'CP Algorithms Reference' : 'C++ Reference';

  // Use the custom docs:// protocol handler registered in Rust.
  // On Windows in Tauri v2, custom URI schemes are served as http://<scheme>.localhost/<path>.
  // This lets the browser resolve relative CSS/JS/image paths correctly relative to the base URL,
  // unlike the asset:// protocol which breaks relative sub-resource resolution inside iframes.
  const indexPath = docsType === 'cp-algorithms'
    ? 'cp-algorithms/index.html'
    : 'cppreference/reference/en/index.html';
  const homeUrl = `http://docs.localhost/${indexPath}`;

  useEffect(() => {
    // Check initial maximized state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for resize events to toggle maximize/restore icon
    const unlisten = appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleBack = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.history.back();
      }
    } catch (e) {
      console.error('Failed to navigate back:', e);
    }
  };

  const handleForward = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.history.forward();
      }
    } catch (e) {
      console.error('Failed to navigate forward:', e);
    }
  };

  const handleReload = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.location.reload();
      }
    } catch (e) {
      console.error('Failed to reload iframe:', e);
    }
  };

  const handleHome = () => {
    try {
      if (iframeRef.current && homeUrl) {
        iframeRef.current.src = homeUrl;
      }
    } catch (e) {
      console.error('Failed to navigate to home:', e);
    }
  };

  const handleMinimize = () => appWindow.minimize();
  const handleToggleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] text-neutral-100 overflow-hidden font-sans select-none border border-[#2b2b2b]">
      {/* ── Custom Titlebar (Drag Region) ────────────────────────────────── */}
      <div
        className="flex items-center justify-between h-9 bg-[#181818] border-b border-[#2b2b2b] shrink-0 cursor-move"
        data-tauri-drag-region
        onDoubleClick={handleToggleMaximize}
      >
        {/* Left: Window Icon + Window Title */}
        <div className="flex items-center gap-2.5 pl-3 min-w-0 pointer-events-none" data-tauri-drag-region>
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" data-tauri-drag-region />
          <span className="text-xs font-semibold text-neutral-200 truncate max-w-[250px] tracking-wide" data-tauri-drag-region>
            {title}
          </span>
        </div>

        {/* Center: Navigation Controls (Buttons are clickable, container isn't) */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#222222]/80 border border-[#2b2b2b]/40 rounded-full h-[26px]" onDoubleClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleBack}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleForward}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReload}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
            title="Reload"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3 bg-neutral-700/60 self-center mx-0.5" />
          <button
            onClick={handleHome}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
            title="Home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-stretch h-full" onDoubleClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleMinimize}
            className="w-10 h-full flex items-center justify-center text-neutral-400 hover:bg-[#2b2d2e] hover:text-neutral-200 transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={handleToggleMaximize}
            className="w-10 h-full flex items-center justify-center text-neutral-400 hover:bg-[#2b2d2e] hover:text-neutral-200 transition-colors cursor-pointer"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-10 h-full flex items-center justify-center text-neutral-400 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Content View (iframe) ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-[#1e1e1e] relative">
        <iframe
          ref={iframeRef}
          src={homeUrl}
          className="w-full h-full border-none bg-white"
          title={title}
        />
      </div>
    </div>
  );
};
