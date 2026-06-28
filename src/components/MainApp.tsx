import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { FileTree } from './FileExplorer/FileTree';
import { MonacoEditor } from './Editor/MonacoEditor';
import { TabBar } from './Editor/TabBar';
import { TitleBar } from './TitleBar/TitleBar';
import { useProjectStore } from '../stores/useProjectStore';
import { TerminalPanel } from './Terminal/TerminalPanel';
import { TestcasePanel } from './TestcasePanel/TestcasePanel';
import { useSettingsStore } from '../stores/useSettingsStore';
import { SettingsPanel } from './Settings/SettingsPanel';
import { useMainAppPanels } from '../hooks/useMainAppPanels';
import { StatusBar } from './StatusBar/StatusBar';
import { InternalOverlayContainer } from './Overlay/InternalOverlayContainer';
import { openDocsWindow } from '../lib/tauri-bridge';
import { ActivityBar } from './ActivityBar/ActivityBar';
import { SnippetManager } from './Settings/SnippetManager';
import { NotificationCenter } from './Notifications/NotificationCenter';
import { notify } from '../stores/useNotificationStore';
import { useAppSync } from '../hooks/useAppSync';

import { StressTesterSidebar } from './StressTester/StressTesterSidebar';
import { StressBlocklyCanvas } from './StressTester/StressBlocklyCanvas';
import { StressTestManager } from './StressTester/StressTestManager';
import { useStressTestStore } from '../stores/useStressTestStore';

interface LeftSidebarContentProps {
  activeTab: string;
}

export const LeftSidebarContent: React.FC<LeftSidebarContentProps> = ({ activeTab }) => {
  if (activeTab === 'explorer') return <FileTree />;
  if (activeTab === 'snippets') return <SnippetManager />;
  if (activeTab === 'stress') return <StressTesterSidebar />;
  const label = activeTab === 'search' ? 'Search in project' : 'CP Debugger';
  return (
    <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] p-4 text-xs text-[var(--zcp-text-secondary)] font-sans">
      {label} (Coming soon)
    </div>
  );
};

interface ConsolePanelWrapperProps {
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
}

export const ConsolePanelWrapper: React.FC<ConsolePanelWrapperProps> = ({
  terminalOpen,
  setTerminalOpen,
}) => {
  const iconStyle = {
    transform: terminalOpen ? 'none' : 'rotate(180deg)',
    transition: 'transform var(--zcp-duration) var(--zcp-easing)',
  };
  return (
    <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] flex flex-col min-h-0">
      <div
        onClick={() => setTerminalOpen(!terminalOpen)}
        className="h-[30px] px-3 flex items-center justify-between cursor-pointer hover:bg-[var(--zcp-hover-bg)] select-none text-xs text-[var(--zcp-text-primary)] border-b border-[var(--zcp-border)] shrink-0 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)]"
      >
        <span className="font-semibold flex items-center gap-1.5">
          <span className="codicon codicon-terminal text-[14px] text-[var(--zcp-accent)] shrink-0" />
          <span>Output Console</span>
        </span>
        <span className="codicon codicon-chevron-down text-[12px]" style={iconStyle} />
      </div>
      <div className="flex-1 min-h-0 bg-[var(--zcp-bg-editor)]">
        <TerminalPanel />
      </div>
    </div>
  );
};

export function MainApp() {
  const activeFile = useProjectStore((s) => s.activeFile);
  const isSettingsOpen = useSettingsStore((s) => s.isSettingsOpen);
  const openSettings = useSettingsStore((state) => state.openSettings);
  
  const {
    leftPanelOpen, setLeftPanelOpen,
    rightPanelOpen, setRightPanelOpen,
    activeTab, setActiveTab,
    leftPanelRef, rightPanelRef, consolePanelRef,
    terminalOpen, setTerminalOpen,
    isMaximized,
  } = useMainAppPanels();
  const genMode = useStressTestStore((s) => s.genMode);
  const isBlocklyActive = activeTab === 'stress' && genMode === 'blockly';

  useAppSync();

  const handleOpenDocs = (docsType: 'cp-algorithms') => {
    openDocsWindow(docsType).catch((err: unknown) => {
      console.error('Failed to open docs window:', err);
      notify.fromTauriError('Không mở được cửa sổ Docs', err);
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--zcp-bg-editor)] text-[var(--zcp-text-primary)] overflow-hidden relative">
      {!isMaximized && (
        <TitleBar 
          leftPanelOpen={leftPanelOpen}
          rightPanelOpen={rightPanelOpen}
          terminalOpen={terminalOpen}
          onToggleLeftPanel={() => setLeftPanelOpen(!leftPanelOpen)}
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
          onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
        />
      )}

      <div className="flex-1 flex min-h-0 relative">
        {!isMaximized && (
          <ActivityBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            leftPanelOpen={leftPanelOpen}
            onToggleLeftPanel={() => setLeftPanelOpen(!leftPanelOpen)}
            onOpenSettings={openSettings}
            onOpenDocs={handleOpenDocs}
          />
        )}

        <Group orientation="horizontal">
          <Panel 
            panelRef={leftPanelRef} 
            defaultSize="15%" 
            minSize="10%" 
            maxSize="40%" 
            collapsible 
            collapsedSize="0%" 
            className="overflow-hidden h-full w-full"
            onResize={(size) => setLeftPanelOpen(size.asPercentage > 0)}
          >
            <LeftSidebarContent activeTab={activeTab} />
          </Panel>

          <Separator className="w-[1px] bg-[var(--zcp-border)] hover:bg-[var(--zcp-focus-border)] active:bg-[var(--zcp-focus-border)] focus-visible:bg-[var(--zcp-focus-border)] outline-none transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-col-resize z-10" />

          <Panel minSize="30%" defaultSize="65%" className="overflow-hidden h-full w-full">
            <div className="w-full h-full flex flex-col min-w-0 relative overflow-hidden">
              {!isMaximized && <TabBar />}

              <div style={{ display: isBlocklyActive ? 'none' : 'block' }} className="w-full h-full min-h-0 overflow-hidden">
                {activeFile ? (
                  <Group orientation="vertical">
                    <Panel minSize="20%" defaultSize="75%">
                      <div className="w-full h-full min-h-0 relative">
                        <MonacoEditor />
                      </div>
                    </Panel>

                    <Separator className="h-[1px] bg-[var(--zcp-border)] hover:bg-[var(--zcp-focus-border)] active:bg-[var(--zcp-focus-border)] focus-visible:bg-[var(--zcp-focus-border)] outline-none transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-row-resize z-10" />

                    <Panel
                      panelRef={consolePanelRef}
                      collapsible
                      minSize="15%"
                      defaultSize="25%"
                      maxSize="80%"
                      onResize={(size) => setTerminalOpen(size.asPercentage > 0)}
                    >
                      <ConsolePanelWrapper terminalOpen={terminalOpen} setTerminalOpen={setTerminalOpen} />
                    </Panel>
                  </Group>
                ) : (
                  <div className="flex-1 min-h-0 relative">
                    <MonacoEditor />
                  </div>
                )}
              </div>

              <StressBlocklyCanvas visible={isBlocklyActive} />
            </div>
          </Panel>

          <Separator className="w-[1px] bg-[var(--zcp-border)] hover:bg-[var(--zcp-focus-border)] active:bg-[var(--zcp-focus-border)] focus-visible:bg-[var(--zcp-focus-border)] outline-none transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-col-resize z-10" />

          <Panel panelRef={rightPanelRef} defaultSize="20%" minSize="15%" maxSize="40%" collapsible collapsedSize="0%" className="overflow-hidden h-full w-full" onResize={(size) => setRightPanelOpen(size.asPercentage > 0)}>
            <TestcasePanel />
          </Panel>
        </Group>
      </div>

      {!isMaximized && <StatusBar />}
      {isSettingsOpen && <SettingsPanel />}
      <InternalOverlayContainer />
      <NotificationCenter />
      <StressTestManager />
    </div>
  );
}
