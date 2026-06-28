// src/components/TestcasePanel/SubtaskForm.tsx

import React, { useState } from 'react';

interface SubtaskFormProps {
  onAddSubtask: (name: string, maxScore: number) => Promise<void>;
  onClose: () => void;
}

export const SubtaskForm: React.FC<SubtaskFormProps> = ({ onAddSubtask, onClose }) => {
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [newSubtaskScoreStr, setNewSubtaskScoreStr] = useState('20');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskName.trim()) {
      return;
    }

    const score = parseInt(newSubtaskScoreStr, 10) || 0;
    await onAddSubtask(newSubtaskName, score);
    setNewSubtaskName('');
    setNewSubtaskScoreStr('20');
    onClose();
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="p-3 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] flex flex-col gap-2 animate-in slide-in-from-bottom duration-[var(--zcp-duration)]"
    >
      <span className="text-[11px] font-medium text-[var(--zcp-text-primary)] mb-1">Create New Subtask</span>
      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          required
          placeholder="Subtask Name (e.g., Subtask 3...)"
          value={newSubtaskName}
          onChange={e => setNewSubtaskName(e.target.value)}
          className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs px-2.5 py-1 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] focus-visible-outline"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--zcp-text-secondary)]">Max Points:</span>
            <input
              type="text"
              required
              value={newSubtaskScoreStr}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d+$/.test(val)) {
                  setNewSubtaskScoreStr(val);
                }
              }}
              className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] text-xs w-14 px-1.5 py-0.5 rounded-[var(--zcp-radius-sm)] text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] text-center focus-visible-outline"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="h-[24px] px-2.5 text-[11px] font-medium text-[var(--zcp-text-secondary)] hover:text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] hover:bg-[var(--zcp-hover-bg)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-[24px] px-3 bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] rounded-[var(--zcp-radius-sm)] text-[11px] font-medium transition active:scale-95 cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
