import React, { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { GlobalSettings } from '../../types/settings';

export const SettingsPanel: React.FC = () => {
  const { isSettingsOpen, settings, saveSettings, closeSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState<GlobalSettings | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('General');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recordingAction, setRecordingAction] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings, isSettingsOpen]);

  // Capture keys when recording shortcut
  useEffect(() => {
    if (!recordingAction) return;

    const handleRecordKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key.toLowerCase();
      if (key === 'escape') {
        setRecordingAction(null);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');

      if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
        if (key === ' ') {
          parts.push('space');
        } else {
          parts.push(key);
        }
      }

      if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
        const shortcutStr = parts.join('+');
        setLocalSettings(prev => {
          if (!prev) return null;
          return {
            ...prev,
            shortcuts: {
              ...prev.shortcuts,
              [recordingAction]: shortcutStr
            }
          };
        });
        setRecordingAction(null);
      }
    };

    window.addEventListener('keydown', handleRecordKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleRecordKeyDown, true);
    };
  }, [recordingAction]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modal = modalRef.current;
    if (modal) {
      const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;

      const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length === 0) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen]);

  if (!isSettingsOpen || !localSettings) return null;

  const handleSave = async () => {
    await saveSettings(localSettings);
    closeSettings();
  };

  const handleClose = () => {
    closeSettings();
  };

  // Define categories
  const categories = ['General', 'Editor', 'Compiler', 'Judge', 'Keyboard Shortcuts'] as const;

  // Search filter matching helper
  const matches = (label: string, desc?: string) => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return label.toLowerCase().includes(q) || (desc && desc.toLowerCase().includes(q));
  };

  const isSearching = searchQuery.trim().length > 0;

  // We determine what to display in right panel
  const showGeneral = !isSearching ? activeCategory === 'General' : (matches('Theme') || matches('Diff Layout'));
  const showEditor = !isSearching ? activeCategory === 'Editor' : (matches('Font Family') || matches('Font Size') || matches('Editor'));
  const showCompiler = !isSearching ? activeCategory === 'Compiler' : (matches('g++ Path') || matches('Python Path') || matches('Default Compiler Flags') || matches('compiler'));
  const showJudge = !isSearching ? activeCategory === 'Judge' : (matches('Threads Count') || matches('Default Time Limit') || matches('Default Memory Limit') || matches('judge') || matches('threads'));
  const showShortcuts = !isSearching ? activeCategory === 'Keyboard Shortcuts' : (matches('shortcuts') || matches('keyboard') || matches('Run Tests') || matches('Stop Judge') || matches('New Testcase') || matches('Open Settings'));

  const hasAnyMatches = showGeneral || showEditor || showCompiler || showJudge || showShortcuts;

  const shortcutLabels: Record<string, string> = {
    run_tests: 'Run Tests',
    stop_judge: 'Stop Judge',
    new_testcase: 'New Testcase',
    open_settings: 'Open Settings'
  };

  return (
    <div ref={modalRef} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 select-none animate-in fade-in duration-[var(--zcp-duration)]">
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] w-[680px] h-[480px] flex flex-col overflow-hidden text-[var(--zcp-text-primary)] font-sans">
        
        {/* Header */}
        <div className="h-10 px-4 border-b border-[var(--zcp-border)] flex items-center justify-between shrink-0 bg-[var(--zcp-bg-sidebar)]">
          <span className="text-xs font-bold tracking-wider text-[var(--zcp-text-primary)]">Settings</span>
          <button 
            onClick={handleClose} 
            className="text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] transition-colors cursor-pointer"
          >
            <span className="codicon codicon-close text-[14px]" />
          </button>
        </div>

        {/* Horizontal Layout Container */}
        <div className="flex-1 flex min-h-0">
          
          {/* Left Column (Navigation & Search) */}
          <div className="w-1/3 bg-[var(--zcp-bg-sidebar)] border-r border-[var(--zcp-border)] flex flex-col p-3 gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <span className="codicon codicon-search absolute left-2.5 top-[9px] text-[13px] text-[var(--zcp-text-secondary)]" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2 py-1.5 pl-8 text-xs text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] focus-visible-outline"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-[7px] text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] cursor-pointer"
                >
                  <span className="codicon codicon-close text-[11px]" />
                </button>
              )}
            </div>

            {/* Categories List */}
            <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  disabled={isSearching}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-left px-2.5 py-2 rounded-[var(--zcp-radius-sm)] text-xs transition-colors cursor-pointer ${
                    isSearching 
                      ? 'text-[var(--zcp-text-muted)] cursor-not-allowed'
                      : activeCategory === cat 
                        ? 'bg-[var(--zcp-hover-bg)] text-[var(--zcp-text-active)] font-medium' 
                        : 'hover:bg-[var(--zcp-hover-bg)]/50 hover:text-[var(--zcp-text-active)] text-[var(--zcp-text-secondary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {isSearching && (
                <div className="text-[10px] text-neutral-500 px-2 py-1 italic">
                  Search is active. Showing matched categories.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Settings Panel Body) */}
          <div className="w-2/3 bg-[#252526] p-4 overflow-y-auto flex flex-col gap-5 scrollbar-thin">
            {!hasAnyMatches ? (
              <div className="flex-1 flex items-center justify-center text-xs text-neutral-500 italic">
                No matching settings found.
              </div>
            ) : (
              <>
                {/* General Settings */}
                {showGeneral && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#2b2b2b] pb-1">General</h3>
                    
                    {/* Theme */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Theme</label>
                      <select
                        value={localSettings.theme}
                        onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value as any })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      >
                        <option value="dark">Dark Theme</option>
                        <option value="light">Light Theme</option>
                        <option value="system">System Default</option>
                      </select>
                    </div>

                    {/* Diff Layout */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Diff Layout</label>
                      <select
                        value={localSettings.diff.layout}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          diff: { ...localSettings.diff, layout: e.target.value as any }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      >
                        <option value="horizontal">Horizontal Side-by-Side</option>
                        <option value="vertical">Vertical Top-and-Bottom</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Editor Settings */}
                {showEditor && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#2b2b2b] pb-1">Editor</h3>
                    
                    {/* Font Family */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Font Family</label>
                      <input
                        type="text"
                        value={localSettings.font.editor}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          font: { ...localSettings.font, editor: e.target.value }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>

                    {/* Font Size */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Font Size</label>
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={localSettings.font.size}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          font: { ...localSettings.font, size: parseInt(e.target.value) || 14 }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>
                  </div>
                )}

                {/* Compiler Settings */}
                {showCompiler && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#2b2b2b] pb-1">Compiler</h3>
                    
                    {/* g++ Path */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">g++ Path</label>
                      <input
                        type="text"
                        value={localSettings.compiler.gppPath}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          compiler: { ...localSettings.compiler, gppPath: e.target.value }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>

                    {/* Python Path */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Python Path</label>
                      <input
                        type="text"
                        value={localSettings.compiler.pythonPath}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          compiler: { ...localSettings.compiler, pythonPath: e.target.value }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>

                    {/* Default Compiler Flags */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Default Compiler Flags</label>
                      <input
                        type="text"
                        value={localSettings.compiler.defaultFlags}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          compiler: { ...localSettings.compiler, defaultFlags: e.target.value }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>
                  </div>
                )}

                {/* Judge Settings */}
                {showJudge && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#2b2b2b] pb-1">Judge</h3>
                    
                    {/* Threads Count */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Threads Count</label>
                      <input
                        type="number"
                        min={1}
                        max={32}
                        value={localSettings.judge.threads}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          judge: { ...localSettings.judge, threads: parseInt(e.target.value) || 4 }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>

                    {/* Default Time Limit (ms) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Default Time Limit (ms)</label>
                      <input
                        type="number"
                        min={50}
                        max={60000}
                        value={localSettings.judge.defaultTimeLimitMs}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          judge: { ...localSettings.judge, defaultTimeLimitMs: parseInt(e.target.value) || 1000 }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>

                    {/* Default Memory Limit (MB) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-neutral-300">Default Memory Limit (MB)</label>
                      <input
                        type="number"
                        min={1}
                        max={2048}
                        value={Math.round(localSettings.judge.defaultMemoryLimitKb / 1024)}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          judge: { ...localSettings.judge, defaultMemoryLimitKb: (parseInt(e.target.value) || 256) * 1024 }
                        })}
                        className="bg-[#1f1f1f] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>
                  </div>
                )}

                {/* Keyboard Shortcuts Settings */}
                {showShortcuts && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-semibold border-b border-[#2b2b2b] pb-1">Keyboard Shortcuts</h3>
                    
                    <div className="border border-[#2b2b2b] rounded overflow-hidden">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-[#1e1e1e] text-neutral-400 font-semibold border-b border-[#2b2b2b]">
                            <th className="p-2.5">Action</th>
                            <th className="p-2.5">Shortcut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(shortcutLabels).map((actionKey) => {
                            const isRecording = recordingAction === actionKey;
                            const binding = localSettings.shortcuts[actionKey] || 'None';
                            
                            return (
                              <tr key={actionKey} className="border-b border-[#2b2b2b] hover:bg-[#2e2e2f]/30">
                                <td className="p-2.5 font-medium text-neutral-300">{shortcutLabels[actionKey]}</td>
                                <td className="p-2.5">
                                  <button
                                    onClick={() => setRecordingAction(isRecording ? null : actionKey)}
                                    className={`w-full text-left px-2 py-1 rounded border text-xs font-mono transition-all ${
                                      isRecording
                                        ? 'bg-neutral-800/40 border-neutral-500 text-neutral-200 animate-pulse font-bold'
                                        : 'bg-[#1f1f1f] border-[#3c3c3c] text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'
                                    }`}
                                  >
                                    {isRecording ? 'Press keys (Escape to cancel)...' : binding.toUpperCase()}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <span className="text-[10px] text-neutral-500">
                      Click a cell and type the desired key combination (including Ctrl, Alt, Shift modifiers) to assign it.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer (Save & Close Buttons) */}
        <div className="h-12 border-t border-[var(--zcp-border)] px-4 flex items-center justify-end gap-2 shrink-0 bg-[var(--zcp-bg-sidebar)]">
          <button
            onClick={handleClose}
            className="px-3.5 py-1.5 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] text-xs font-semibold text-[var(--zcp-text-secondary)] hover:bg-[var(--zcp-hover-bg)] hover:text-[var(--zcp-text-active)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] text-xs font-semibold active:scale-95 transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] cursor-pointer"
          >
            Save
          </button>
        </div>

      </div>
    </div>
  );
};
