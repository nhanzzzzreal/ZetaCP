// src/lib/tauri-bridge/calculator.ts

import { invoke } from '@tauri-apps/api/core';

export interface CalcResult {
  result: string;
  info?: string;
  warning?: string;
  execTimeUs: number;
  vars: Record<string, string>;
}

export const evalCpExpr = async (
  expr: string,
  modVal?: string,
  ansVal?: string,
  vars?: Record<string, string>
): Promise<CalcResult> => {
  return await invoke<CalcResult>('eval_cp_expr', {
    expr,
    modVal: modVal || null,
    ansVal: ansVal || null,
    vars: vars || null,
  });
};
