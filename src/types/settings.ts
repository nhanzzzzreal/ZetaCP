import { PanelLayoutSettings } from './panelLayout';

export interface GlobalSettings {
  compiler: {
    gppPath: string;
    pythonPath: string;
    defaultFlags: string;  // "-O2 -std=c++17"
  };
  theme: 'dark' | 'light' | 'system';
  font: {
    editor: string;        // "Consolas"
    size: number;
  };
  judge: {
    threads: number;
    defaultTimeLimitMs: number;
    defaultMemoryLimitKb: number;
  };
  diff: {
    layout: 'horizontal' | 'vertical';
  };
  fileFilter: {
    show: string[];        // [".cpp", ".py"]
    hide: string[];        // [".exe", ".db", ".o"]
  };
  shortcuts: Record<string, string>;
  panelLayout: PanelLayoutSettings;
}

