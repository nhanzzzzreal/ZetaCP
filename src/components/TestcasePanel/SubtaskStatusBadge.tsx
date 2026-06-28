import React from 'react';
import { TestcaseMeta, TestcaseResult } from '../../types/testcase';

export type SubtaskStatus = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RTE' | 'CE' | 'PENDING' | 'NONE';

export function calculateSubtaskStatus(
  testcases: TestcaseMeta[],
  results: Map<string, TestcaseResult>
): SubtaskStatus {
  const testcasesToCount = testcases.filter(t => t.isActive);
  const totalActive = testcasesToCount.length;
  
  if (totalActive === 0) return 'NONE';

  let hasPending = false;
  let acCount = 0;
  let firstFailStatus: 'WA' | 'TLE' | 'MLE' | 'RTE' | 'CE' | null = null;

  for (const meta of testcasesToCount) {
    const res = results.get(meta.id);
    if (res?.lastStatus === 'PENDING' || res?.lastStatus === 'QUEUED') {
      hasPending = true;
    } else if (res?.lastStatus === 'AC') {
      acCount++;
    } else if (res?.lastStatus) {
      if (!firstFailStatus) {
        if (res.lastStatus === 'RE') {
          firstFailStatus = 'RTE';
        } else if (res.lastStatus === 'MLE') {
          firstFailStatus = 'MLE';
        } else if (res.lastStatus === 'TLE') {
          firstFailStatus = 'TLE';
        } else if (res.lastStatus === 'CE') {
          firstFailStatus = 'CE';
        } else {
          firstFailStatus = 'WA';
        }
      }
    }
  }

  if (hasPending) {
    return 'PENDING';
  }
  if (acCount === totalActive) {
    return 'AC';
  }
  if (firstFailStatus) {
    return firstFailStatus;
  }
  if (acCount < totalActive) {
    return 'WA';
  }

  return 'NONE';
}

interface SubtaskStatusBadgeProps {
  status: SubtaskStatus;
}

export const SubtaskStatusBadge: React.FC<SubtaskStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'AC':
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-[var(--zcp-verdict-ac)] bg-[rgba(34,197,94,0.18)] px-1.5 py-0.5 rounded-[2px] font-sans select-none shrink-0">
          AC
        </span>
      );
    case 'WA':
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-[var(--zcp-verdict-wa)] bg-[rgba(239,68,68,0.18)] px-1.5 py-0.5 rounded-[2px] font-sans select-none shrink-0">
          WA
        </span>
      );
    case 'TLE':
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-[var(--zcp-verdict-tle)] bg-[rgba(107,114,128,0.18)] px-1.5 py-0.5 rounded-[2px] font-sans select-none shrink-0">
          TLE
        </span>
      );
    case 'MLE':
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-[var(--zcp-verdict-mle)] bg-[rgba(234,179,8,0.18)] px-1.5 py-0.5 rounded-[2px] font-sans select-none shrink-0">
          MLE
        </span>
      );
    case 'RTE':
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-[var(--zcp-verdict-re)] bg-[rgba(245,158,11,0.18)] px-1.5 py-0.5 rounded-[2px] font-sans select-none shrink-0">
          RTE
        </span>
      );
    case 'CE':
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-[var(--zcp-verdict-ce)] bg-[rgba(107,114,128,0.18)] px-1.5 py-0.5 rounded-[2px] font-sans select-none shrink-0">
          CE
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-[var(--zcp-accent)] bg-[rgba(0,122,204,0.18)] animate-pulse px-1.5 py-0.5 rounded-[2px] font-sans select-none shrink-0">
          RUNNING
        </span>
      );
    default:
      return null;
  }
};
