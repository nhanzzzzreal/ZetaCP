import React, { useRef } from 'react';
import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { useOverlayStore } from '../../../stores/useOverlayStore';

interface ScratchpadCanvasProps {
  id: string;
  initialContent: string;
}

export const ScratchpadCanvas: React.FC<ScratchpadCanvasProps> = ({ id, initialContent }) => {
  const updateContent = useOverlayStore((state) => state.updateContent);
  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<any>(null);

  // Xử lý lưu và đồng bộ khi editor thay đổi
  const handleMount = (editor: Editor) => {
    editorRef.current = editor;

    // Load bản vẽ cũ từ DB nếu tồn tại
    if (initialContent && initialContent !== '[]' && initialContent.trim() !== '') {
      try {
        const snapshot = JSON.parse(initialContent);
        editor.loadSnapshot(snapshot);
      } catch (err) {
        console.warn('Error loading tldraw snapshot:', err);
      }
    }

    // Lắng nghe thay đổi để auto save (debounced 600ms)
    const unsubscribe = editor.store.listen(
      (update) => {
        // Chỉ lưu khi có thay đổi từ hành động vẽ của user
        if (update.source === 'user') {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          
          saveTimeoutRef.current = setTimeout(() => {
            try {
              const snapshot = editor.getSnapshot();
              const snapshotStr = JSON.stringify(snapshot);
              updateContent(id, snapshotStr);
            } catch (err) {
              console.error('Error saving tldraw snapshot:', err);
            }
          }, 600);
        }
      },
      { scope: 'document' }
    );

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  };

  return (
    <div className="flex-1 h-full w-full bg-[#2a2a2a] overflow-hidden relative select-none">
      {/* Nhúng Tldraw editor full-size */}
      <Tldraw 
        onMount={handleMount}
      />
    </div>
  );
};
