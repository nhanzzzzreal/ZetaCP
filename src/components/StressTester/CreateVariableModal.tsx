// src/components/StressTester/CreateVariableModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface CreateVariableModalProps {
  isOpen: boolean;
  defaultValue?: string;
  onConfirm: (varName: string) => void;
  onCancel: () => void;
}

export const CreateVariableModal: React.FC<CreateVariableModalProps> = ({
  isOpen,
  defaultValue = '',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-[360px] bg-[#252526] border border-[#3c3c3c] rounded-xl p-5 shadow-2xl text-[#d4d4d4] font-sans relative z-[100000]">
        <h3 className="text-sm font-semibold text-white mb-1">Tạo Biến Mới</h3>
        <p className="text-xs text-[#8e8e8e] mb-4">Nhập tên biến (ví dụ: N, M, K, ans):</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Tên biến..."
            className="w-full px-3 py-2 text-sm bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#4F46E5] transition-colors"
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#2d2d2d] hover:bg-[#383838] text-[#cccccc] transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors shadow-lg shadow-indigo-500/20"
            >
              Tạo biến
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
