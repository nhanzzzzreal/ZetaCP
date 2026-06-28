import React from 'react';

interface SnippetFormFieldsProps {
  trigger: string;
  setTrigger: (val: string) => void;
  language: 'cpp' | 'python';
  setLanguage: (val: 'cpp' | 'python') => void;
  description: string;
  setDescription: (val: string) => void;
  isDefault: number;
  setIsDefault: (val: number) => void;
  showGuide: boolean;
  setShowGuide: (val: boolean) => void;
  setErrorMsg: (val: string | null) => void;
}

export const SnippetFormFields: React.FC<SnippetFormFieldsProps> = ({
  trigger,
  setTrigger,
  language,
  setLanguage,
  description,
  setDescription,
  isDefault,
  setIsDefault,
  showGuide,
  setShowGuide,
  setErrorMsg,
}) => {
  return (
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
          className="w-full bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] font-mono focus-visible-outline"
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
          className="w-full bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] focus:outline-none focus:border-[var(--zcp-focus-border)] cursor-pointer focus-visible-outline"
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
          className="w-full bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--zcp-text-primary)] placeholder-[var(--zcp-text-muted)] focus:outline-none focus:border-[var(--zcp-focus-border)] focus-visible-outline"
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
            className="w-3.5 h-3.5 accent-[var(--zcp-accent)] cursor-pointer"
          />
          <label htmlFor="is_default" className="text-[11px] text-[var(--zcp-text-secondary)] select-none cursor-pointer">
            Set as default template
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="text-[11px] text-[var(--zcp-text-muted)] hover:text-[var(--zcp-text-active)] flex items-center gap-1 cursor-pointer transition-colors bg-transparent border-none outline-none"
        >
          <span className="codicon codicon-question text-[12px]" />
          {showGuide ? "Hide Guide" : "Show Guide"}
        </button>
      </div>

      {/* Collapsible Tab-Stops & Snippet Syntax Guide */}
      {showGuide && (
        <div className="bg-[var(--zcp-bg-sidebar)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] p-2.5 col-span-2 text-[11px] text-[var(--zcp-text-secondary)] animate-in slide-in-from-top-2 duration-100">
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
  );
};

export const validateTriggerRegex = (trigger: string): string | null => {
  if (!trigger.trim()) return 'Trigger is required.';
  if (/\s/.test(trigger)) return 'Trigger should not contain spaces.';
  if (!/^[a-zA-Z0-9_\-]+$/.test(trigger)) {
    return 'Trigger should only contain alphanumeric characters, underscores, or hyphens.';
  }
  return null;
};
