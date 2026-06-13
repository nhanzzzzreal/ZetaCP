// src/stores/useLayoutStore.ts

import { create } from 'zustand';

interface LayoutState {
  diffVisible: boolean;
  graphViewerOpen: boolean;
  editorWidth: number;
  testcasePanelWidth: number;
  terminalOpen: boolean;

  toggleDiff: () => void;
  openGraphViewer: () => void;
  closeGraphViewer: () => void;
  setPanelSizes: (editorWidth: number, testcasePanelWidth: number) => void;
  setTerminalOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  diffVisible: false,
  graphViewerOpen: false,
  editorWidth: 50,
  testcasePanelWidth: 50,
  terminalOpen: false,

  toggleDiff: () => set((state) => ({ diffVisible: !state.diffVisible })),
  openGraphViewer: () => set({ graphViewerOpen: true }),
  closeGraphViewer: () => set({ graphViewerOpen: false }),
  setPanelSizes: (editorWidth, testcasePanelWidth) => set({ editorWidth, testcasePanelWidth }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
}));
