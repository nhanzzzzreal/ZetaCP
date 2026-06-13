// src/App.tsx

import { useState, useRef, useEffect } from 'react';
import { Group, Panel, Separator, PanelImperativeHandle } from 'react-resizable-panels';
import { FileTree } from './components/FileExplorer/FileTree';
import { MonacoEditor } from './components/Editor/MonacoEditor';
import { TabBar } from './components/Editor/TabBar';
import { TitleBar } from './components/TitleBar/TitleBar';
import { useProjectStore } from './stores/useProjectStore';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { useSession } from './hooks/useSession';
import { TestcasePanel } from './components/TestcasePanel/TestcasePanel';
import { useSettingsStore } from './stores/useSettingsStore';
import { useShortcuts } from './hooks/useShortcuts';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { useLayoutStore } from './stores/useLayoutStore';
import { useOverlayStore } from './stores/useOverlayStore';
import { useTestcaseStore } from './stores/useTestcaseStore';
import { OverlayTaskbar } from './components/Overlay/OverlayTaskbar';
import './App.css';
import { InternalOverlayContainer } from './components/Overlay/InternalOverlayContainer';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { DiffLine } from './types/testcase';
import { ActivityBar } from './components/ActivityBar/ActivityBar';

function App() {
  return <MainApp />;
}

function MainApp() {
  const activeFile = useProjectStore((s) => s.activeFile);
  const isSettingsOpen = useSettingsStore((s) => s.isSettingsOpen);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  
  const loadOverlaysForFile = useOverlayStore((s) => s.loadOverlaysForFile);
  const syncOverlays = useOverlayStore((s) => s.syncOverlays);
  const togglePin = useOverlayStore((s) => s.togglePin);
  const editorRegionRef = useRef<HTMLDivElement>(null);

  useSession(); // Khôi phục và tự động lưu phiên làm việc

  const terminalOpen = useLayoutStore((s) => s.terminalOpen);
  const setTerminalOpen = useLayoutStore((s) => s.setTerminalOpen);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  
  const [activeTab, setActiveTab] = useState('explorer');

  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const rightPanelRef = useRef<PanelImperativeHandle>(null);
  const consolePanelRef = useRef<PanelImperativeHandle>(null);

  const openSettings = useSettingsStore((state) => state.openSettings);

  useEffect(() => {
    const panel = leftPanelRef.current;
    if (panel) {
      if (leftPanelOpen && panel.isCollapsed()) {
        panel.expand();
      } else if (!leftPanelOpen && !panel.isCollapsed()) {
        panel.collapse();
      }
    }
  }, [leftPanelOpen]);

  useEffect(() => {
    const panel = rightPanelRef.current;
    if (panel) {
      if (rightPanelOpen && panel.isCollapsed()) {
        panel.expand();
      } else if (!rightPanelOpen && !panel.isCollapsed()) {
        panel.collapse();
      }
    }
  }, [rightPanelOpen]);

  useEffect(() => {
    const panel = consolePanelRef.current;
    if (panel) {
      if (terminalOpen && panel.isCollapsed()) {
        panel.expand();
      } else if (!terminalOpen && !panel.isCollapsed()) {
        panel.collapse();
      }
    }
  }, [terminalOpen]);

  useShortcuts(); // Kích hoạt các phím tắt hệ thống

  useEffect(() => {
    // 1. Load initial settings
    loadSettings();
    
    // 2. Setup watcher / sync overlays on active file change
    if (activeFile) {
      loadOverlaysForFile(activeFile);
    }

    // Biến lưu trạng thái trước đó để phát hiện thay đổi
    let lastActiveFilePath = activeFile;
    const knownStatusMap = new Map<string, string | null | undefined>();
    let lastResultsSize = 0;

    const unsubscribe = useTestcaseStore.subscribe((state) => {
      const { addLog } = useOverlayStore.getState();
      
      // 1. Sync overlays when file changes
      if (state.activeFilePath !== lastActiveFilePath) {
        if (state.activeFilePath) {
          addLog('info', 'system', `Switched to file: ${state.activeFilePath.split(/[\\/]/).pop()}`);
        }
        lastActiveFilePath = state.activeFilePath;
      }

      // 2. Testcase status change detection
      state.results.forEach((res, tcId) => {
        const prevStatus = knownStatusMap.get(tcId);
        const currentStatus = res.lastStatus;

        if (currentStatus !== prevStatus) {
          const tcMeta = state.metas.get(tcId);
          const name = tcMeta ? tcMeta.name : `Testcase #${tcId.substring(0, 4)}`;
          
          if (currentStatus === 'QUEUED') {
            addLog('info', 'judge', `${name} is queued...`);
          } else if (currentStatus === 'PENDING') {
            addLog('info', 'judge', `${name} is running...`);
          } else if (currentStatus && ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'].includes(currentStatus)) {
            let logType: 'success' | 'error' | 'warning' | 'info' = 'info';
            let details = `Time: ${res.execTimeMs ?? '?'} ms\nMemory: ${res.memoryKb ?? '?'} KB`;
            
            if (currentStatus === 'AC') {
              logType = 'success';
            } else if (currentStatus === 'WA') {
              logType = 'error';
              if (res.diffInfo) {
                details += `\nOutput Diff:\n${res.diffInfo}`;
              }
              // Emit updated diff data to any standalone diff windows
              const loadAndEmit = async () => {
                let data = state.loadedData.get(tcId);
                if (!data) {
                  await state.loadData(tcId);
                  data = useTestcaseStore.getState().loadedData.get(tcId);
                }
                if (data) {
                  const expected = data.expectedOutput || '';
                  const actual = res.actualOutput || '';
                  const diffLines = await invoke<DiffLine[]>('compute_diff', { expected, actual });
                  await emit('diff-data-updated', { testcaseId: tcId, diffLines });
                }
              };
              loadAndEmit().catch(console.error);
            } else {
              logType = 'warning';
            }

            addLog(logType, 'judge', `${name} finished with status: ${currentStatus}`, details);
          }
          knownStatusMap.set(tcId, currentStatus);
        }
      });

      // Clear untracked results if they were deleted or reset
      if (state.results.size === 0 && lastResultsSize > 0) {
        knownStatusMap.clear();
      }
      lastResultsSize = state.results.size;
    });

    const currentFile = activeFile;
    const unlistenOverlays = listen('overlays-updated', async () => {
      if (currentFile) {
        await syncOverlays(currentFile);
      }
    });

    return () => {
      unsubscribe();
      unlistenOverlays.then(fn => fn());
    };
  }, [activeFile, loadSettings, loadOverlaysForFile, syncOverlays, togglePin]);

  const handleToggleLeftPanel = () => {
    setLeftPanelOpen(!leftPanelOpen);
  };

  const handleToggleRightPanel = () => {
    setRightPanelOpen(!rightPanelOpen);
  };

  const handleToggleConsole = () => {
    setTerminalOpen(!terminalOpen);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--zcp-bg-editor)] text-[var(--zcp-text-primary)] overflow-hidden relative">
      {/* Title Bar */}
      <TitleBar 
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        terminalOpen={terminalOpen}
        onToggleLeftPanel={handleToggleLeftPanel}
        onToggleRightPanel={handleToggleRightPanel}
        onToggleTerminal={handleToggleConsole}
      />

      {/* Workspace Area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Activity Bar */}
        <ActivityBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          leftPanelOpen={leftPanelOpen}
          onToggleLeftPanel={handleToggleLeftPanel}
          onOpenSettings={openSettings}
        />

        <Group orientation="horizontal">
          {/* Sidebar - Conditional Panels */}
          <Panel 
            panelRef={leftPanelRef} 
            defaultSize="15%" 
            minSize="10%" 
            maxSize="40%" 
            collapsible 
            collapsedSize="0%" 
            onResize={(size) => setLeftPanelOpen(size.asPercentage > 0)}
          >
            {activeTab === 'explorer' ? (
              <FileTree />
            ) : activeTab === 'search' ? (
              <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] p-4 text-xs text-[var(--zcp-text-secondary)] font-sans border-r border-[var(--zcp-border)]">
                Search in project (Coming soon)
              </div>
            ) : (
              <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] p-4 text-xs text-[var(--zcp-text-secondary)] font-sans border-r border-[var(--zcp-border)]">
                CP Debugger (Coming soon)
              </div>
            )}
          </Panel>

          {/* Custom Resize Handle */}
          <Separator className="w-[1px] bg-transparent hover:bg-[var(--zcp-focus-border)] active:bg-[var(--zcp-focus-border)] focus-visible:bg-[var(--zcp-focus-border)] outline-none transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-col-resize z-10" />

          {/* Center Panel - Tabs + Editor + Console */}
          <Panel minSize="30%" defaultSize="65%">
            <div ref={editorRegionRef} className="w-full h-full flex flex-col min-w-0 relative overflow-hidden">
              <TabBar />

              {activeFile ? (
                <Group orientation="vertical">
                  <Panel minSize="20%" defaultSize="75%">
                    <div className="w-full h-full min-h-0 relative">
                      <MonacoEditor />
                    </div>
                  </Panel>

                  <Separator className="h-[1px] bg-transparent hover:bg-[var(--zcp-focus-border)] active:bg-[var(--zcp-focus-border)] focus-visible:bg-[var(--zcp-focus-border)] outline-none transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-row-resize z-10" />

                  <Panel
                    panelRef={consolePanelRef}
                    collapsible
                    minSize="15%"
                    defaultSize="25%"
                    maxSize="80%"
                    onResize={(size) => setTerminalOpen(size.asPercentage > 0)}
                  >
                    <div className="w-full h-full bg-[var(--zcp-bg-sidebar)] flex flex-col min-h-0 border-t border-[var(--zcp-border)]">
                      {/* Console Header */}
                      <div
                        onClick={handleToggleConsole}
                        className="h-[30px] px-3 flex items-center justify-between cursor-pointer hover:bg-[var(--zcp-hover-bg)] select-none text-xs text-[var(--zcp-text-primary)] border-b border-[var(--zcp-border)] shrink-0 transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)]"
                      >
                        <span className="font-semibold flex items-center gap-1.5">
                          <span className="codicon codicon-terminal text-[14px] text-[var(--zcp-accent)] shrink-0" />
                          <span>Output Console</span>
                        </span>
                        <span className="codicon codicon-chevron-down text-[12px]" style={{ transform: terminalOpen ? 'none' : 'rotate(180deg)', transition: 'transform var(--zcp-duration) var(--zcp-easing)' }} />
                      </div>
                      {/* Terminal Body */}
                      <div className="flex-1 min-h-0 bg-[var(--zcp-bg-editor)]">
                        <TerminalPanel />
                      </div>
                    </div>
                  </Panel>
                </Group>
              ) : (
                <div className="flex-1 min-h-0 relative">
                  <MonacoEditor />
                </div>
              )}

            </div>
          </Panel>

          {/* Custom Resize Handle */}
          <Separator className="w-[1px] bg-transparent hover:bg-[var(--zcp-focus-border)] active:bg-[var(--zcp-focus-border)] focus-visible:bg-[var(--zcp-focus-border)] outline-none transition-colors duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-col-resize z-10" />

          {/* Right Panel - Testcase System */}
          <Panel panelRef={rightPanelRef} defaultSize="20%" minSize="15%" maxSize="40%" collapsible collapsedSize="0%" onResize={(size) => setRightPanelOpen(size.asPercentage > 0)}>
            <TestcasePanel />
          </Panel>
        </Group>
      </div>

      {/* Overlay Taskbar - Always Visible at the Bottom */}
      <OverlayTaskbar />

      {isSettingsOpen && <SettingsPanel />}

      {/* Cửa sổ nổi nội bộ (Internal Floating Windows Container) */}
      <InternalOverlayContainer />
    </div>
  );
}

export default App;
