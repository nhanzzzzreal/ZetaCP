import React from 'react';

interface SnippetEditorActionsProps {
  onClose: () => void;
  triggerValidation: string | null;
}

export const SnippetEditorActions: React.FC<SnippetEditorActionsProps> = ({
  onClose,
  triggerValidation,
}) => {
  return (
    <div className="flex items-center justify-end gap-2 shrink-0 border-t border-[var(--zcp-border)] pt-3 mt-1">
      <button
        type="button"
        onClick={onClose}
        className="px-3.5 py-1.5 bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] hover:bg-[var(--zcp-hover-bg)] text-xs font-semibold text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] transition-all cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!!triggerValidation}
        className={`px-4 py-1.5 bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] font-semibold rounded-[var(--zcp-radius-sm)] text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
          triggerValidation ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95'
        }`}
      >
        <span className="codicon codicon-save text-[11px]" />
        Save Snippet
      </button>
    </div>
  );
};
