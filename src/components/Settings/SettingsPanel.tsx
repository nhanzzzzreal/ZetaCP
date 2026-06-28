import React from 'react';
import { useSettingsPanelActions } from './useSettingsPanelActions';
import { GeneralTab } from './GeneralTab';
import { EditorTab } from './EditorTab';
import { CompilerTab } from './CompilerTab';
import { JudgeTab } from './JudgeTab';
import { ShortcutsTab } from './ShortcutsTab';

export const SettingsPanel: React.FC = () => {
  const {
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
  } = useSettingsPanelActions();

  if (!isSettingsOpen || !localSettings) return null;

  return (
    <div ref={modalRef} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 select-none animate-in fade-in duration-[var(--zcp-duration)]">
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
          <div className="w-2/3 bg-[var(--zcp-bg-editor)] p-4 overflow-y-auto flex flex-col gap-5 scrollbar-thin">
            {!hasAnyMatches ? (
              <div className="flex-1 flex items-center justify-center text-xs text-neutral-500 italic">
                No matching settings found.
              </div>
            ) : (
              <>
                {showGeneral && (
                  <GeneralTab localSettings={localSettings} onChange={setLocalSettings} />
                )}

                {showEditor && (
                  <EditorTab localSettings={localSettings} onChange={setLocalSettings} />
                )}

                {showCompiler && (
                  <CompilerTab localSettings={localSettings} onChange={setLocalSettings} />
                )}

                {showJudge && (
                  <JudgeTab localSettings={localSettings} onChange={setLocalSettings} />
                )}

                {showShortcuts && (
                  <ShortcutsTab
                    localSettings={localSettings}
                    recordingAction={recordingAction}
                    onRecordActionChange={setRecordingAction}
                  />
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
