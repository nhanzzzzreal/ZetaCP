# ZetaCP

**ZetaCP** is a portable, high-performance IDE designed specifically for Competitive Programming (CP). Built with **Tauri v2 (Rust backend)** and **React / TypeScript (Frontend)**, it runs completely from a USB drive (portable-first) and handles intensive execution securely and efficiently.

---

## 🚀 Key Features

* **Parallel Judge Engine:** Parallel testcase execution using Rust `rayon` workers. Supports customizable limits (CPU time, memory usage via Windows Job Objects / Linux sandboxes) and token-based/exact/custom checkers.
* **Interactive Stress Tester:** A node-based canvas (powered by React Flow) to construct stress testing pipelines with solution, generator, brute-force, and checker configurations.
* **Desktop Overlay Widgets:** Detach and pin floating windows (Note Editors, Markdown/PDF viewers, Scratchpads, and Diff modals) that float above other applications.
* **Side-by-Side Diff Viewer:** Interactive, synchronized scrollable diffing panel to quickly diagnose Wrong Answers (WA) on testcases.
* **Graph Visualizer:** Render node-link diagrams directly on canvas with Rust-backed layout algorithms.
* **Native Keyboard & Environment Integration:** System menu and browser shortcut overrides for a fully native workspace feeling.

---

## 🛠 Tech Stack

* **Backend:** Rust, Tauri v2, SQLite (sqlx), tokio, rayon.
* **Frontend:** React, TypeScript, TailwindCSS, Monaco Editor (main editor), CodeMirror 6 (testcase editor).

---

## 💻 Running Locally

### Prerequisites
Make sure you have [Rust](https://www.rust-lang.org/) and [Node.js](https://nodejs.org/) installed.

### Steps
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development mode:
   ```bash
   npm run tauri dev
   ```
3. Build production binaries:
   ```bash
   npm run tauri build
   ```
