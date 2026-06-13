// src/lib/terminal.ts

import { Terminal } from '@xterm/xterm';

let activeTerminal: Terminal | null = null;
let pendingOutput: string[] = ['\x1b[90mConsole output will appear here...\x1b[0m\r\n'];

/**
 * Registers the active xterm instance.
 * Flushes any pending output that was written before the terminal was mounted.
 */
export const registerTerminal = (term: Terminal) => {
  activeTerminal = term;
  if (pendingOutput.length > 0) {
    pendingOutput.forEach((data) => {
      term.write(data);
    });
    pendingOutput = [];
  }
};

/**
 * Unregisters the active xterm instance.
 */
export const unregisterTerminal = () => {
  activeTerminal = null;
};

/**
 * Writes data to the active terminal, or queues it if the terminal is not yet mounted.
 * Automatically normalizes line endings to \r\n for xterm.js.
 */
export const writeToTerminal = (data: string) => {
  const normalized = data.replace(/\r?\n/g, '\r\n');
  if (activeTerminal) {
    activeTerminal.write(normalized);
  } else {
    pendingOutput.push(normalized);
  }
};

/**
 * Clears the active terminal and any pending output.
 */
export const clearTerminal = () => {
  if (activeTerminal) {
    activeTerminal.reset();
  } else {
    pendingOutput = [];
  }
};
