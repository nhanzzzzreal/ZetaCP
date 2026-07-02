import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loader } from "@monaco-editor/react";

// Configure Monaco Editor to load from the bundled public directory.
// Use the app base path so it works in both dev and packaged Tauri builds.
loader.config({ paths: { vs: `${import.meta.env.BASE_URL}monaco-editor/min/vs` } });

// Disable default webview context menu globally
window.addEventListener("contextmenu", (e) => e.preventDefault());
 
// Disable default browser keyboard shortcuts globally
window.addEventListener("keydown", (e) => {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  //const shift = e.shiftKey;
  const alt = e.altKey;
  const key = e.key.toLowerCase();
 
  // Block F5, Ctrl+R, Ctrl+Shift+R (Reloads)
  if (e.key === "F5" || (ctrlOrMeta && key === "r")) {
    e.preventDefault();
    return;
  }
 
  // Block Alt+Left / Alt+Right (Browser History Navigation Back/Forward)
  if (alt && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    return;
  }
 
  // Block standard browser menu shortcuts (Save, Print, Open, New Window, Tabs, Search, etc.)
  if (
    ctrlOrMeta &&
    [
      "s", // Save page
      "p", // Print
      "o", // Open file
      "n", // New window
      "t", // New tab
      "w", // Close window/tab
      "d", // Bookmark
      "j", // Downloads
      "f", // Find
      "g", // Find next / Go to line
      "h", // Replace / History
    ].includes(key)
  ) {
    e.preventDefault();
    return;
  }
 
  // Block F11 (Fullscreen)
  if (e.key === "F11") {
    e.preventDefault();
    return;
  }
 
  // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Developer Tools)
  //if (
  //  e.key === "F12" ||
  //  (ctrlOrMeta && shift && ["i", "j", "c"].includes(key))
  //) {
  //  e.preventDefault();
  //  return;
  //}
});
 
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
