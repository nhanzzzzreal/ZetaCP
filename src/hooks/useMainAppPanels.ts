import { useState, useRef, useEffect } from 'react';
import { PanelImperativeHandle } from 'react-resizable-panels';
import { useLayoutStore } from '../stores/useLayoutStore';

function useSyncPanel(open: boolean, ref: React.RefObject<PanelImperativeHandle>) {
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    if (open && panel.isCollapsed()) panel.expand();
    else if (!open && !panel.isCollapsed()) panel.collapse();
  }, [open, ref]);
}


export function useMainAppPanels() {
  const terminalOpen = useLayoutStore((s) => s.terminalOpen);
  const setTerminalOpen = useLayoutStore((s) => s.setTerminalOpen);
  const activeView = useLayoutStore((s) => s.activeView);
  const isMaximized = false;

  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('explorer');

  const refs = {
    left: useRef<PanelImperativeHandle>(null),
    right: useRef<PanelImperativeHandle>(null),
    console: useRef<PanelImperativeHandle>(null),
  };

  useSyncPanel(leftPanelOpen, refs.left);
  useSyncPanel(rightPanelOpen, refs.right);
  useSyncPanel(terminalOpen, refs.console);

  return {
    leftPanelOpen, setLeftPanelOpen,
    rightPanelOpen, setRightPanelOpen,
    activeTab, setActiveTab,
    leftPanelRef: refs.left, rightPanelRef: refs.right, consolePanelRef: refs.console,
    terminalOpen, setTerminalOpen,
    isMaximized, activeView,
  };
}
