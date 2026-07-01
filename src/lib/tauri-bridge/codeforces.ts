// src/lib/tauri-bridge/codeforces.ts

import { invoke } from '@tauri-apps/api/core';

export interface CfProblemSample {
  input: string;
  output: string;
}

export interface CfProblemDetails {
  title: string;
  timeLimit: string;
  memoryLimit: string;
  samples: CfProblemSample[];
  htmlDescription: string;
}

export interface CodeforcesConfig {
  filePath: string;
  problemId: string;
  contestId: number;
  problemIndex: string;
  problemUrl: string;
  parsedData: string;
}

export async function codeforcesLogin(): Promise<void> {
  return invoke<void>('codeforces_login');
}

export async function codeforcesVerifySession(): Promise<string | null> {
  return invoke<string | null>('codeforces_verify_session');
}

export async function codeforcesDownloadProblem(url: string): Promise<CfProblemDetails> {
  return invoke<CfProblemDetails>('codeforces_download_problem', { url });
}

export async function codeforcesSubmitSolution(params: {
  url: string;
  contestId: string;
  problemIndex: string;
  langId: string;
  sourceCode: string;
}): Promise<boolean> {
  return invoke<boolean>('codeforces_submit_solution', params);
}

export async function cfSaveProblemMetadata(params: {
  filePath: string;
  problemId: string;
  contestId: number;
  problemIndex: string;
  problemUrl: string;
  parsedData: string;
}): Promise<void> {
  return invoke<void>('cf_save_problem_metadata', params);
}

export async function cfLoadProblemMetadata(filePath: string): Promise<CodeforcesConfig | null> {
  return invoke<CodeforcesConfig | null>('cf_load_problem_metadata', { filePath });
}