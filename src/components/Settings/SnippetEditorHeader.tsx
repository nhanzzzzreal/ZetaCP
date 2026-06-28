import React from 'react';

interface SnippetEditorHeaderProps {
  isCreatingNew: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export const SnippetEditorHeader: React.FC<SnippetEditorHeaderProps> = ({
  isCreatingNew,
  onDelete,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-[var(--zcp-border)] pb-3 shrink-0">
      <span className="text-xs font-bold tracking-wider text-[var(--zcp-text-secondary)] uppercase">
        {isCreatingNew ? 'Create New Snippet' : 'Edit Snippet'}
      </span>
      <div className="flex items-center gap-2">
        {!isCreatingNew && (
          <button
            type="button"
            onClick={onDelete}
            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-800/40 rounded-[var(--zcp-radius-sm)] text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1"
          >
            <span className="codicon codicon-trash text-[10px]" />
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-[var(--zcp-hover-bg)] rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-muted)] hover:text-[var(--zcp-text-active)] cursor-pointer flex items-center justify-center"
        >
          <span className="codicon codicon-close text-[14px]" />
        </button>
      </div>
    </div>
  );
};
