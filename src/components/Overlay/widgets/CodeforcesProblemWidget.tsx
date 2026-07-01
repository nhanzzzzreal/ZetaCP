// src/components/Overlay/widgets/CodeforcesProblemWidget.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Overlay } from '../../../stores/useOverlayStore';

interface CodeforcesProblemWidgetProps {
  overlay: Overlay;
}

function loadKaTeX(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).katex && (window as any).renderMathInElement) {
      resolve({
        katex: (window as any).katex,
        renderMathInElement: (window as any).renderMathInElement
      });
      return;
    }
    
    // Load CSS
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(link);
    }
    
    // Load main KaTeX JS
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
    script.async = true;
    script.onload = () => {
      // Load auto-render JS
      const renderScript = document.createElement('script');
      renderScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js';
      renderScript.async = true;
      renderScript.onload = () => {
        resolve({
          katex: (window as any).katex,
          renderMathInElement: (window as any).renderMathInElement
        });
      };
      renderScript.onerror = () => reject(new Error('Failed to load KaTeX auto-render script'));
      document.body.appendChild(renderScript);
    };
    script.onerror = () => reject(new Error('Failed to load KaTeX script'));
    document.body.appendChild(script);
  });
}

export const CodeforcesProblemWidget: React.FC<CodeforcesProblemWidgetProps> = ({ overlay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [katexLoaded, setKatexLoaded] = useState(false);

  useEffect(() => {
    loadKaTeX()
      .then(() => setKatexLoaded(true))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (katexLoaded && containerRef.current && (window as any).renderMathInElement) {
      try {
        (window as any).renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
      }
    }
  }, [katexLoaded, overlay.content]);

  // Replace triple dollars with single dollars for inline math
  const cleanContent = (overlay.content || '').replace(/\$\$\$/g, '$');

  const containerClasses = "w-full h-full bg-[#1e1e1e] text-neutral-200 overflow-y-auto p-4 select-text font-sans scrollbar-thin " + 
    "[&_.problem-statement]:flex [&_.problem-statement]:flex-col [&_.problem-statement]:gap-3 " +
    "[&_.header]:flex [&_.header]:flex-col [&_.header]:items-center [&_.header]:gap-1 [&_.header]:mb-4 [&_.header]:border-b [&_.header]:border-neutral-700 [&_.header]:pb-3 " +
    "[&_.title]:text-xl [&_.title]:font-bold [&_.title]:text-white " +
    "[&_.time-limit]:text-[11px] [&_.time-limit]:text-neutral-400 " +
    "[&_.memory-limit]:text-[11px] [&_.memory-limit]:text-neutral-400 " +
    "[&_.input-file]:text-[11px] [&_.input-file]:text-neutral-400 " +
    "[&_.output-file]:text-[11px] [&_.output-file]:text-neutral-400 " +
    "[&_.property-title]:font-semibold [&_.property-title]:text-neutral-300 " +
    "[&_p]:my-2 [&_p]:leading-relaxed [&_p]:text-neutral-300 " +
    "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 " +
    "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 " +
    "[&_pre]:bg-neutral-900 [&_pre]:p-2.5 [&_pre]:rounded [&_pre]:font-mono [&_pre]:text-neutral-200 [&_pre]:my-2 [&_pre]:border [&_pre]:border-neutral-800 " +
    "[&_.sample-test]:mt-4 [&_.sample-test]:border [&_.sample-test]:border-neutral-700 [&_.sample-test]:rounded [&_.sample-test]:overflow-hidden " +
    "[&_.sample-test_.input]:bg-neutral-900/50 [&_.sample-test_.input]:p-3 [&_.sample-test_.input]:border-b [&_.sample-test_.input]:border-neutral-800 " +
    "[&_.sample-test_.output]:bg-neutral-900/50 [&_.sample-test_.output]:p-3 " +
    "[&_.sample-test_.title]:text-sm [&_.sample-test_.title]:font-bold [&_.sample-test_.title]:text-neutral-300 [&_.sample-test_.title]:mb-1 [&_.sample-test_.title]:uppercase " +
    "[&_.sample-test_pre]:m-0 [&_.sample-test_pre]:bg-transparent [&_.sample-test_pre]:p-0 [&_.sample-test_pre]:border-none " +
    "[&_.section-title]:text-lg [&_.section-title]:font-bold [&_.section-title]:text-white [&_.section-title]:mt-4 [&_.section-title]:mb-2 [&_.section-title]:border-b [&_.section-title]:border-neutral-800 [&_.section-title]:pb-1";

  return (
    <div className={containerClasses}>
      <div 
        ref={containerRef}
        className="markdown-content problem-statement"
        dangerouslySetInnerHTML={{ __html: cleanContent }}
      />
    </div>
  );
};