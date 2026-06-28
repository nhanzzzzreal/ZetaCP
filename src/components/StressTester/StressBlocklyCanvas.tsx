// src/components/StressTester/StressBlocklyCanvas.tsx

import React, { useRef, useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useStressTestStore } from '../../stores/useStressTestStore';
import { useBlockly } from './useBlockly';

const StressBlocklyInner: React.FC<{ visible: boolean }> = ({ visible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const solPath = useStressTestStore((s) => s.solPath);
  const genPath = useStressTestStore((s) => s.genPath);
  const genMode = useStressTestStore((s) => s.genMode);
  const rootPath = useProjectStore((s) => s.rootPath);

  useBlockly({ containerRef, solPath, rootPath, genPath, genMode });

  return (
    <div
      style={{ display: visible ? 'block' : 'none' }}
      className="w-full h-full min-h-0 relative bg-[#1e1e1e] overflow-hidden"
    >
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

export const StressBlocklyCanvas: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (visible && !hasMounted) {
      setHasMounted(true);
    }
  }, [visible, hasMounted]);

  if (!hasMounted) return null;

  return <StressBlocklyInner visible={visible} />;
};
