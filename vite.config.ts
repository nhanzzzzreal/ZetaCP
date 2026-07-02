import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Auto-copy Monaco Editor files if needed
const monacoSrc = path.resolve(__dirname, "node_modules/monaco-editor/min/vs");
const monacoDest = path.resolve(__dirname, "public/monaco-editor/min/vs");
const blocklySrc = path.resolve(__dirname, "node_modules/blockly/media");
const blocklyDest = path.resolve(__dirname, "public/blockly/media");

if (fs.existsSync(monacoSrc) && !fs.existsSync(monacoDest)) {
  fs.mkdirSync(path.dirname(monacoDest), { recursive: true });
  fs.cpSync(monacoSrc, monacoDest, { recursive: true });
  console.log("Auto-copied Monaco Editor assets to public/monaco-editor/min/vs");
}

if (fs.existsSync(blocklySrc) && !fs.existsSync(blocklyDest)) {
  fs.mkdirSync(path.dirname(blocklyDest), { recursive: true });
  fs.cpSync(blocklySrc, blocklyDest, { recursive: true });
  console.log("Auto-copied Blockly media assets to public/blockly/media");
}


// https://vite.dev/config/
export default defineConfig(async () => ({
  base: './',
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  optimizeDeps: {
    entries: ["index.html"],
  },
}));
