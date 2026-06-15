// src/components/Settings/SnippetManager.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useSnippetStore } from '../../stores/useSnippetStore';
import { SnippetEditor } from './SnippetEditor';

export const SnippetManager: React.FC = () => {
  const { snippets, loadSnippets, saveSnippet, deleteSnippet } = useSnippetStore();

  // Selected snippet ID or null
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState<'All' | 'cpp' | 'python'>('All');

  // Form State
  const [trigger, setTrigger] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<'cpp' | 'python'>('cpp');
  const [isDefault, setIsDefault] = useState<number>(0);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Error/Validation State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load snippets on component mount
  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  // Find currently selected snippet
  const selectedSnippet = useMemo(() => {
    if (selectedId === null) return null;
    return snippets.find((s) => s.id === selectedId) || null;
  }, [selectedId, snippets]);

  // Sync form state when selection changes
  useEffect(() => {
    if (selectedSnippet) {
      setTrigger(selectedSnippet.trigger);
      setDescription(selectedSnippet.description);
      setCode(selectedSnippet.code);
      setLanguage(selectedSnippet.language as 'cpp' | 'python');
      setIsDefault(selectedSnippet.is_default ?? 0);
      setIsCreatingNew(false);
      setErrorMsg(null);
      setSaveSuccess(false);
    }
  }, [selectedSnippet]);

  // Handle click on "New Snippet"
  const handleNewSnippetClick = () => {
    setSelectedId(null);
    setIsCreatingNew(true);
    setTrigger('');
    setDescription('');
    setCode('');
    setLanguage('cpp');
    setIsDefault(0);
    setShowGuide(false);
    setErrorMsg(null);
    setSaveSuccess(false);
  };

  // Filter and search snippets list
  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      const matchesSearch =
        s.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLang = langFilter === 'All' || s.language === langFilter;
      return matchesSearch && matchesLang;
    });
  }, [snippets, searchQuery, langFilter]);

  // Validate form in real-time
  const triggerValidation = useMemo(() => {
    if (!trigger.trim()) {
      return 'Trigger is required.';
    }
    // Autocomplete triggers should generally not contain spaces or special chars
    if (/\s/.test(trigger)) {
      return 'Trigger should not contain spaces.';
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(trigger)) {
      return 'Trigger should only contain alphanumeric characters, underscores, or hyphens.';
    }

    // Check for duplicate trigger for same language
    const hasDuplicate = snippets.some(
      (s) =>
        s.trigger.toLowerCase() === trigger.trim().toLowerCase() &&
        s.language === language &&
        s.id !== selectedId
    );

    if (hasDuplicate) {
      return `A snippet with trigger "${trigger}" for language "${language === 'cpp' ? 'C++' : 'Python'}" already exists.`;
    }

    return null;
  }, [trigger, language, snippets, selectedId]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    if (triggerValidation) {
      setErrorMsg(triggerValidation);
      return;
    }

    if (!code.trim()) {
      setErrorMsg('Snippet code cannot be empty.');
      return;
    }

    try {
      const payload = {
        id: selectedId ?? undefined,
        trigger: trigger.trim(),
        description: description.trim(),
        code,
        language,
        is_default: isDefault
      };
      
      await saveSnippet(payload);
      setSaveSuccess(true);
      setErrorMsg(null);

      // If we just created a new snippet, select it in the list by matching trigger & language
      if (isCreatingNew) {
        setIsCreatingNew(false);
        // Small delay to allow the state to refresh and then find the new snippet
        setTimeout(() => {
          useSnippetStore.getState().loadSnippets().then(() => {
            const newlyCreated = useSnippetStore.getState().snippets.find(
              (s) => s.trigger === payload.trigger && s.language === payload.language
            );
            if (newlyCreated) {
              setSelectedId(newlyCreated.id);
            }
          });
        }, 100);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save snippet.');
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (selectedId === null) return;
    const confirmDelete = window.confirm('Are you sure you want to delete this snippet?');
    if (!confirmDelete) return;

    try {
      await deleteSnippet(selectedId);
      setSelectedId(null);
      setIsCreatingNew(false);
      setTrigger('');
      setDescription('');
      setCode('');
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete snippet.');
    }
  };

  const closeModal = () => {
    setSelectedId(null);
    setIsCreatingNew(false);
    setTrigger('');
    setDescription('');
    setCode('');
    setIsDefault(0);
    setShowGuide(false);
    setErrorMsg(null);
    setSaveSuccess(false);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-text-primary)] font-sans select-none">
      
      {/* Sidebar List (Takes 100% width and height of panel) */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Header Section */}
        <div className="p-3 border-b border-[var(--zcp-border)] flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--zcp-text-secondary)]">Snippet Library</span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <span className="codicon codicon-search absolute left-2 top-[7.5px] text-[12px] text-[var(--zcp-text-muted,#858585)]" />
            <input
              type="text"
              placeholder="Search snippets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-[var(--zcp-border)] rounded px-2 py-1 pl-7 text-[11px] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border,#007acc)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-[6px] text-[var(--zcp-text-muted)] hover:text-[var(--zcp-text-active)] cursor-pointer"
              >
                <span className="codicon codicon-close text-[10px]" />
              </button>
            )}
          </div>

          {/* Language Filter */}
          <div className="flex items-center justify-between text-[11px] text-[var(--zcp-text-secondary)] gap-1">
            <span>Filter language:</span>
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value as any)}
              className="bg-[#1e1e1e] border border-[var(--zcp-border)] rounded px-1.5 py-0.5 text-[11px] text-[var(--zcp-text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="All">All</option>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
            </select>
          </div>
        </div>

        {/* Snippets List */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 scrollbar-thin">
          {filteredSnippets.length === 0 ? (
            <div className="text-[11px] text-[var(--zcp-text-muted)] text-center py-8 italic">
              No snippets found.
            </div>
          ) : (
            filteredSnippets.map((snippet) => {
              const isSelected = selectedId === snippet.id;
              return (
                <button
                  key={snippet.id}
                  onClick={() => setSelectedId(snippet.id)}
                  className={`w-full text-left px-3 py-2 border rounded-md transition-all duration-150 cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-[var(--zcp-hover-bg,#2a2d2e)] border-[var(--zcp-focus-border,#007acc)] text-[var(--zcp-text-active)] shadow-sm'
                      : 'bg-[#1e1e1e] border-[var(--zcp-border,#333)] hover:bg-[var(--zcp-hover-bg)]/30 text-[var(--zcp-text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-[12px] font-semibold tracking-wide truncate max-w-[150px]">
                      {snippet.trigger}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        snippet.language === 'cpp' 
                          ? 'bg-blue-900/40 text-blue-300 border border-blue-800/60' 
                          : 'bg-yellow-900/30 text-yellow-300 border border-yellow-800/40'
                      }`}>
                        {snippet.language === 'cpp' ? 'C++' : 'Py'}
                      </span>
                      {snippet.is_default === 1 && (
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-green-950/40 text-green-300 border border-green-800/40">
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                  {snippet.description && (
                    <span className="text-[10px] text-[var(--zcp-text-muted)] line-clamp-1">
                      {snippet.description}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Create Button (Sits at the bottom of the sidebar) */}
      <div className="p-2 border-t border-[var(--zcp-border,#333)] shrink-0 bg-[var(--zcp-bg-sidebar)]">
        <button
          onClick={handleNewSnippetClick}
          className="w-full py-1.5 bg-[var(--zcp-accent,#007acc)] hover:opacity-90 active:scale-95 text-white rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span className="codicon codicon-add text-[11px]" />
          Create New Snippet
        </button>
      </div>

      {/* Editor Modal Dialog (Positioned centered directly on screen) */}
      {(selectedId !== null || isCreatingNew) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e1e] border border-[var(--zcp-border,#333)] rounded-lg w-[750px] max-w-[95vw] h-[580px] max-h-[90vh] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 p-5 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--zcp-border,#333)] pb-3 shrink-0">
              <span className="text-xs font-bold tracking-wider text-[var(--zcp-text-secondary)] uppercase">
                {isCreatingNew ? 'Create New Snippet' : 'Edit Snippet'}
              </span>
              <div className="flex items-center gap-2">
                {!isCreatingNew && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-800/40 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span className="codicon codicon-trash text-[10px]" />
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 hover:bg-[#2d2d2d] rounded text-[var(--zcp-text-muted)] hover:text-[var(--zcp-text-active)] cursor-pointer flex items-center justify-center"
                >
                  <span className="codicon codicon-close text-[14px]" />
                </button>
              </div>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 gap-4">
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {/* Trigger */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--zcp-text-secondary)] uppercase tracking-wider">
                    Trigger / Prefix *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. sgt, dsu"
                    value={trigger}
                    onChange={(e) => {
                      setTrigger(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full bg-[#252526] border border-[var(--zcp-border,#333)] rounded px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border,#007acc)] font-mono"
                    autoFocus
                  />
                </div>

                {/* Language */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--zcp-text-secondary)] uppercase tracking-wider">
                    Language *
                  </label>
                  <select
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value as any);
                      setErrorMsg(null);
                    }}
                    className="w-full bg-[#252526] border border-[var(--zcp-border,#333)] rounded px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border,#007acc)] cursor-pointer"
                  >
                    <option value="cpp">C++ (cpp)</option>
                    <option value="python">Python (python)</option>
                  </select>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-[10px] font-semibold text-[var(--zcp-text-secondary)] uppercase tracking-wider">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Segment Tree implementation"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#252526] border border-[var(--zcp-border,#333)] rounded px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border,#007acc)]"
                  />
                </div>

                {/* Set as Default Checkbox & Collapsible Guide button */}
                <div className="flex items-center justify-between mt-1 col-span-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_default"
                      checked={isDefault === 1}
                      onChange={(e) => setIsDefault(e.target.checked ? 1 : 0)}
                      className="w-3.5 h-3.5 accent-[var(--zcp-accent,#007acc)] cursor-pointer"
                    />
                    <label htmlFor="is_default" className="text-[11px] text-[var(--zcp-text-secondary)] select-none cursor-pointer">
                      Set as default template
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="text-[11px] text-[var(--zcp-text-muted,#858585)] hover:text-[var(--zcp-text-active)] flex items-center gap-1 cursor-pointer transition-colors bg-transparent border-none outline-none"
                  >
                    <span className="codicon codicon-question text-[12px]" />
                    {showGuide ? "Hide Guide" : "Show Guide"}
                  </button>
                </div>

                {/* Collapsible Tab-Stops & Snippet Syntax Guide */}
                {showGuide && (
                  <div className="bg-[#252526] border border-[var(--zcp-border,#333)] rounded p-2.5 col-span-2 text-[11px] text-[var(--zcp-text-secondary)] animate-in slide-in-from-top-2 duration-100">
                    <div className="font-semibold text-[var(--zcp-text-primary)] mb-1 flex items-center gap-1.5">
                      <span className="codicon codicon-info text-blue-400" />
                      Tab-Stops & Snippet Syntax Guide
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] leading-relaxed opacity-90">
                      <div>• <code className="text-yellow-400">$1, $2, $3</code>: Tab stops where the cursor jumps when pressing Tab.</div>
                      <div>• <code className="text-yellow-400">{"${1:default}"}</code>: Placeholders with a default value.</div>
                      <div>• <code className="text-yellow-400">$0</code>: The final cursor position after exiting the snippet.</div>
                      <div>• Example: <code className="text-yellow-400">{"for (int i = 0; i < ${1:n}; i++) { $0 }"}</code></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Code Editor */}
              <div className="flex-1 flex flex-col gap-1 min-h-0">
                <label className="text-[10px] font-semibold text-[var(--zcp-text-secondary)] uppercase tracking-wider shrink-0">
                  Code Body *
                </label>
                <div className="flex-1 min-h-0 relative">
                  <SnippetEditor
                    value={code}
                    onChange={setCode}
                    language={language}
                    className="absolute inset-0"
                  />
                </div>
              </div>

              {/* Error / Warning Alert */}
              {(errorMsg || triggerValidation) && (
                <div className="text-[11px] text-red-400 bg-red-950/20 border border-red-900/40 rounded p-2 shrink-0 font-sans">
                  {triggerValidation || errorMsg}
                </div>
              )}

              {/* Save Success Alert */}
              {saveSuccess && (
                <div className="text-[11px] text-green-400 bg-green-950/20 border border-green-900/40 rounded p-2 shrink-0 font-sans flex items-center gap-1.5">
                  <span className="codicon codicon-pass text-[12px]" />
                  Snippet saved successfully!
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 shrink-0 border-t border-[var(--zcp-border,#333)] pt-3 mt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-1.5 bg-[#252526] border border-[var(--zcp-border,#333)] hover:bg-[#2e2e2f] text-xs font-semibold text-[var(--zcp-text-secondary)] rounded transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!!triggerValidation}
                  className={`px-4 py-1.5 bg-[var(--zcp-accent,#007acc)] text-white font-semibold rounded text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    triggerValidation ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95'
                  }`}
                >
                  <span className="codicon codicon-save text-[11px]" />
                  Save Snippet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
