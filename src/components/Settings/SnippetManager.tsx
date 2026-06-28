// src/components/Settings/SnippetManager.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useSnippetStore } from '../../stores/useSnippetStore';
import { SnippetEditorDialog } from './SnippetEditorDialog';

export const SnippetManager: React.FC = () => {
  const { snippets, loadSnippets } = useSnippetStore();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState<'All' | 'cpp' | 'python'>('All');

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  const handleNewSnippetClick = () => {
    setSelectedId(null);
    setIsCreatingNew(true);
  };

  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      const matchesSearch =
        s.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLang = langFilter === 'All' || s.language === langFilter;
      return matchesSearch && matchesLang;
    });
  }, [snippets, searchQuery, langFilter]);

  const closeModal = () => {
    setSelectedId(null);
    setIsCreatingNew(false);
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

      {/* Editor Modal Dialog */}
      <SnippetEditorDialog
        isOpen={selectedId !== null || isCreatingNew}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        isCreatingNew={isCreatingNew}
        setIsCreatingNew={setIsCreatingNew}
        onClose={closeModal}
      />
    </div>
  );
};
