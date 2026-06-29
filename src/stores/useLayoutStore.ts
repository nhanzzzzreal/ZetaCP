// src/stores/useLayoutStore.ts

import { create } from 'zustand';
import { PanelViewId } from '../types/panelLayout';
import { useSettingsStore } from './useSettingsStore';

interface LayoutState {
  diffVisible: boolean;
  graphViewerOpen: boolean;
  editorWidth: number;
  testcasePanelWidth: number;
  terminalOpen: boolean;
  activeView: 'editor' | 'stress-tester';

  // Panel layout
  rightTabs: PanelViewId[];
  activeRightTab: PanelViewId;

  toggleDiff: () => void;
  openGraphViewer: () => void;
  closeGraphViewer: () => void;
  setPanelSizes: (editorWidth: number, testcasePanelWidth: number) => void;
  setTerminalOpen: (open: boolean) => void;
  setActiveView: (view: 'editor' | 'stress-tester') => void;

  setPanelLayout: (rightTabs: PanelViewId[], activeRightTab: PanelViewId) => void;
  moveToRight: (view: PanelViewId) => void;
  moveToLeft: (view: PanelViewId) => void;
  setActiveRightTab: (view: PanelViewId) => void;
}

const syncSettings = (rightTabs: PanelViewId[], activeRightTab: PanelViewId) => {
  const currentSettings = useSettingsStore.getState().settings;
  if (currentSettings) {
    const updated = {
      ...currentSettings,
      panelLayout: {
        rightTabs,
        activeRightTab,
      },
    };
    useSettingsStore.getState().saveSettings(updated);
  }
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
  diffVisible: false,
  graphViewerOpen: false,
  editorWidth: 50,
  testcasePanelWidth: 50,
  terminalOpen: false,
  activeView: 'editor',

  rightTabs: ['testcase'],
  activeRightTab: 'testcase',

  toggleDiff: () => set((state) => ({ diffVisible: !state.diffVisible })),
  openGraphViewer: () => set({ graphViewerOpen: true }),
  closeGraphViewer: () => set({ graphViewerOpen: false }),
  setPanelSizes: (editorWidth, testcasePanelWidth) => set({ editorWidth, testcasePanelWidth }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setActiveView: (view) => set({ activeView: view }),

  setPanelLayout: (rightTabs, activeRightTab) => set({ rightTabs, activeRightTab }),

  moveToRight: (view) => {
    const { rightTabs } = get();
    if (rightTabs.includes(view)) {
      set({ activeRightTab: view });
      syncSettings(rightTabs, view);
      return;
    }
    const newTabs = [...rightTabs, view];
    set({ rightTabs: newTabs, activeRightTab: view });
    syncSettings(newTabs, view);
  },

  moveToLeft: (view) => {
    const { rightTabs, activeRightTab } = get();
    const newTabs = rightTabs.filter((t) => t !== view);
    if (newTabs.length === 0) {
      // Always keep at least testcase if empty
      newTabs.push('testcase');
    }
    const newActive = activeRightTab === view ? newTabs[0] : activeRightTab;
    set({ rightTabs: newTabs, activeRightTab: newActive });
    syncSettings(newTabs, newActive);
  },

  setActiveRightTab: (view) => {
    const { rightTabs } = get();
    set({ activeRightTab: view });
    syncSettings(rightTabs, view);
  },
}));
