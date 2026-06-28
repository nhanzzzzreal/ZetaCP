// src/components/Terminal/TerminalPanel.tsx

import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { registerTerminal, unregisterTerminal } from '../../lib/terminal';
import '@xterm/xterm/css/xterm.css';

export const TerminalPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Terminal instance with premium dark VS Code-like colors
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'underline',
      fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.35,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',     // neutral muted grey/blue cursor
        selectionBackground: 'rgba(38, 79, 120, 0.5)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#d7ba7d',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Open terminal inside container
    term.open(containerRef.current);
    
    // Register terminal globally so other modules can print output
    registerTerminal(term);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit with small delay to ensure container size is settled in DOM
    const timeoutId = setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn('Initial terminal fit failed:', e);
      }
    }, 50);

    // Setup ResizeObserver to automatically call fit on panel resizing
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Safe to ignore resize failures on hidden/collapsed panel elements
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      unregisterTerminal();
      term.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full bg-[var(--zcp-bg-editor)] p-3 overflow-hidden flex flex-col">
      <div ref={containerRef} className="w-full h-full min-h-0" />
    </div>
  );
};
