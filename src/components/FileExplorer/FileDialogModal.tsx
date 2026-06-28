import React, { useEffect, useState } from 'react';

interface FileDialogModalProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}

export const FileDialogModal: React.FC<FileDialogModalProps> = React.memo(({
  isOpen,
  title,
  initialValue,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] p-4 w-[280px] shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-[var(--zcp-duration)]">
        <span className="text-xs font-bold text-[var(--zcp-text-primary)]">
          {title}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter name..."
          className="w-full px-2 py-1.5 text-xs bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] focus:outline-none focus:border-[var(--zcp-focus-border)] text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus-visible-outline"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(value);
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="flex justify-end gap-2 text-[11px] font-semibold">
          <button
            onClick={onCancel}
            className="px-2.5 py-1 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-bg-sidebar)] text-[var(--zcp-text-primary)] hover:bg-[var(--zcp-hover-bg)] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(value)}
            className="px-2.5 py-1 rounded-[var(--zcp-radius-sm)] bg-[var(--zcp-accent)] text-[var(--zcp-text-active)] hover:brightness-[1.05] transition-all duration-[var(--zcp-duration)] ease-[var(--zcp-easing)] focus-visible-outline cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
});
FileDialogModal.displayName = 'FileDialogModal';
