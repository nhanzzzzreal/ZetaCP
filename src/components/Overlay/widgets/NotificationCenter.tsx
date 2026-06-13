// src/components/Overlay/widgets/NotificationCenter.tsx

import React, { useState } from 'react';
import { 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Terminal, 
  Cpu, 
  Layers, 
  Search, 
  Trash2,
  ListRestart
} from 'lucide-react';
import { useOverlayStore, OverlayLog } from '../../../stores/useOverlayStore';
import { useTestcaseStore } from '../../../stores/useTestcaseStore';

export const NotificationCenter: React.FC = () => {
  const { logs, clearLogs } = useOverlayStore();
  const { results, metas } = useTestcaseStore();

  const [activeTab, setActiveTab] = useState<'all' | 'compiler' | 'judge'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering logic
  const filteredLogs = logs.filter((log: OverlayLog) => {
    // Search query match
    const matchesSearch = 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Tab filter
    if (activeTab === 'all') return true;
    return log.source === activeTab;
  });

  const getLogIcon = (type: OverlayLog['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  const getSourceBadge = (source: OverlayLog['source']) => {
    switch (source) {
      case 'compiler':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#1e293b] text-indigo-300 border border-indigo-900 rounded flex items-center gap-1">
            <Terminal className="w-2.5 h-2.5" />
            COMPILER
          </span>
        );
      case 'judge':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#162a22] text-emerald-300 border border-emerald-900 rounded flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5" />
            JUDGE
          </span>
        );
      case 'system':
      default:
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#27272a] text-zinc-300 border border-zinc-700 rounded flex items-center gap-1">
            <Layers className="w-2.5 h-2.5" />
            SYSTEM
          </span>
        );
    }
  };

  // Compile Stderr diagnostics
  const compileLogs = logs.filter((l: OverlayLog) => l.source === 'compiler' && l.type === 'error');

  // Testcase Run diagnostics
  const totalTests = metas.size;
  const resultsArr = Array.from(results.values());
  const acCount = resultsArr.filter(r => r.lastStatus === 'AC').length;
  const waCount = resultsArr.filter(r => r.lastStatus === 'WA').length;
  const tleCount = resultsArr.filter(r => r.lastStatus === 'TLE').length;
  const mleCount = resultsArr.filter(r => r.lastStatus === 'MLE').length;
  const reCount = resultsArr.filter(r => r.lastStatus === 'RE').length;
  const ceCount = resultsArr.filter(r => r.lastStatus === 'CE').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs overflow-hidden">
      {/* Diagnostics summary bar */}
      <div className="bg-[#202020] border-b border-[#2d2d2d] px-3 py-2 flex flex-wrap gap-3 items-center shrink-0">
        <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Judge Status:</span>
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-neutral-400">Total: {totalTests} |</span>
          <span className="text-emerald-400 font-bold">AC: {acCount}</span>
          <span className="text-rose-400 font-bold">WA: {waCount}</span>
          <span className="text-amber-500 font-bold">TLE: {tleCount}</span>
          <span className="text-cyan-400 font-bold">MLE: {mleCount}</span>
          <span className="text-red-500 font-bold">RE: {reCount}</span>
          <span className="text-orange-400 font-bold">CE: {ceCount}</span>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="h-9 px-3 border-b border-[#2d2d2d] flex items-center justify-between bg-[#1f1f1f] shrink-0">
        <div className="flex items-stretch h-full gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 flex items-center border-b-2 text-xs font-semibold transition-all ${
              activeTab === 'all' 
                ? 'border-indigo-500 text-indigo-400 bg-neutral-800/20' 
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            History ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('compiler')}
            className={`px-3 flex items-center border-b-2 text-xs font-semibold transition-all ${
              activeTab === 'compiler'
                ? 'border-indigo-500 text-indigo-400 bg-neutral-800/20'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Compilation ({compileLogs.length} Errors)
          </button>
          <button
            onClick={() => setActiveTab('judge')}
            className={`px-3 flex items-center border-b-2 text-xs font-semibold transition-all ${
              activeTab === 'judge'
                ? 'border-indigo-500 text-indigo-400 bg-neutral-800/20'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Judge ({resultsArr.length} Runs)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex items-center bg-[#252526] border border-[#2d2d2d] rounded px-2 py-1 gap-1.5 focus-within:border-indigo-500 transition-colors w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-0 outline-none p-0 text-xs text-neutral-200 placeholder-neutral-500 focus:ring-0 w-full"
            />
          </div>

          {/* Clear logs */}
          <button
            onClick={clearLogs}
            className="p-1.5 rounded hover:bg-[#2b2d2e] text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs List Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 select-text selection:bg-[#264f78]">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log: OverlayLog) => (
            <div 
              key={log.id} 
              className={`p-2 rounded border border-[#2b2b2b] bg-[#1e1e1e] hover:bg-neutral-800/30 transition-colors duration-150 flex flex-col gap-1`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {getLogIcon(log.type)}
                  <span className="font-semibold text-neutral-200 truncate">{log.message}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  {getSourceBadge(log.source)}
                  <span className="text-[10px] text-neutral-500 font-mono">{log.time}</span>
                </div>
              </div>
              
              {log.details && (
                <pre 
                  className="mt-1 p-1.5 bg-[#151515] border border-[#27272a] text-neutral-400 font-mono text-[10px] rounded overflow-x-auto whitespace-pre-wrap max-h-32 select-text selection:bg-[#264f78]"
                >
                  {log.details}
                </pre>
              )}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-neutral-500 select-none">
            <ListRestart className="w-8 h-8 opacity-40 animate-pulse text-indigo-400" />
            <span>No matching messages or logs found.</span>
          </div>
        )}
      </div>
    </div>
  );
};
