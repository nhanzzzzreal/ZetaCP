import React, { useState, useEffect, useMemo } from 'react';
import { useSnippetStore } from '../../stores/useSnippetStore';
import { SnippetEditor } from './SnippetEditor';
import { SnippetFormFields, validateTriggerRegex } from './SnippetFormFields';
import { SnippetEditorHeader } from './SnippetEditorHeader';
import { SnippetEditorActions } from './SnippetEditorActions';

interface SnippetEditorDialogProps {
  isOpen: boolean;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  isCreatingNew: boolean;
  setIsCreatingNew: (val: boolean) => void;
  onClose: () => void;
}

export const SnippetEditorDialog: React.FC<SnippetEditorDialogProps> = ({
  isOpen,
  selectedId,
  setSelectedId,
  isCreatingNew,
  setIsCreatingNew,
  onClose,
}) => {
  const { snippets, saveSnippet, deleteSnippet } = useSnippetStore();

  const [trigger, setTrigger] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<'cpp' | 'python'>('cpp');
  const [isDefault, setIsDefault] = useState<number>(0);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedSnippet = useMemo(() => {
    if (selectedId === null) return null;
    return snippets.find((s) => s.id === selectedId) || null;
  }, [selectedId, snippets]);

  useEffect(() => {
    if (isOpen) {
      if (selectedSnippet) {
        setTrigger(selectedSnippet.trigger);
        setDescription(selectedSnippet.description || '');
        setCode(selectedSnippet.code);
        setLanguage(selectedSnippet.language as 'cpp' | 'python');
        setIsDefault(selectedSnippet.is_default ?? 0);
        setErrorMsg(null);
        setSaveSuccess(false);
      } else {
        setTrigger('');
        setDescription('');
        setCode('');
        setLanguage('cpp');
        setIsDefault(0);
        setErrorMsg(null);
        setSaveSuccess(false);
      }
    }
  }, [isOpen, selectedSnippet]);

  const triggerValidation = useMemo(() => {
    const regexError = validateTriggerRegex(trigger);
    if (regexError) return regexError;
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

  const selectNewSnippet = (triggerVal: string, langVal: string) => {
    useSnippetStore.getState().loadSnippets().then(() => {
      const newlyCreated = useSnippetStore.getState().snippets.find(
        (s) => s.trigger === triggerVal && s.language === langVal
      );
      if (newlyCreated) setSelectedId(newlyCreated.id);
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    if (triggerValidation || !code.trim()) {
      setErrorMsg(triggerValidation || 'Snippet code cannot be empty.');
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
      if (isCreatingNew) {
        setIsCreatingNew(false);
        setTimeout(() => selectNewSnippet(payload.trigger, payload.language), 100);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (selectedId === null) return;
    if (!window.confirm('Are you sure you want to delete this snippet?')) return;
    try {
      await deleteSnippet(selectedId);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[var(--zcp-bg-editor)] border border-[var(--zcp-border)] rounded-[var(--zcp-radius-sm)] w-[750px] max-w-[95vw] h-[580px] max-h-[90vh] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 p-5 animate-in fade-in zoom-in-95 duration-150">
        
        <SnippetEditorHeader
          isCreatingNew={isCreatingNew}
          onDelete={handleDelete}
          onClose={onClose}
        />

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 gap-4">
          <SnippetFormFields
            trigger={trigger}
            setTrigger={setTrigger}
            language={language}
            setLanguage={setLanguage}
            description={description}
            setDescription={setDescription}
            isDefault={isDefault}
            setIsDefault={setIsDefault}
            showGuide={showGuide}
            setShowGuide={setShowGuide}
            setErrorMsg={setErrorMsg}
          />

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
            <div className="text-[11px] text-red-400 bg-red-950/20 border border-red-900/40 rounded-[var(--zcp-radius-sm)] p-2 shrink-0 font-sans">
              {triggerValidation || errorMsg}
            </div>
          )}

          {/* Save Success Alert */}
          {saveSuccess && (
            <div className="text-[11px] text-green-400 bg-green-950/20 border border-green-900/40 rounded-[var(--zcp-radius-sm)] p-2 shrink-0 font-sans flex items-center gap-1.5">
              <span className="codicon codicon-pass text-[12px]" />
              Snippet saved successfully!
            </div>
          )}

          <SnippetEditorActions
            onClose={onClose}
            triggerValidation={triggerValidation}
          />
        </form>
      </div>
    </div>
  );
};
