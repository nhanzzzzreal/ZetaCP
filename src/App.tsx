// src/App.tsx

import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { DocsViewerWindow } from './components/DocsViewer/DocsViewerWindow';
import { StandaloneOverlayWindow } from './components/Overlay/StandaloneOverlayWindow';
import { MainApp } from './components/MainApp';
import './App.css';

function App() {
  const [windowLabel] = useState<string>(() => {
    try {
      return getCurrentWindow().label;
    } catch (e) {
      console.error('Failed to get window label:', e);
      return 'main';
    }
  });

  useEffect(() => {
    const disableAutofill = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.classList.contains('blocklyHtmlInput'))) {
        target.setAttribute('autocomplete', 'off');
        target.setAttribute('autocorrect', 'off');
        target.setAttribute('autocapitalize', 'off');
        target.setAttribute('spellcheck', 'false');
      }
    };
    document.addEventListener('focusin', disableAutofill, true);
    document.addEventListener('pointerdown', disableAutofill, true);
    return () => {
      document.removeEventListener('focusin', disableAutofill, true);
      document.removeEventListener('pointerdown', disableAutofill, true);
    };
  }, []);

  if (windowLabel.startsWith('docs-window-')) {
    return <DocsViewerWindow docsType={windowLabel.replace('docs-window-', '')} />;
  }
  if (windowLabel.startsWith('overlay-widget-')) {
    return <StandaloneOverlayWindow overlayId={windowLabel.replace('overlay-widget-', '')} />;
  }
  return <MainApp />;
}

export default App;
