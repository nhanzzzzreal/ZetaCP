// src/components/TestcasePanel/VerdictCountsRow.tsx

import React from 'react';

interface VerdictCountsRowProps {
  counts: {
    AC: number;
    WA: number;
    TLE: number;
    MLE: number;
    RE: number;
    CE: number;
    Running: number;
    Queued: number;
    Pending: number;
    Skipped: number;
  };
  totalActiveCount: number;
  isRunning: boolean;
}

export const VerdictCountsRow: React.FC<VerdictCountsRowProps> = ({
  counts,
  totalActiveCount,
  isRunning,
}) => {
  const activeCounts = [];
  if (counts.AC > 0) activeCounts.push({ text: `${counts.AC} AC`, color: '#22c55e' });
  if (counts.WA > 0) activeCounts.push({ text: `${counts.WA} WA`, color: '#ef4444' });
  if (counts.TLE > 0) activeCounts.push({ text: `${counts.TLE} TLE`, color: '#6b7280' });
  if (counts.RE > 0) activeCounts.push({ text: `${counts.RE} RTE`, color: '#eab308' });
  if (counts.MLE > 0) activeCounts.push({ text: `${counts.MLE} MLE`, color: '#eab308' });
  if (counts.CE > 0) activeCounts.push({ text: `${counts.CE} CE`, color: '#ef4444' });
  
  if (activeCounts.length === 0) {
    activeCounts.push({ text: `${totalActiveCount} Total`, color: 'var(--zcp-text-secondary)' });
  }

  const elements: React.ReactNode[] = [];
  activeCounts.forEach((c, idx) => {
    if (idx > 0) {
      elements.push(<span key={`sep-${idx}`} className="text-gray-500">|</span>);
    }
    elements.push(
      <span key={`val-${idx}`} style={{ color: c.color }}>
        {c.text}
      </span>
    );
  });

  return (
    <div className="flex items-center justify-between bg-[#333333] border border-[#444444] px-2.5 py-1 rounded-[4px] font-mono text-[11px] font-bold select-none shrink-0 mb-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {elements}
      </div>
      {isRunning && counts.Running > 0 && (
        <span className="text-[10px] text-[#007acc] animate-pulse font-sans font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#007acc] animate-ping" />
          RUNNING ({counts.Running})
        </span>
      )}
    </div>
  );
};
