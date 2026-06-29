// src/types/panelLayout.ts

export type PanelViewId =
  | 'explorer'
  | 'snippets'
  | 'stress'
  | 'debug'
  | 'testcase';

export interface PanelLayoutSettings {
  rightTabs: PanelViewId[];
  activeRightTab: PanelViewId;
}

export const PANEL_VIEW_LABELS: Record<PanelViewId, string> = {
  explorer: 'Explorer',
  snippets: 'Snippets',
  stress: 'Stress Tester',
  debug: 'CP Debugger',
  testcase: 'Testcases',
};

export const DEFAULT_PANEL_LAYOUT: PanelLayoutSettings = {
  rightTabs: ['testcase'],
  activeRightTab: 'testcase',
};
