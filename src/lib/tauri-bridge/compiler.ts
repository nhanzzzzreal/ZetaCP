import { invoke } from '@tauri-apps/api/core';

export interface CompileResult {
  success: boolean;
  stderr: string;
  binaryPath: string; // matches `binary_path`
  cached: boolean;
  compilerPath: string;
}

export interface CompilerInfo {
  found: boolean;
  path: string;
  version: string;
}

export async function compileFile(args: {
  filePath: string;
  flags: string[];
  projectRoot: string;
}): Promise<CompileResult> {
  return invoke<CompileResult>('compile_file', {
    filePath: args.filePath,
    flags: args.flags,
    projectRoot: args.projectRoot,
  });
}

export async function compileChecker(checkerPath: string, checkerType: string, projectRoot: string): Promise<CompileResult> {
  return invoke<CompileResult>('compile_checker', {
    checkerPath,
    checkerType,
    projectRoot,
  });
}

export async function checkCompiler(compiler: string): Promise<CompilerInfo> {
  return invoke<CompilerInfo>('check_compiler', { compiler });
}
