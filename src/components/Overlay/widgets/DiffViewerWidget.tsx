// src/components/Overlay/widgets/DiffViewerWidget.tsx

import React, { useEffect, useState } from 'react';
import { Columns2, AlignJustify, CheckCircle2 } from 'lucide-react';
import { computeDiff } from '../../../lib/tauri-bridge';
import { MergeEditor, UnifiedEditor, DiffLine } from './DiffEditors';

type Layout = 'split' | 'unified';

interface DiffViewerWidgetProps {
  id: string;
  content: string; // JSON string chứa { testcaseId, expected, actual }
}

export const DiffViewerWidget: React.FC<DiffViewerWidgetProps> = ({ content }) => {
  const [layout, setLayout] = useState<Layout>('split');
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsedData, setParsedData] = useState<{ expected: string; actual: string } | null>(null);

  useEffect(() => {
    async function loadDiff() {
      try {
        setLoading(true);
        const data = JSON.parse(content);
        const expected = data.expected || '';
        const actual = data.actual || '';
        setParsedData({ expected, actual });

        const diffs = await computeDiff(expected, actual);
        setDiffLines(diffs);
      } catch (err) {
        console.error('Error loading diff widget:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDiff();
  }, [content]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 bg-[#2a2a2a]">
        Loading comparison data...
      </div>
    );
  }

  const { expected, actual } = parsedData || { expected: '', actual: '' };
  const totalDiff  = diffLines.filter(l => l.expected !== l.actual).length;
  const totalLines = diffLines.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#2a2a2a] overflow-hidden select-none">
      {/* Sub-header toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2b2b2b]/30 bg-[#2a2a2a] shrink-0">
        <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
          {totalDiff}/{totalLines} lines differ
        </span>
        <div className="flex items-center bg-[var(--bg-medium)] border border-[var(--bg-secondary)] rounded p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setLayout('split')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              layout === 'split'
                ? 'bg-indigo-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Columns2 className="w-3 h-3" />
            Split
          </button>
          <button
            type="button"
            onClick={() => setLayout('unified')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              layout === 'unified'
                ? 'bg-indigo-600 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <AlignJustify className="w-3 h-3" />
            Unified
          </button>
        </div>
      </div>

      {/* Column Labels */}
      {layout === 'split' ? (
        <div className="flex shrink-0 border-b border-[var(--bg-secondary)] bg-[var(--bg-medium)]/40 text-[9px] font-bold uppercase tracking-widest text-neutral-500">
          <div className="flex-1 px-3 py-1 flex items-center gap-1.5 border-r border-[var(--bg-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            Expected
          </div>
          <div className="flex-1 px-3 py-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Actual
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-1 border-b border-[var(--bg-secondary)] bg-[var(--bg-medium)]/40 text-[9px] uppercase tracking-widest text-neutral-500 shrink-0">
          <span className="flex items-center gap-1.5"><span className="font-mono text-red-400">-</span> Expected</span>
          <span>•</span>
          <span className="flex items-center gap-1.5"><span className="font-mono text-green-400">+</span> Actual</span>
        </div>
      )}

      {/* Main Diff Content */}
      <div className="flex-1 min-h-0 bg-[#2a2a2a] relative">
        {diffLines.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">
            No diff data available.
          </div>
        ) : totalDiff === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#2a2a2a]">
            <CheckCircle2 className="w-8 h-8 text-green-500/80" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-green-400">All lines match!</span>
            <span className="text-[10px] text-neutral-500">{totalLines} lines — No differences.</span>
          </div>
        ) : (
          <div className="h-full w-full">
            {layout === 'unified'
              ? <UnifiedEditor diffLines={diffLines} />
              : <MergeEditor expected={expected} actual={actual} />
            }
          </div>
        )}
      </div>
    </div>
  );
};
