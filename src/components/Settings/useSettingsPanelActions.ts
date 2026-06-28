import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { GlobalSettings } from '../../types/settings';

export function useSettingsPanelActions() {
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

  // Focus trapping
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

  const handleSave = async () => {
    if (localSettings) {
      await saveSettings(localSettings);
    }
    closeSettings();
  };

  const handleClose = () => {
    closeSettings();
  };

  const categories = ['General', 'Editor', 'Compiler', 'Judge', 'Keyboard Shortcuts'] as const;

  const matches = (label: string, desc?: string) => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return label.toLowerCase().includes(q) || (desc && desc.toLowerCase().includes(q));
  };

  const isSearching = searchQuery.trim().length > 0;

  const showGeneral = !isSearching ? activeCategory === 'General' : (matches('Theme') || matches('Diff Layout'));
  const showEditor = !isSearching ? activeCategory === 'Editor' : (matches('Font Family') || matches('Font Size') || matches('Editor'));
  const showCompiler = !isSearching ? activeCategory === 'Compiler' : (matches('g++ Path') || matches('Python Path') || matches('Default Compiler Flags') || matches('compiler'));
  const showJudge = !isSearching ? activeCategory === 'Judge' : (matches('Threads Count') || matches('Default Time Limit') || matches('Default Memory Limit') || matches('judge') || matches('threads'));
  const showShortcuts = !isSearching ? activeCategory === 'Keyboard Shortcuts' : (matches('shortcuts') || matches('keyboard') || matches('Run Tests') || matches('Stop Judge') || matches('New Testcase') || matches('Open Settings'));

  const hasAnyMatches = showGeneral || showEditor || showCompiler || showJudge || showShortcuts;

  return {
    isSettingsOpen,
    localSettings,
    setLocalSettings,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    recordingAction,
    setRecordingAction,
    modalRef,
    handleSave,
    handleClose,
    categories,
    isSearching,
    showGeneral,
    showEditor,
    showCompiler,
    showJudge,
    showShortcuts,
    hasAnyMatches,
  };
}
