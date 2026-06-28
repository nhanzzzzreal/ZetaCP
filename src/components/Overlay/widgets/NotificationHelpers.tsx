import React from 'react';
import { 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Terminal, 
  Cpu, 
  Layers 
} from 'lucide-react';
import { OverlayLog } from '../../../stores/useOverlayStore';

export const getLogIcon = (type: OverlayLog['type']) => {
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

export const getSourceBadge = (source: OverlayLog['source']) => {
  const badgeClasses: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
    compiler: {
      bg: 'bg-[#1e293b]', text: 'text-indigo-300', border: 'border-indigo-900',
      icon: <Terminal className="w-2.5 h-2.5" />, label: 'COMPILER'
    },
    judge: {
      bg: 'bg-[#162a22]', text: 'text-emerald-300', border: 'border-emerald-900',
      icon: <Cpu className="w-2.5 h-2.5" />, label: 'JUDGE'
    },
    system: {
      bg: 'bg-[#27272a]', text: 'text-zinc-300', border: 'border-zinc-700',
      icon: <Layers className="w-2.5 h-2.5" />, label: 'SYSTEM'
    }
  };
  const config = badgeClasses[source] || badgeClasses.system;
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded flex items-center gap-1 ${config.bg} ${config.text} border ${config.border}`}>
      {config.icon}
      {config.label}
    </span>
  );
};
