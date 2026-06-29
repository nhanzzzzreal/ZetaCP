import { 
  OverlayState, 
  loadOverlays, 
  saveOverlaysBackend, 
  deleteOverlayBackend 
} from '../lib/tauri-bridge';


export const getDefaultTitle = (type: string, title?: string): string => {
  if (title) return title;
  const defaultTitles: Record<string, string> = {
    scratchpad: 'Sketchpad',
    md: 'Markdown Viewer',
    image: 'Image Viewer',
    pdf: 'PDF Viewer',
    word: 'Word Document',
    notes: 'Notes',
    calculator: 'CP Calculator'
  };
  return defaultTitles[type] || 'Overlay Window';
};

export const getDefaultContent = (type: string, content?: string): string => {
  if (content) return content;
  if (type === 'scratchpad') return '[]';
  if (type === 'notes') return 'New note...';
  return '';
};

export const getDefaultDimensions = (type: string): { w: number; h: number } => {
  const defaultDimensions: Record<string, { w: number; h: number }> = {
    scratchpad: { w: 500, h: 400 },
    notes: { w: 450, h: 320 },
    md: { w: 450, h: 450 },
    image: { w: 480, h: 360 },
    pdf: { w: 600, h: 500 },
    word: { w: 400, h: 260 },
    diff: { w: 750, h: 500 },
    calculator: { w: 380, h: 510 }
  };
  return defaultDimensions[type] || { w: 400, h: 300 };
};

export const createOverlayState = (params: {
  filePath: string;
  type: string;
  title: string;
  content: string;
  staggerIndex: number;
  maxZ: number;
  dim: { w: number; h: number };
}): OverlayState => {
  const initialX = 100 + (params.staggerIndex * 35) % 250;
  const initialY = 80 + (params.staggerIndex * 30) % 200;
  return {
    id: crypto.randomUUID(),
    filePath: params.filePath,
    type: params.type,
    title: params.title,
    content: params.content,
    x: initialX,
    y: initialY,
    width: params.dim.w,
    height: params.dim.h,
    isMinimized: false,
    isPinned: false,
    opacity: 1.0,
    isVisible: true,
    zIndex: params.maxZ + 1
  };
};

export const saveOverlayState = async (filePath: string, overlays: OverlayState[]): Promise<void> => {
  try {
    if (!filePath || filePath === 'GLOBAL') return;
    const fileOverlays = overlays.filter(o => o.filePath === filePath && o.filePath !== 'GLOBAL');
    await saveOverlaysBackend(filePath, fileOverlays);
    const { emit } = await import('@tauri-apps/api/event');
    await emit('overlays-updated');
  } catch (err) {
    console.error(`[useOverlayStore] Failed to save overlays:`, err);
  }
};

export const mapOverlays = (loaded: OverlayState[]): OverlayState[] => {
  return loaded.map((o, idx) => ({
    ...o,
    zIndex: o.zIndex || (idx + 1),
    isVisible: o.isVisible !== undefined ? o.isVisible : true
  }));
};

export const loadAndSetOverlays = async (
  filePath: string,
  set: (state: any) => void
): Promise<void> => {
  const loaded = await loadOverlays(filePath);
  const mapped = mapOverlays(loaded);
  set((state: any) => ({
    overlays: [...state.overlays, ...mapped],
    loadedFilePaths: [...state.loadedFilePaths, filePath],
    currentFilePath: filePath
  }));
};

export const deleteOverlayState = async (
  filePath: string,
  id: string,
  overlays: OverlayState[]
): Promise<void> => {
  try {
    await deleteOverlayBackend(filePath, id);
    const { emit } = await import('@tauri-apps/api/event');
    await emit('overlays-updated');
  } catch (err) {
    console.error(`[useOverlayStore] Failed to delete overlay from backend:`, err);
    await saveOverlayState(filePath, overlays);
  }
};
