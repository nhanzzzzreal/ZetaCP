import { invoke } from '@tauri-apps/api/core';

export async function lspInitialize(execPath: string, args: string[], projectRoot: string): Promise<void> {
  return invoke<void>('lsp_initialize', { execPath, args, projectRoot });
}

export async function lspDidOpen(language: string, filePath: string, content: string): Promise<void> {
  return invoke<void>('lsp_did_open', { language, filePath, content });
}

export async function lspDidChange(language: string, filePath: string, content: string): Promise<void> {
  return invoke<void>('lsp_did_change', { language, filePath, content });
}

export async function lspGetCompletions(language: string, filePath: string, line: number, character: number): Promise<unknown> {
  return invoke<unknown>('lsp_get_completions', { language, filePath, line, character });
}

export async function lspGetHover(language: string, filePath: string, line: number, character: number): Promise<unknown> {
  return invoke<unknown>('lsp_get_hover', { language, filePath, line, character });
}

export async function lspGetDefinition(language: string, filePath: string, line: number, character: number): Promise<unknown> {
  return invoke<unknown>('lsp_get_definition', { language, filePath, line, character });
}
