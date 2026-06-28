import React from 'react';
import { Verdict } from '../../types/testcase';

export type TestcaseStatus = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'Running' | 'Queued' | 'Skipped' | 'Pending';

export function getStatusFromVerdict(verdict: Verdict | null): TestcaseStatus {
  if (verdict === 'PENDING') return 'Running';
  if (verdict === 'QUEUED') return 'Queued';
  if (verdict === 'SKIPPED') return 'Skipped';
  if (verdict === 'AC') return 'AC';
  if (verdict === 'WA') return 'WA';
  if (verdict === 'TLE') return 'TLE';
  if (verdict === 'MLE') return 'MLE';
  if (verdict === 'RE') return 'RE';
  if (verdict === 'CE') return 'CE';
  if (verdict === null) return 'Pending';
  return 'Pending';
}

export function getStatusBorderColor(status: TestcaseStatus): string {
  switch (status) {
    case 'AC': return 'border-l-[#22c55e]';
    case 'WA': return 'border-l-[#ef4444]';
    case 'TLE': return 'border-l-[#6b7280]';
    case 'CE': return 'border-l-[#ef4444]';
    case 'MLE': return 'border-l-[#eab308]';
    case 'RE': return 'border-l-[#eab308]';
    case 'Running': return 'border-l-[#eab308]';
    case 'Queued': return 'border-l-[rgba(255,255,255,0.2)]';
    default: return 'border-l-[var(--zcp-border)]';
  }
}

interface TestcaseStatusBadgeProps {
  status: TestcaseStatus;
  hasResult: boolean;
  timeMs: number;
  memoryKb: number;
}

export const TestcaseStatusBadge: React.FC<TestcaseStatusBadgeProps> = ({
  status,
  hasResult,
  timeMs,
  memoryKb,
}) => {
  if (status === 'Running' || status === 'Queued') {
    return (
      <span className="text-[#ffff00] text-[12px] font-medium shrink-0 animate-pulse ml-2">
        {status === 'Running' ? 'Running...' : 'Queued...'}
      </span>
    );
  }

  if (hasResult) {
    return (
      <>
        <span className={`text-[12px] font-bold shrink-0 ml-2 ${
          status === 'AC' ? 'text-[#22c55e]' :
          status === 'WA' ? 'text-[#ef4444]' :
          status === 'TLE' ? 'text-[#6b7280]' :
          status === 'MLE' || status === 'RE' ? 'text-[#eab308]' :
          'text-[#ef4444]'
        }`}>
          {status === 'AC' ? 'AC' :
           status === 'WA' ? 'WA' :
           status === 'TLE' ? 'TLE' :
           status === 'MLE' ? 'MLE' :
           status === 'RE' ? 'RTE' :
           status === 'CE' ? 'CE' : status}
        </span>
        {(timeMs >= 0 || memoryKb > 0) && (
          <span className="text-[var(--zcp-text-secondary)] text-[11px] font-normal shrink-0 ml-2">
            (
            {timeMs >= 0 ? (status === 'TLE' ? `${Math.round(timeMs)}+ms` : `${Math.round(timeMs)}ms`) : ''}
            {timeMs >= 0 && memoryKb > 0 ? ', ' : ''}
            {memoryKb > 0 ? `${Math.round(memoryKb / 1024)}MB` : ''}
            )
          </span>
        )}
      </>
    );
  }

  return (
    <span className="text-[var(--zcp-text-muted)] text-[12px] shrink-0 ml-2">
      {status === 'Skipped' ? 'Skipped' : 'Pending'}
    </span>
  );
};
