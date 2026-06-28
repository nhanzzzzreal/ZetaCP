// src/components/TitleBar/TitleBar.tsx

import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logo from '../../assets/logo.svg';

interface TitleBarProps {
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  terminalOpen?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  onToggleTerminal?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  leftPanelOpen = true,
  rightPanelOpen = true,
  terminalOpen = true,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleTerminal,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    // Listen for resize events to track maximized state
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    // Check initial state
    appWindow.isMaximized().then(setIsMaximized);

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => appWindow.minimize();
  const handleToggleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const handleDoubleClick = () => {
    appWindow.toggleMaximize();
  };

  return (
    <div
      className="titlebar h-[35px] bg-[var(--zcp-bg-titlebar-active)] border-b border-[var(--zcp-border)] flex items-center justify-between select-none shrink-0 font-[var(--zcp-font-ui)] z-50"
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
    >
      {/* Left side: Logo + App name */}
      <div className="flex items-center gap-2.5 pl-3 pointer-events-none" data-tauri-drag-region>
        <img
          src={logo}
          className="w-4 h-4 rounded-[var(--zcp-radius-sm)] select-none pointer-events-none"
          alt="ZetaCP Logo"
          data-tauri-drag-region
        />
        <span
          className="text-[var(--zcp-text-primary)] font-medium text-[13px]"
          data-tauri-drag-region
        >
          ZetaCP
        </span>
      </div>

      {/* Right side: Panel toggles + Window controls */}
      <div className="flex items-stretch h-full" onDoubleClick={(e) => e.stopPropagation()}>
        {/* Panel toggle buttons */}
        <div className="flex items-center gap-0.5 px-1.5 mr-1">
          <button
            onClick={onToggleLeftPanel}
            className={`p-1.5 rounded-[var(--zcp-radius-sm)] text-[16px] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
              leftPanelOpen
                ? 'text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]'
                : 'text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)]/50 hover:text-[var(--zcp-text-active)]'
            }`}
            title={leftPanelOpen ? 'Hide Explorer' : 'Show Explorer'}
          >
            <span className="codicon codicon-layout-sidebar-left flex items-center justify-center" />
          </button>
          <button
            onClick={onToggleTerminal}
            className={`p-1.5 rounded-[var(--zcp-radius-sm)] text-[16px] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
              terminalOpen
                ? 'text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]'
                : 'text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)]/50 hover:text-[var(--zcp-text-active)]'
            }`}
            title={terminalOpen ? 'Hide Terminal' : 'Show Terminal'}
          >
            <span className="codicon codicon-terminal flex items-center justify-center" />
          </button>
          <button
            onClick={onToggleRightPanel}
            className={`p-1.5 rounded-[var(--zcp-radius-sm)] text-[16px] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer ${
              rightPanelOpen
                ? 'text-[var(--zcp-text-active)] hover:bg-[var(--zcp-hover-bg)]'
                : 'text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)]/50 hover:text-[var(--zcp-text-active)]'
            }`}
            title={rightPanelOpen ? 'Hide Testcases' : 'Show Testcases'}
          >
            <span className="codicon codicon-layout-sidebar-right flex items-center justify-center" />
          </button>

        </div>

        {/* Window controls */}
        <button
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-[13px] text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] transition-colors cursor-pointer"
          title="Minimize"
        >
          <span className="codicon codicon-chrome-minimize flex items-center justify-center" />
        </button>
        <button
          onClick={handleToggleMaximize}
          className="w-11 h-full flex items-center justify-center text-[13px] text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] transition-colors cursor-pointer"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <span className="codicon codicon-chrome-restore flex items-center justify-center" />
          ) : (
            <span className="codicon codicon-chrome-maximize flex items-center justify-center" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center text-[13px] text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-verdict-wa)] hover:text-white transition-colors cursor-pointer"
          title="Close"
        >
          <span className="codicon codicon-chrome-close flex items-center justify-center" />
        </button>
      </div>
    </div>
  );
};
