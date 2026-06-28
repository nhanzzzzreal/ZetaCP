---
name: zeta-api
description: >
  ZetaCP internal API reference — notification system, Zustand stores, Tauri invoke
  patterns, event bus, z-index table, and database schema. Load this skill when
  adding features, wiring error handling, or working with any store/command.
---

# ZetaCP Internal API Reference

> Đọc toàn bộ file này trước khi implement feature mới.  
> Gọi đúng API, không tự tạo lại những gì đã có.

---

## 1. Notification System

### Import

```ts
// Dùng được mọi nơi — React component, store, hook, event listener
import { notify } from '@/stores/useNotificationStore';
// hoặc path tương đối:
import { notify } from '../../stores/useNotificationStore';
```

### API

```ts
// Lỗi nghiêm trọng từ backend — KHÔNG tự dismiss
notify.error(title: string, message: string, hint?: string): string  // returns id

// Cảnh báo — KHÔNG tự dismiss
notify.warn(title: string, message: string, hint?: string): string

// Thông tin — tự dismiss sau 4s
notify.info(title: string, message: string): string

// Thành công — tự dismiss sau 4s
notify.success(title: string, message: string): string

// Parse ZetaError object tự động (code + message + hint)
notify.fromTauriError(title: string, err: unknown): string

// Đóng 1 notification
notify.dismiss(id: string): void
```

### Pattern chuẩn khi dùng `invoke()`

```ts
// ✅ ĐÚNG
try {
  const result = await invoke<MyResult>('my_command', { param });
  notify.success('Hoàn thành', 'Mô tả ngắn');
} catch (err) {
  notify.fromTauriError('Tiêu đề lỗi', err);  // parse ZetaError tự động
}

// ✅ ĐÚNG — dạng .catch()
invoke('some_command', { param })
  .then(() => notify.success('OK', 'Done'))
  .catch((err) => notify.fromTauriError('Lỗi X', err));

// ❌ SAI — chỉ console.error, user không biết có lỗi
invoke('cmd').catch(console.error);
```

### Dùng trong store (outside React)

```ts
// Store không có hook — dùng getState()
import { useNotificationStore } from './useNotificationStore';
const { error } = useNotificationStore.getState();
error('Lỗi lưu file', err.message);

// Hoặc dùng notify helper (recommended)
import { notify } from './useNotificationStore';
notify.fromTauriError('Lỗi lưu file', err);
```

### ZetaError shape (từ backend)

```ts
interface ZetaError {
  code: 'COMPILER_NOT_FOUND' | 'DB_READONLY' | 'INVALID_INPUT' | 'IO_ERROR' | 'DB_ERROR' | 'FATAL';
  message: string;
  hint: string;
}
// notify.fromTauriError() tự parse shape này
```

---

## 2. Zustand Stores

### Tổng quan stores

| Store | File | Mục đích |
|---|---|---|
| `useProjectStore` | `stores/useProjectStore.ts` | Active file, tabs, file content, autosave |
| `useTestcaseStore` | `stores/useTestcaseStore.ts` | Testcase CRUD, judge run, file settings |
| `useOverlayStore` | `stores/useOverlayStore.ts` | Floating overlay windows + logs |
| `useSettingsStore` | `stores/useSettingsStore.ts` | Global settings (gpp_path, python_path...) |
| `useLayoutStore` | `stores/useLayoutStore.ts` | Panel open/close state, activeView |
| `useStressTestStore` | `stores/useStressTestStore.ts` | Stress test state, results |
| `useSnippetStore` | `stores/useSnippetStore.ts` | Code snippets |
| `useNotificationStore` | `stores/useNotificationStore.ts` | Notification center |

### useProjectStore — key API

```ts
const {
  rootPath,           // string | null — đường dẫn tuyệt đối project
  activeFile,         // string | null — relative path từ rootPath
  activeFileContent,  // string — nội dung Monaco hiện tại
  openTabs,           // string[] — list relative paths đang mở
  dirtyFiles,         // Record<path, boolean> — file có thay đổi chưa lưu
  cursorPos,          // { line, column }

  openProject,        // (path: string) => Promise<void>
  setActiveFile,      // (path: string | null) => Promise<void>
  saveActiveFile,     // () => Promise<void>
  closeTab,           // (path: string) => Promise<void>
} = useProjectStore();
```

### useTestcaseStore — key API

```ts
const {
  metas,          // Map<id, TestcaseMeta>
  results,        // Map<id, TestcaseResult>
  loadedData,     // Map<id, TestcaseData> — lazy loaded
  subtasks,       // Map<id, Subtask>
  activeFilePath, // string | null
  fileSettings,   // FileSettings | null

  loadForFile,    // (filePath: string) => Promise<void>
  loadData,       // (id: string) => Promise<void> — lazy load input/output
  addTestcase,    // (input?, expected?, subtaskId?) => Promise<void>
  deleteTestcase, // (id: string) => Promise<void>
  simulateRun,    // (id?: string | string[]) => Promise<void> — chạy judge
  cancelRun,      // () => void

  saveFileSettings, // (settings: FileSettings) => Promise<void>
} = useTestcaseStore();
```

### useLayoutStore — key API

```ts
const {
  terminalOpen,     // boolean
  setTerminalOpen,  // (v: boolean) => void
  activeView,       // 'editor' | 'stress-tester'
  setActiveView,    // (v: string) => void
} = useLayoutStore();
```

### useSettingsStore — key API

```ts
const {
  settings,       // GlobalSettings | null
  isSettingsOpen, // boolean
  loadSettings,   // () => Promise<void>
  saveSettings,   // (s: GlobalSettings) => Promise<void>
  openSettings,   // () => void
  closeSettings,  // () => void
} = useSettingsStore();
```

### Đọc store ngoài React (không có hook)

```ts
// Bất kỳ file nào — store, util, event handler
const rootPath = useProjectStore.getState().rootPath;
const activeFile = useProjectStore.getState().activeFile;
await useTestcaseStore.getState().simulateRun();
```

### Subscribe store (side effects)

```ts
// Trong useEffect hoặc module-level
const unsub = useTestcaseStore.subscribe((state, prev) => {
  if (state.results !== prev.results) { /* ... */ }
});
// cleanup: unsub();
```

---

## 3. Tauri Invoke — Commands Reference

### Import

```ts
import { invoke } from '@tauri-apps/api/core';
// Hoặc dùng tauri-bridge wrappers (preferred):
import { compileFile, loadFileSettings, ... } from '@/lib/tauri-bridge';
```

### tauri-bridge.ts wrappers (dùng những cái này thay invoke trực tiếp)

```ts
// Settings
loadSettings(): Promise<GlobalSettings>
saveSettings(settings: GlobalSettings): Promise<void>

// File system
openProject(folderPath: string): Promise<ProjectInfo>
scanDirectory(folderPath: string, filter: FileFilter): Promise<FileNode[]>
startFileWatcher(root: string): Promise<void>
stopFileWatcher(): Promise<void>
writeTextFile(filePath: string, content: string, rootPath: string): Promise<void>
readTextFile(filePath: string, rootPath: string): Promise<string>

// Compiler
compileFile(filePath: string, flags: string[], projectRoot: string): Promise<CompileResult>
compileChecker(checkerPath: string, checkerType: string, projectRoot: string): Promise<CompileResult>

// Testcase
loadFileContext(filePath: string): Promise<FileContext>
loadFileSettings(filePath: string): Promise<FileSettings>
saveFileSettings(settings: FileSettings, filePath?: string): Promise<void>
importTestcasesFromFolder(folderPath: string, filePath: string): Promise<void>

// Overlay
loadOverlays(filePath: string): Promise<OverlayState[]>
saveOverlaysBackend(filePath: string, overlays: OverlayState[]): Promise<void>
```

### Invoke trực tiếp (khi không có wrapper)

```ts
// Pattern chuẩn
const result = await invoke<ReturnType>('command_name', { paramCamelCase: value });

// Ví dụ thực tế
await invoke('run_testcases', { filePath, testcaseIds });
await invoke('stop_testcases');
await invoke('run_stress_test', { solutionPath, brutePath, ... });
await invoke('stop_stress_test');
await invoke('open_docs_window', { docsType: 'cp-algorithms' });
await invoke('compute_diff', { expected, actual });
```

---

## 4. Tauri Event Bus

### Listen events (FE nhận từ BE)

```ts
import { listen } from '@tauri-apps/api/event';

// Judge progress — khi run testcases
const unlisten = await listen<JudgeProgress>('judge-progress', (event) => {
  const { testcaseId, status, result } = event.payload;
  // status: 'running' | 'done'
});

// Stress test progress
await listen<StressTestPayload>('stress-test-progress', (event) => {
  // event.payload.type: 'compiling' | 'progress' | 'stateUpdate' | 'complete' | 'error'
});

// File watcher — khi file/dir thay đổi trên disk
await listen('file-changed', handler);

// Testcase list thay đổi (import, stress export)
await listen('testcase-list-updated', ({ payload }) => {
  const { filePath } = payload as { filePath: string };
});

// Testcase import realtime
await listen<TestcaseImportedPayload>('testcase-imported', handler);

// Overlay sync
await listen('overlays-updated', handler);

// Diff data (cho detached diff windows)
await listen<{ testcaseId: string, diffLines: DiffLine[] }>('diff-data-updated', handler);
```

### Emit events (FE gửi)

```ts
import { emit } from '@tauri-apps/api/event';

await emit('diff-data-updated', { testcaseId, diffLines });
```

### Cleanup pattern

```ts
useEffect(() => {
  let unlisten: (() => void) | null = null;
  
  listen('event-name', handler).then(fn => { unlisten = fn; });
  
  return () => { unlisten?.(); };
}, []);
```

---

## 5. Z-Index Hierarchy

**KHÔNG dùng z-index tùy tiện.** Tuân theo bảng sau:

| Z-index | Dùng cho |
|---|---|
| `z-10` | Resize handles nền |
| `z-30` | StressTester maximize button |
| `z-50` | TitleBar, StatusBar, dropdowns thông thường, modal `fixed inset-0` |
| `z-[100]` | SettingsPanel (modal backdrop) |
| `z-[9000]` | **Notification toasts & panel** — trên mọi thứ trừ pinned overlay |
| `z-[9999]` | OverlayPlusMenu, SnippetManager modal |
| `overlay.zIndex` | Overlay window thường (dynamic, bắt đầu ~1) |
| `overlay.zIndex + 10000` | **isPinned overlay** — luôn trên cùng |
| `overlay.zIndex + 15000` | Drag ghost layer khi đang kéo |

> **Rule:** Notification (`z-9000`) thắng tất cả trừ pinned overlay (`≥10001`).

---

## 6. Database Schema Reference

### DB 1: `zetacp-settings.db` — Global, 1 file duy nhất

| Bảng | Columns | Ghi chú |
|---|---|---|
| `Settings` | `key TEXT PK, value TEXT` | Global config: `compiler.gpp_path`, `compiler.python_path`, `compiler.default_flags`, `judge.threads` |
| `RecentProjects` | `path TEXT PK, last_open INTEGER` | Unix timestamp |
| `Snippets` | `id INT PK, trigger TEXT, description TEXT, code TEXT, language TEXT, is_default INT` | `UNIQUE(trigger, language)` |

**Đọc settings từ BE:**
```rust
let val = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = ?")
    .bind("compiler.gpp_path")
    .fetch_optional(&state.settings_db)
    .await?;
```

### DB 2: `ZetaCP.db` — Per source directory (`<dir>/.ZetaCP/ZetaCP.db`)

| Bảng | Columns key | Phân loại | Ghi chú |
|---|---|---|---|
| `TestcaseMeta` | `id PK, file_path, name, order_index, subtask_id, is_active` | Domain core | Index: `(file_path, order_index)` |
| `TestcaseData` | `id PK FK(Meta), input, expected_output` | Heavy data | CASCADE delete khi xóa Meta |
| `TestcaseResult` | `id PK FK(Meta), last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at` | Heavy operational | (Lưu ý: Bảng này chỉ còn phục vụ hiển thị nhanh cho testcase, các bản ghi chi tiết đã chuyển sang bảng `Runs`) |
| `Subtask` | `id PK, file_path, name, max_score, order_index` | Domain core | |
| `CompileCache` | `file_path PK, source_hash, binary_path, compiled_at` | Ephemeral | Hash = SHA-256 source |
| `ExecutionConfig` | `file_path PK, compiler_flags, interpreter_flags, io_mode, input_file, output_file, time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary` | Config chạy | Chứa cài đặt cấu hình chạy & dịch cơ bản |
| `StressConfig` | `file_path PK FK(ExecutionConfig), brute_path, sol_path, gen_path, gen_mode, gen_time_limit_ms, gen_memory_limit_kb, brute_time_limit_ms, brute_memory_limit_kb` | Config Stress | Lưu cấu hình Stress test tách biệt |
| `Runs` | `id PK, run_type, parent_id, file_path, verdict, exec_time_ms, memory_kb, actual_output, diff_info, run_at, extra_json` | Heavy operational | Bảng ghi lịch sử chạy tập trung (Stress + Judge) |
| `OverlayState` | `id PK, file_path, type, title, content, x, y, width, height, ...` | UI session | |

**Lưu ý về backward compatibility:** Bảng cũ `FileSettings` (20 cột) vẫn được giữ lại trong database và đồng bộ hai chiều thông qua các SQLite triggers (`file_settings_after_insert`, `file_settings_after_update`, `file_settings_after_delete`) để tránh gây lỗi cho frontend cũ chưa nâng cấp. Tuy nhiên, code mới nên ưu tiên đọc/ghi trực tiếp vào `ExecutionConfig` và `StressConfig`.

**Lấy project DB pool từ BE:**
```rust
// create_if_missing = true: tạo DB nếu chưa có
// create_if_missing = false: trả None nếu chưa có
let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();
```

---

## 7. Types Reference (Frontend)

### Key types — import từ `@/types/testcase`

```ts
import {
  TestcaseMeta,    // { id, filePath, name, orderIndex, subtaskId, isActive }
  TestcaseData,    // { id, input, expectedOutput }
  TestcaseResult,  // { id, lastStatus, execTimeMs, memoryKb, actualOutput, diffInfo, runAt }
  Subtask,         // { id, filePath, name, maxScore, orderIndex }
  FileSettings,    // { filePath, compilerFlags, ioMode, timeLimitMs, ... }
  FileContext,     // { subtasks, metas, results, settings }
  DiffLine,        // { line, expected, actual }
  JudgeProgress,   // { testcaseId, status, result? }
} from '@/types/testcase';
```

### GlobalSettings — import từ `@/types/settings`

```ts
interface GlobalSettings {
  'compiler.gpp_path': string;
  'compiler.python_path': string;
  'compiler.default_flags': string;
  'judge.threads': string;  // số thread, stored as string
  // ... các key khác
}
```

---

## 8. Component Mounting Pattern

### Thêm component global mới vào App

```tsx
// src/App.tsx — cuối MainApp return, sau InternalOverlayContainer
return (
  <div className="flex flex-col h-screen ...">
    {/* ... panels ... */}
    <InternalOverlayContainer />
    <NotificationCenter />       {/* ← thêm tương tự đây */}
    <MyNewGlobalComponent />
  </div>
);
```

### Thêm tab vào ActivityBar (left sidebar)

```tsx
// App.tsx — trong Panel left, thêm case vào switch activeTab
{activeTab === 'my-tab' ? (
  <MyComponent />
) : /* ... */}
```

### Overlay floating window

```ts
// Tạo overlay mới
await useOverlayStore.getState().addOverlay('scratchpad', 'Title', 'initial content');
// Types: 'scratchpad' | 'notes' | 'md' | 'image' | 'pdf' | 'notification' | 'diff-viewer'
```

---

## 9. Codicons Reference (hay dùng)

```
codicon-error          → lỗi (đỏ)
codicon-warning        → cảnh báo (vàng)
codicon-info           → thông tin (xanh)
codicon-pass-filled    → thành công (xanh)
codicon-bell           → notification
codicon-bell-slash     → no notification
codicon-terminal       → terminal/console
codicon-play           → run/execute
codicon-debug-stop     → stop
codicon-loading        → loading (spinner với animate-spin)
codicon-close          → đóng
codicon-chevron-down   → collapse/expand
codicon-refresh        → reload
codicon-gear           → settings
codicon-file           → file
codicon-folder         → folder
codicon-eye / codicon-eye-closed  → show/hide
codicon-pin / codicon-pinned      → pin overlay
```

Dùng: `<span className="codicon codicon-error text-[14px] text-red-400" />`

---

## 10. Checklist trước khi submit code

- [ ] Mọi `invoke()` catch đều gọi `notify.fromTauriError()`
- [ ] Mọi BE command trả `Result<T, ZetaError>` — không `unwrap()`
- [ ] Process spawn qua `run_in_sandbox()` — không `Command::new()` trực tiếp
- [ ] Z-index dùng đúng bảng phân tầng
- [ ] Không thêm cột vào `FileSettings`, `ExecutionConfig`, hay `StressConfig` — tạo bảng mới nếu cần
- [ ] Migration file mới: `vN.sql` + đăng ký trong `db/mod.rs`
- [ ] Không tự viết lại logic `resolve_verdict` hay `compile_cpp` — sử dụng các module dùng chung dưới `judge/`

---

## 11. Rust Backend Unified Modules

Khi thực thi chạy, dịch hoặc kiểm thử trong các Tauri command mới, **bắt buộc** phải gọi các hàm tiện ích đã được unify dưới đây:

### 1. Biên dịch C++ thống nhất (`judge/compiler.rs`)
```rust
pub async fn compile_cpp(
    state: &AppState,
    src_path: &Path,
    bin_path: &Path,
    flags: &[String],
    include_parent: bool, // true nếu cần nạp include path (.h) của thư mục chứa binary (stress test)
) -> Result<String, String> // Trả về Ok(stderr) nếu dịch thành công, Err(stderr) nếu thất bại
```

### 2. Chạy Sandbox (`judge/runner.rs`)
```rust
pub async fn execute_once(opts: &RunOptions) -> Result<RunResult, std::io::Error>
```

### 3. Phân tích kết quả chạy (`judge/runner.rs`)
```rust
pub fn resolve_verdict(
    stdout: &str,
    stderr: &str,
    success: bool,
    is_timeout: bool,
    memory_kb: i64,
    memory_limit_kb: i64,
    expected_output: Option<&str>,
    checker_type: Option<&str>,
) -> String // Trả về AC, WA, TLE, MLE, RE (tự nhận diện 8 MLE keywords hoa/thường)
```

### 4. Chạy Batch testcases song song (`judge/orchestrator.rs`)
```rust
pub async fn execute_batch(
    testcase_ids: Vec<String>,
    exec_path: String,
    args: Vec<String>,
    settings: FileSettings,
    run_dir: &Path,
    inp_name: String,
    out_name: String,
    proj_db: sqlx::SqlitePool,
    app_handle: tauri::AppHandle,
    concurrency: usize,
    cancel_token: Arc<AtomicBool>,
) -> Result<Vec<TestcaseResult>, ZetaError> // Tự động quản lý luồng Semaphore, cancellation, và phát event "judge-batch-progress" tăng dần đều.
```
