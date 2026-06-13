# ZetaCP — AI Agent Project Guide
> **Mục đích tài liệu này:** Giúp AI agent nắm toàn bộ ngữ cảnh dự án trong < 5 phút để có thể bắt tay vào code bất kỳ module nào mà không cần đọc codebase.  
> **Cập nhật lần cuối:** Blueprint v1.0  
> **Dành cho:** AI Coding Agents (Cursor, Claude Code, Copilot, v.v.)

---

## 0. TL;DR — Dự án là gì?

**ZetaCP** là một IDE chuyên dụng cho Competitive Programming (CP), chạy hoàn toàn từ USB (portable), xây dựng bằng **Tauri v2 (Rust backend) + React/TypeScript (frontend)**. Đây không phải text editor thông thường — đây là một hệ sinh thái CP gồm: judge engine, stress tester, testcase manager, graph visualizer, và diff viewer.

**Ba nguyên tắc KHÔNG được vi phạm:**
1. **Portable-First:** Tuyệt đối không ghi vào `%APPDATA%`, Registry, hay bất kỳ đường dẫn tuyệt đối nào của hệ điều hành.
2. **Performance-First:** Mọi list/tree phải dùng virtualization. Mọi tác vụ nặng chạy ở Rust.
3. **Data Separation:** Tách `TestcaseData` (input/output nặng, ít thay đổi) khỏi `TestcaseResult` (nhẹ, thay đổi liên tục sau mỗi lần chạy).

---

## 1. TECH STACK — Quyết định đã chốt (không tranh luận lại)

| Layer | Công nghệ | Lý do chốt |
|---|---|---|
| Desktop Runtime | **Tauri v2** | Portable binary, nhỏ hơn Electron 10x |
| Backend Language | **Rust** | Zero-cost async, memory-safe judge |
| Frontend Framework | **React + TypeScript** | Hệ sinh thái component phong phú |
| Main Editor | **Monaco Editor** | VSCode engine, đầy đủ LSP |
| Mini Editor (testcase) | **CodeMirror 6** | Hỗ trợ virtualization, nhẹ hơn Monaco |
| File Tree | **react-arborist** | Virtual Tree built-in, drag-drop |
| Stress Test Canvas | **@xyflow/react** | Node-based canvas kéo thả |
| Graph Viewer | **react-konva** | Canvas rendering, Rust xử lý layout |
| State | **Zustand** | Nhẹ, không boilerplate, dễ slice |
| DB | **SQLite (sqlx)** | Portable, WAL mode cho USB |
| Async | **tokio** | Async runtime chính |
| Parallel Judge | **rayon** | Data parallelism |
| Logging | **tracing** crate | Structured log, không dùng `println!` |
| Styling | **TailwindCSS + Radix UI** | VSCode-like, system font |
| Shortcuts | **react-hotkeys-hook** | Centralized registry |

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```
zetacp/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry point, Tauri builder
│   │   ├── commands/             # Tauri commands (giao tiếp với Frontend)
│   │   │   ├── mod.rs
│   │   │   ├── judge.rs          # run_tests, stop_judge
│   │   │   ├── file_system.rs    # open_project, scan_directory
│   │   │   ├── compiler.rs       # compile_file, check_compiler
│   │   │   └── settings.rs       # load_settings, save_settings
│   │   ├── judge/                # Judge engine core
│   │   │   ├── mod.rs
│   │   │   ├── executor.rs       # Spawn child process + sandbox
│   │   │   ├── checker.rs        # Token checker + custom checker
│   │   │   ├── streamer.rs       # mpsc channel → Tauri events
│   │   │   └── cache.rs          # SHA-256 binary cache
│   │   ├── db/                   # Database layer
│   │   │   ├── mod.rs
│   │   │   ├── migrations/       # SQL files: v1.sql, v2.sql, ...
│   │   │   ├── project_db.rs     # Thao tác ZetaCP.db (per-project)
│   │   │   └── settings_db.rs    # Thao tác zetacp-settings.db (global)
│   │   ├── graph/                # Graph algorithm (Rust → JSON → Frontend)
│   │   │   └── analyzer.rs       # SCC, Bridge, Articulation point
│   │   ├── watcher/              # File watcher (dung `notify` crate)
│   │   │   └── mod.rs            # start_watcher(root), stop_watcher() -> emit fs://file_changed
│   │   ├── errors.rs             # enum ZetaError + impl
│   │   └── state.rs              # Tauri managed state (AppState - xem Section 4a)
│   ├── capabilities/             # TAURI v2 BAT BUOC -- thay the allowlist cu
│   │   └── default.json          # Khai bao permission (xem Section 2a)
│   └── Cargo.toml
│
├── src/                          # React/TypeScript frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root layout, panel split
│   │
│   ├── stores/                   # Zustand state slices
│   │   ├── useProjectStore.ts    # File tree, active file
│   │   ├── useTestcaseStore.ts   # Testcase list (metadata only in RAM)
│   │   ├── useJudgeStore.ts      # Judge status, results stream
│   │   ├── useSettingsStore.ts   # Global settings (compiler path, theme)
│   │   └── useLayoutStore.ts     # Panel sizes, window positions
│   │
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── MonacoEditor.tsx  # Main code editor
│   │   │   └── EditorToolbar.tsx # Language select, run button
│   │   ├── FileExplorer/
│   │   │   ├── FileTree.tsx      # react-arborist wrapper
│   │   │   └── FileFilter.tsx    # .cpp/.py filter settings
│   │   ├── TestcasePanel/
│   │   │   ├── TestcaseList.tsx  # Virtualized list
│   │   │   ├── TestcaseItem.tsx  # Single row: name, status badge, timing
│   │   │   ├── TestcaseEditor.tsx # CodeMirror 6 input/output editor
│   │   │   └── SubtaskGroup.tsx  # Group + score display
│   │   ├── JudgeResults/
│   │   │   ├── ResultBadge.tsx   # AC/WA/TLE/MLE/RE/OLE badge
│   │   │   ├── DiffViewer.tsx    # Horizontal/Vertical diff toggle
│   │   │   └── TimingBar.tsx     # Execution time visualization
│   │   ├── StressTester/
│   │   │   ├── StressCanvas.tsx  # @xyflow/react canvas
│   │   │   ├── nodes/            # Generator, BruteForce, Solution, Checker nodes
│   │   │   └── StressControls.tsx
│   │   ├── GraphViewer/
│   │   │   ├── GraphCanvas.tsx   # react-konva canvas
│   │   │   └── GraphControls.tsx # Parse mode, highlight options
│   │   ├── ProblemStatement/
│   │   │   ├── StatementViewer.tsx # PDF/Markdown render
│   │   │   └── FloatingWindow.tsx  # Pin/detach window
│   │   └── shared/
│   │       ├── Badge.tsx
│   │       ├── Tooltip.tsx
│   │       └── ResizablePanel.tsx
│   │
│   ├── hooks/
│   │   ├── useJudgeEvents.ts     # Lắng nghe Tauri events từ Judge
│   │   ├── useAutoSave.ts        # Debounced save logic
│   │   └── useShortcuts.ts       # react-hotkeys-hook registry
│   │
│   ├── lib/
│   │   ├── tauri-bridge.ts       # Wrapper typed cho tất cả invoke() calls
│   │   ├── db-sync.ts            # Write-through / debounce sync logic (GỌI tauri-bridge, không ghi SQLite trực tiếp)
│   │   └── validators.ts         # Input validation trước khi gửi Rust
│   │
│   └── types/
│       ├── testcase.ts           # TypeScript types (mirror Rust structs)
│       ├── judge.ts
│       └── settings.ts
│
├── zetacp-settings.db            # Global settings DB (bên cạnh .exe)
├── tauri.conf.json
└── package.json
```

> **Lưu ý quan trọng:** `ZetaCP.db` **không** nằm trong repo. Nó được tạo tự động tại thư mục bài tập khi người dùng mở project, là file hidden (`.ZetaCP.db` trên Linux/Mac).

---

## 2a. TAURI v2 CAPABILITIES — Bắt buộc, không có app không chạy được

> Tauri v2 bỏ hệ thống `allowlist` cũ. Thay vào đó, mọi quyền truy cập phải được khai báo trong `src-tauri/capabilities/default.json`. Thiếu file này → app không compile hoặc runtime permission error ngay task P1-1.

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "ZetaCP default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",

    "fs:read-all",
    "fs:write-all",
    "fs:read-dirs",
    "fs:scope-app-data",
    "fs:scope-home",

    "shell:execute",
    "shell:sidecar",

    "process:allow-exit",
    "process:allow-restart",

    "dialog:open",
    "dialog:save",

    "opener:default"
  ]
}
```

> **Giải thích quyền:**
> - `fs:read-all` / `fs:write-all`: Đọc source file, ghi .db — cần cho mọi tính năng.
> - `shell:execute`: Spawn g++, python, process thực thi bài nộp.
> - `shell:sidecar`: Nếu có custom checker binary đi kèm app.
> - `dialog:open`: Cho phép user chọn folder project.
> - Nếu cần giới hạn scope filesystem cụ thể hơn, dùng `fs:scope` với path pattern.

---

## 3. DATABASE SCHEMA (SQLite)

### File: `zetacp-settings.db` — Global, bên cạnh file .exe

```sql
CREATE TABLE IF NOT EXISTS Settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- Các key quan trọng:
-- 'compiler.gpp_path'     -> "/usr/bin/g++"
-- 'compiler.python_path'  -> "/usr/bin/python3"
-- 'theme'                 -> "dark" | "light"
-- 'font.editor'           -> "Consolas"
-- 'judge.threads'         -> "4"
-- 'diff.layout'           -> "horizontal" | "vertical"
-- 'file_filter.show'      -> ".cpp,.py"
-- 'file_filter.hide'      -> ".exe,.db,.o"

CREATE TABLE IF NOT EXISTS RecentProjects (
    path       TEXT PRIMARY KEY,
    last_open  INTEGER NOT NULL  -- Unix timestamp
);
```

### File: `ZetaCP.db` — Per-project, tại thư mục bài tập

```sql
-- PRAGMA journal_mode = WAL;   <- BẮT BUỘC khi mở DB
-- PRAGMA foreign_keys = ON;    <- BẮT BUỘC

-- Metadata của testcase (ít ghi, nhiều đọc)
CREATE TABLE IF NOT EXISTS TestcaseMeta (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path   TEXT    NOT NULL,  -- Đường dẫn TƯƠNG ĐỐI của .cpp/.py
    name        TEXT    NOT NULL,
    order_index INTEGER NOT NULL,
    subtask_id  INTEGER,           -- NULL nếu không thuộc subtask
    is_active   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_meta_file_order 
    ON TestcaseMeta(file_path, order_index);

-- Nội dung testcase (nặng, chỉ ghi khi tạo/sửa)
CREATE TABLE IF NOT EXISTS TestcaseData (
    id              INTEGER PRIMARY KEY REFERENCES TestcaseMeta(id) ON DELETE CASCADE,
    input           TEXT    NOT NULL DEFAULT '',
    expected_output TEXT    NOT NULL DEFAULT ''
);

-- Kết quả chấm bài (nhẹ, ghi sau MỖI lần run)
CREATE TABLE IF NOT EXISTS TestcaseResult (
    id             INTEGER PRIMARY KEY REFERENCES TestcaseMeta(id) ON DELETE CASCADE,
    last_status    TEXT,     -- 'AC'|'WA'|'TLE'|'MLE'|'RE'|'OLE'|'PENDING'
    exec_time_ms   REAL,
    memory_kb      INTEGER,
    actual_output  TEXT,
    diff_info      TEXT,     -- JSON: [{line, expected, actual}]
    run_at         INTEGER   -- Unix timestamp của lần run gần nhất (NULL = chưa chạy lần nào)
);
-- KHÔNG tạo idx_result_id: id là PRIMARY KEY, SQLite đã tự tạo implicit index.

-- Nhóm subtask
CREATE TABLE IF NOT EXISTS Subtask (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path   TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    max_score   INTEGER NOT NULL DEFAULT 100,
    order_index INTEGER NOT NULL
);

-- Cache binary đã compile
CREATE TABLE IF NOT EXISTS CompileCache (
    file_path    TEXT PRIMARY KEY,  -- Đường dẫn TƯƠNG ĐỐI từ project root
    source_hash  TEXT NOT NULL,     -- SHA-256 của source code
    binary_path  TEXT NOT NULL,     -- Đường dẫn TƯƠNG ĐỐI đến binary (từ project root)
                                    -- ⚠️ PHẢI là relative path — absolute path sẽ break khi copy USB sang máy khác
    compiled_at  INTEGER NOT NULL   -- Unix timestamp
);

-- Version tracking cho migration
-- PRAGMA user_version = 1;  <- Set khi tạo DB mới
```

---

## 4a. RUST STRUCT DEFINITIONS — Bắt buộc dùng đúng tên này

> **Quan trọng:** TypeScript types ở Section 4 mirror các Rust structs dưới đây. Agent viết Rust commands PHẢI dùng đúng tên struct này để serialization khớp với frontend.

```rust
// src-tauri/src/state.rs

use sqlx::SqlitePool;
use tokio::sync::Mutex;

pub struct AppState {
    pub settings_db: SqlitePool,           // Pool kết nối zetacp-settings.db
    pub project_db:  Mutex<Option<SqlitePool>>, // Pool kết nối ZetaCP.db hiện tại (None nếu chưa mở project)
    pub project_root: Mutex<Option<String>>,    // Absolute path của project đang mở
    pub judge_handle: Mutex<Option<tokio::task::JoinHandle<()>>>, // Handle để stop judge
}
```

```rust
// src-tauri/src/commands/compiler.rs — return types

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CompileResult {
    pub success:   bool,
    pub stderr:    String,   // Rỗng nếu compile thành công
    pub binary_path: String, // Relative path đến binary, rỗng nếu lỗi
    pub cached:    bool,     // true nếu dùng binary từ cache (không compile lại)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CompilerInfo {
    pub found:   bool,
    pub path:    String,  // Đường dẫn thực tế (sau resolve PATH)
    pub version: String,  // Ví dụ: "g++ (GCC) 13.2.0"
}
```

```rust
// src-tauri/src/commands/file_system.rs — return types

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ProjectInfo {
    pub root_path:     String,       // Absolute path (chỉ dùng nội bộ Rust)
    pub db_path:       String,       // Absolute path đến .ZetaCP.db
    pub db_was_new:    bool,         // true nếu DB vừa được tạo mới
    pub recent_files:  Vec<String>,  // Relative paths của các file .cpp/.py
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileNode {
    pub name:     String,
    pub path:     String,       // Relative path từ project root
    pub is_dir:   bool,
    pub children: Vec<FileNode>, // Rỗng nếu là file
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileFilter {
    pub show: Vec<String>,  // Ví dụ: [".cpp", ".py"]
    pub hide: Vec<String>,  // Ví dụ: [".exe", ".db", ".o"]
}
```

```rust
// src-tauri/src/commands/judge.rs — config type (mirror JudgeConfig TS)

#[derive(Debug, serde::Deserialize)]
pub struct JudgeConfig {
    pub file_path:           String,
    pub time_limit_ms:       u64,
    pub memory_limit_kb:     u64,
    pub testcase_ids:        Vec<i64>,  // Rỗng = chạy tất cả
    pub threads:             usize,
    pub checker_type:        String,    // "token" | "exact" | "custom"
    pub custom_checker_path: Option<String>,
}
```

---

```typescript
// src/types/testcase.ts

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'OLE' | 'PENDING' | 'SKIPPED';

export interface TestcaseMeta {
  id: number;
  filePath: string;  // relative path
  name: string;
  orderIndex: number;
  subtaskId: number | null;
  isActive: boolean;
}

export interface TestcaseData {
  id: number;
  input: string;
  expectedOutput: string;
}

export interface TestcaseResult {
  id: number;
  lastStatus: Verdict | null;
  execTimeMs: number | null;
  memoryKb: number | null;
  actualOutput: string | null;
  diffInfo: DiffLine[] | null;
  runAt: number | null;  // Unix timestamp — null nghĩa là chưa chạy lần nào
}

export interface DiffLine {
  line: number;
  expected: string;
  actual: string;
}

// Dạng đầy đủ trong RAM (join của 3 bảng)
export interface Testcase {
  meta: TestcaseMeta;
  data: TestcaseData | null;  // Lazy load, null cho đến khi mở editor
  result: TestcaseResult | null;
}

export interface Subtask {
  id: number;
  filePath: string;
  name: string;
  maxScore: number;
  orderIndex: number;
  testcases: TestcaseMeta[];  // chỉ metadata
}
```

```typescript
// src/types/judge.ts

export interface JudgeConfig {
  filePath: string;        // relative path của .cpp/.py
  timeLimitMs: number;
  memoryLimitKb: number;
  testcaseIds: number[];   // [] = chạy tất cả
  threads: number;
  checkerType: 'token' | 'exact' | 'custom';
  customCheckerPath?: string;
}

export interface JudgeProgress {
  testcaseId: number;
  status: 'running' | 'done';
  result?: TestcaseResult;
}

// Tauri Event payload
export interface JudgeEvent {
  type: 'progress' | 'complete' | 'compile_error' | 'fatal';
  data: JudgeProgress | CompileError | string;
}

export interface CompileError {
  stderr: string;
  exitCode: number;
}
```

```typescript
// src/types/settings.ts

export interface GlobalSettings {
  compiler: {
    gppPath: string;
    pythonPath: string;
    defaultFlags: string;  // "-O2 -std=c++17"
  };
  theme: 'dark' | 'light' | 'system';
  font: {
    editor: string;        // "Consolas"
    size: number;
  };
  judge: {
    threads: number;
    defaultTimeLimitMs: number;
    defaultMemoryLimitKb: number;
  };
  diff: {
    layout: 'horizontal' | 'vertical';
  };
  fileFilter: {
    show: string[];        // [".cpp", ".py"]
    hide: string[];        // [".exe", ".db", ".o"]
  };
}
```

---

## 5. RUST API — TAURI COMMANDS (Frontend → Backend)

```rust
// src-tauri/src/commands/judge.rs

/// Bắt đầu chấm bài — kết quả stream qua Tauri Events
#[tauri::command]
async fn run_tests(
    config: JudgeConfig,        // Deserialized từ JSON
    app_handle: AppHandle,
    state: State<AppState>,
) -> Result<(), ZetaError>

/// Dừng toàn bộ judge worker đang chạy
#[tauri::command]
async fn stop_judge(state: State<AppState>) -> Result<(), ZetaError>
```

```rust
// src-tauri/src/commands/compiler.rs

/// Compile file, trả về lỗi nếu có
#[tauri::command]
async fn compile_file(
    file_path: String,      // relative path
    flags: Vec<String>,
    project_root: String,
    state: State<AppState>,
) -> Result<CompileResult, ZetaError>

/// Kiểm tra compiler có trong PATH không
#[tauri::command]
async fn check_compiler(compiler: String) -> Result<CompilerInfo, ZetaError>
```

```rust
// src-tauri/src/commands/file_system.rs

/// Mở project folder, load ZetaCP.db hoặc tạo mới
#[tauri::command]
async fn open_project(
    folder_path: String,
    state: State<AppState>,
) -> Result<ProjectInfo, ZetaError>

/// Quét thư mục, áp filter settings
#[tauri::command]
async fn scan_directory(
    folder_path: String,
    filter: FileFilter,
) -> Result<Vec<FileNode>, ZetaError>
```

```rust
// src-tauri/src/commands/settings.rs

#[tauri::command]
async fn load_settings(state: State<AppState>) -> Result<GlobalSettings, ZetaError>

#[tauri::command]
async fn save_settings(
    settings: GlobalSettings,
    state: State<AppState>,
) -> Result<(), ZetaError>
```

---

## 6. TAURI EVENTS (Backend → Frontend) — Không được thay bằng cơ chế khác

> **Quy tắc:** Backend KHÔNG trả kết quả judge qua return value của command. Kết quả PHẢI đi qua `app_handle.emit()` để streaming real-time.

```
Event name: "judge://progress"
Payload:    JudgeEvent { type: "progress", data: JudgeProgress }

Event name: "judge://complete"  
Payload:    JudgeEvent { type: "complete", data: JudgeSummary }

Event name: "judge://compile_error"
Payload:    JudgeEvent { type: "compile_error", data: CompileError }

Event name: "judge://fatal"
Payload:    JudgeEvent { type: "fatal", data: "error message" }

Event name: "fs://file_changed"
Payload:    { path: string }   -- khi file watcher phát hiện thay đổi
```

**Frontend listener pattern (bắt buộc):**
```typescript
// src/hooks/useJudgeEvents.ts
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen<JudgeEvent>('judge://progress', (event) => {
    useJudgeStore.getState().updateResult(event.payload.data);
  });
  return () => { unlisten.then(f => f()); };
}, []);
```

---

## 7. ZUSTAND STORES — Kiến trúc State

### Nguyên tắc phân vùng dữ liệu:

```
RAM (Zustand)                           SQLite
─────────────────────────────────────   ──────────────────────────────
TestcaseMeta[] (toàn bộ)           ←→  TestcaseMeta (đọc khi mở file)
TestcaseResult[] (toàn bộ)         ←→  TestcaseResult (ghi sau mỗi run)
TestcaseData (chỉ ID đang mở)      ←→  TestcaseData (lazy load on demand)
GlobalSettings                     ←→  zetacp-settings.db (read on start)
Panel layout (không persist)            -
```

### Sync Strategy:
- **Write-Through (ngay lập tức):** `TestcaseResult` sau mỗi judge event.
- **Debounced (30s):** `TestcaseMeta` khi rename/reorder, `TestcaseData` khi edit input/output.
- **On-demand write:** `GlobalSettings` chỉ khi user bấm Save.

```typescript
// src/stores/useTestcaseStore.ts — skeleton

interface TestcaseStore {
  // State
  metas: Map<number, TestcaseMeta>;     // Toàn bộ testcase của file đang mở
  results: Map<number, TestcaseResult>; // Toàn bộ kết quả
  loadedData: Map<number, TestcaseData>;// Chỉ testcase đang được xem

  // Actions
  loadForFile: (filePath: string) => Promise<void>;  // Đọc Meta + Result từ DB
  loadData: (id: number) => Promise<void>;            // Lazy load Data
  updateResult: (result: TestcaseResult) => void;     // Write-through to DB
  addTestcase: (input: string, expected: string) => Promise<void>;
  deleteTestcase: (id: number) => Promise<void>;
  reorder: (ids: number[]) => void;                   // Debounced sync
}
```

---

## 8. JUDGE ENGINE — Luồng xử lý nội bộ (Rust)

```
Frontend gọi run_tests(config)
         │
         ▼
   1. Sync DB: đảm bảo TestcaseData trong DB là mới nhất
         │
         ▼
   2. Check CompileCache (SHA-256 của source code)
         │ Cache hit?
      ───┴───
      │     │
     Yes    No → compile → cập nhật cache
      │
      ▼
   3. Spawn rayon parallel workers (số thread theo config)
         │
         ▼
   4. Mỗi worker:
      a. Đọc TestcaseData từ DB
      b. Tạo temp files trong RAM disk:
         - Linux: `/dev/shm` nếu available (kiểm tra trước khi dùng — không có trong Docker/một số distro)
           Fallback: `std::env::temp_dir()` → thường là `/tmp`
         - Windows: KHÔNG dùng VHD/RAM disk (yêu cầu quyền admin, phá vỡ nguyên tắc Portable-First)
           Dùng `%TEMP%` thông thường via `std::env::temp_dir()`
           Trade-off được chấp nhận: %TEMP% trên ổ HDD/SSD, không phải RAM — nhưng đảm bảo portable.
         - ⚠️ Ghi chú WAL: WAL mode tạo thêm `-wal` và `-shm` files bên cạnh `.db`.
           Trên USB tốc độ chậm có thể gây perf tệ hơn. Cân nhắc tắt WAL nếu detect USB (có thể check via mount point).

      c. Spawn child process với sandbox:
         - Windows: Job Object (CPU time, memory limit)
         - Linux: setrlimit + seccomp whitelist
      d. Capture stdout (max 4MB → OLE nếu vượt)
      e. Tính verdict, diff
      f. Gửi qua mpsc::Sender → Streamer
         │
         ▼
   5. Streamer nhận từ mpsc, emit Tauri event "judge://progress"
         │
         ▼
   6. Khi tất cả done → emit "judge://complete"
   7. Xóa temp files
```

## 8a. JUDGE CANCEL & CLEANUP — Bắt buộc implement

> **Vấn đề:** Nếu user đóng file hoặc mở project mới trong lúc judge đang chạy, zombie worker sẽ tiếp tục chạy và emit event cho file cũ.

**Trigger cancel:** Frontend gọi `stop_judge` trước khi:
- `setActiveFile()` đổi sang file khác
- `open_project()` mở project mới
- App đóng (tauri `on_window_event CloseRequested`)

```rust
// src-tauri/src/commands/judge.rs

#[tauri::command]
async fn stop_judge(state: State<AppState>) -> Result<(), ZetaError> {
    let mut handle = state.judge_handle.lock().await;
    if let Some(h) = handle.take() {
        h.abort();  // Cancel tokio task → rayon workers sẽ detect channel closed
        tracing::info!("Judge stopped by user");
    }
    Ok(())
}
```

```typescript
// Frontend: trước mọi thao tác đổi context
async function switchFile(newPath: string) {
  if (judgeStore.isRunning) {
    await invoke('stop_judge');
    judgeStore.setIsStopped(true);
  }
  projectStore.setActiveFile(newPath);
}
```

---

## 9. ERROR HANDLING CONTRACT

### Rust — `enum ZetaError`

```rust
// src-tauri/src/errors.rs

#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum ZetaError {
    // Lỗi người dùng — hiện dialog gợi ý sửa
    #[error("COMPILER_NOT_FOUND: {path}")]
    CompilerNotFound { path: String },
    
    #[error("DB_READONLY: {path}")]
    DbReadOnly { path: String },

    #[error("INVALID_INPUT: {message}")]
    InvalidInput { message: String },

    // Lỗi hệ thống — recoverable, log + notify
    #[error("IO_ERROR: {0}")]
    Io(String),

    #[error("DB_ERROR: {0}")]
    Database(String),

    // Lỗi nghiêm trọng — crash gracefully
    #[error("FATAL: {0}")]
    Fatal(String),
}

// impl ZetaError → trả về JSON cho Frontend:
// { "code": "COMPILER_NOT_FOUND", "message": "...", "hint": "Thêm g++ vào PATH" }
```

### Frontend — Error Display Rules

| Error Code | Hiển thị |
|---|---|
| `COMPILER_NOT_FOUND` | Dialog modal với hướng dẫn cài đặt |
| `DB_READONLY` | Toast warning, tiếp tục với RAM-only mode |
| `INVALID_INPUT` | Inline validation message |
| `IO_ERROR` | Toast error + log |
| `FATAL` | Full-screen error với nút "Copy logs" |

---

## 10. MIGRATION SYSTEM

Mỗi lần mở DB, chạy migration runner:

```rust
// src-tauri/src/db/migrations/

// Quy tắc đặt tên file:
// v1.sql, v2.sql, v3.sql ...

// Logic runner:
// 1. Đọc PRAGMA user_version
// 2. Chạy tuần tự các file SQL từ (user_version+1) đến latest
// 3. Cập nhật user_version sau khi mỗi migration thành công
// 4. KHÔNG rollback — nếu migration fail → ZetaError::Fatal

// Ví dụ v1.sql:
// CREATE TABLE TestcaseMeta (...);
// CREATE TABLE TestcaseData (...);
// ...
// PRAGMA user_version = 1;
```

---

## 11. PERFORMANCE CONSTRAINTS — Giới hạn bắt buộc

| Constraint | Giá trị | Lý do |
|---|---|---|
| TestcaseList render | Phải dùng virtualization | USB chậm, bài có thể 1000+ testcase |
| CodeMirror instance | Chỉ render khi testcase đang được chọn | Tránh tạo 100+ editor instance |
| DB write batch | Gom tối thiểu 50ms | Giảm write amplification lên USB |
| Binary cache | SHA-256, không recompile nếu source không đổi | Compile C++ tốn 2-5s |
| Output capture | Hard limit 4MB → OLE | Tránh OOM khi program in vô hạn |
| Temp files | Phải dùng RAM disk, xóa sau judge | Bảo vệ USB khỏi ghi nhiều |
| Thread count | Mặc định = CPU count / 2 | Giảm nóng máy khi chạy stress test |

---

## 12. KEYBOARD SHORTCUTS — Registry tập trung

```typescript
// src/hooks/useShortcuts.ts — đăng ký TẠI ĐÂY, không rải khắp component
// ⚠️ API ĐÚNG: useHotkeys('key', callback) — KHÔNG dùng object map

import { useHotkeys } from 'react-hotkeys-hook';

export function useShortcuts() {
  const judgeStore   = useJudgeStore();
  const layoutStore  = useLayoutStore();
  const testcaseStore = useTestcaseStore();
  const settingsStore = useSettingsStore();

  useHotkeys('f5',           () => judgeStore.runAll());
  useHotkeys('f6',           () => judgeStore.runActiveSubtask());
  useHotkeys('f9',           () => judgeStore.stopJudge());
  useHotkeys('ctrl+d',       () => layoutStore.toggleDiff());
  useHotkeys('ctrl+enter',   () => judgeStore.runSelected());
  useHotkeys('ctrl+n',       () => testcaseStore.addNew());
  useHotkeys('ctrl+shift+s', () => settingsStore.openSettings());
  useHotkeys('ctrl+g',       () => layoutStore.openGraphViewer());
}
// Gọi hook này một lần duy nhất trong App.tsx
```

---

## 13. WORKFLOW STARTUP (Thứ tự khởi động)

```
App start
   │
   ├─ 1. Đọc zetacp-settings.db (cạnh .exe)
   │       Nếu không tồn tại → tạo mới với default values
   │       Nếu không có quyền ghi → RAM-only + toast warning
   │
   ├─ 2. Chạy migration nếu cần
   │
   ├─ 3. Load GlobalSettings vào useSettingsStore
   │
   ├─ 4. Kiểm tra compiler paths (g++, python)
   │       Nếu thiếu → hiện badge "⚠ Compiler not found" trên toolbar
   │
   ├─ 5. Restore last opened project (từ RecentProjects)
   │       Nếu folder không còn tồn tại → bỏ qua, hiện welcome screen
   │
   └─ 6. Hiện giao diện
```

---

## 14. WORKFLOW MỞ FILE (Khi user click .cpp trong FileTree)

```
User click file.cpp
   │
   ├─ 1. useProjectStore.setActiveFile(path)
   │
   ├─ 2. Đọc source code từ disk vào Monaco Editor
   │
   ├─ 3. useTestcaseStore.loadForFile(path)
   │       → Rust: SELECT * FROM TestcaseMeta WHERE file_path = ?
   │       → Rust: SELECT * FROM TestcaseResult WHERE id IN (...)
   │       → Load vào RAM (metas + results)
   │       KHÔNG load TestcaseData (lazy)
   │
   ├─ 4. Render TestcaseList (chỉ metadata + result badge)
   │
   └─ 5. Khi user click 1 testcase trong list:
           → useTestcaseStore.loadData(id) nếu chưa có trong RAM
           → Render CodeMirror với input/expectedOutput
```

---

## 15. TASK BREAKDOWN — Thứ tự triển khai (Dependencies)

```
Phase 1 — Core Infrastructure (Không có dependency)
  [P1-1] Tauri project scaffold + cấu trúc thư mục
  [P1-2] Database module: open/create, migration runner, WAL mode
  [P1-3] Settings module: load/save zetacp-settings.db
  [P1-4] Zustand store skeletons (types only, no logic)
  [P1-5] Tauri Command bridge (tauri-bridge.ts typed wrappers)

Phase 2 — File System & Editor (Depends on P1)
  [P2-1] File tree: scan_directory, react-arborist integration, filter
  [P2-2] Monaco Editor: load file, autosave, language detect
  [P2-3] Open project command + load ZetaCP.db
  [P2-4] Compiler detection + compile command

Phase 3 — Testcase System (Depends on P1, P2)
  [P3-1] TestcaseMeta CRUD (add/delete/reorder/rename)
  [P3-2] TestcaseData lazy load + CodeMirror 6 editor
  [P3-3] Subtask group CRUD + score calculation
  [P3-4] Import testcase: Manual, Folder (.inp/.out), Competitive Companion

Phase 4 — Judge Engine (Depends on P2, P3)
  [P4-1] Binary cache (SHA-256)
  [P4-2] Process executor: spawn + timeout + output capture
  [P4-3] Sandbox: Job Object (Windows) + setrlimit/seccomp (Linux)
  [P4-4] Token checker + Exact checker
  [P4-5] rayon parallel judging + mpsc streamer
  [P4-6] Tauri event emission + Frontend listener
  [P4-7] Custom checker (testlib.h support)

Phase 5 — UI Polish (Depends on P3, P4)
  [P5-1] Diff viewer (Horizontal/Vertical toggle)
  [P5-2] Timing bars + verdict badges
  [P5-3] Parallel mode warning badge
  [P5-4] Keyboard shortcut registry

Phase 6 — Advanced Features (Depends on P4)
  [P6-1] Stress tester canvas (@xyflow/react nodes)
  [P6-2] Graph viewer (Rust analyzer → react-konva)
  [P6-3] Problem statement viewer (PDF/Markdown + floating window)
  [P6-4] Settings UI panel
```

---

## 16. CODING CONVENTIONS

### Rust
```rust
// ✅ Đúng
tracing::info!(file_path = %path, "Opening project");
tracing::error!(error = %e, "Failed to compile");

// ❌ Sai
println!("Opening project: {}", path);

// ✅ Đúng — luôn dùng ? operator, không unwrap() trong production code
let db = open_db(path).await?;

// ❌ Sai
let db = open_db(path).await.unwrap();

// ✅ Đúng — file_path luôn là relative path dạng String
// ❌ Sai — PathBuf tuyệt đối sẽ break portability
```

### TypeScript/React
```typescript
// ✅ Đúng — gọi Rust qua typed bridge
import { compileFile } from '@/lib/tauri-bridge';
const result = await compileFile({ filePath: 'relative/path.cpp', flags: ['-O2'] });

// ❌ Sai — gọi trực tiếp invoke không có type
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('compile_file', { ... });

// ✅ Đúng — path luôn là relative
const filePath = 'solutions/a.cpp';

// ❌ Sai — path tuyệt đối
const filePath = 'C:/Users/user/Desktop/solutions/a.cpp';
```

---

## 17. GLOSSARY

| Thuật ngữ | Định nghĩa trong ZetaCP |
|---|---|
| **Project** | Một thư mục chứa file .cpp/.py và ZetaCP.db |
| **Active File** | File .cpp/.py đang được mở trong Monaco Editor |
| **Testcase** | Cặp (input, expected_output) dùng để chấm bài |
| **Subtask** | Nhóm các testcase, tính điểm theo group |
| **Verdict** | Kết quả chấm: AC/WA/TLE/MLE/RE/OLE |
| **Judge** | Quá trình compile + chạy + so sánh kết quả |
| **Checker** | Chương trình so sánh actual vs expected output |
| **Stress Test** | Chạy 2 solution song song với random input để tìm bug |
| **Binary Cache** | Lưu lại .exe đã compile, tránh compile lại khi code không đổi |
| **Write-Through** | Ghi vào DB ngay lập tức sau khi ghi vào RAM |
| **Debounced Sync** | Ghi vào DB sau N giây không hoạt động |
| **Portable** | Chạy được từ USB mà không cần cài đặt, không cần quyền admin |
| **WAL mode** | SQLite Write-Ahead Logging — tối ưu performance ghi trên USB |
| **OLE** | Output Limit Exceeded — program in quá 4MB |
| **relative path** | Đường dẫn tính từ thư mục project, không phải ổ đĩa |

---

## 18. CHECKLIST TRƯỚC KHI SUBMIT CODE

- [ ] Không có path tuyệt đối nào trong code
- [ ] Không có `println!()` hay `console.log()` trong production path
- [ ] Không gọi `invoke()` trực tiếp — phải qua `tauri-bridge.ts`
- [ ] `db-sync.ts` KHÔNG ghi SQLite trực tiếp — chỉ gọi qua `tauri-bridge.ts` → Rust commands
- [ ] TestcaseData không được load khi mở file (chỉ lazy load)
- [ ] Mọi list/tree render phải có virtualization
- [ ] WAL mode được bật khi mở bất kỳ SQLite connection nào
- [ ] Temp files dùng `std::env::temp_dir()`, xóa sau khi judge xong (không dùng VHD/RAM disk trên Windows)
- [ ] `binary_path` trong CompileCache luôn là relative path
- [ ] Mọi ZetaError có trường `hint` để hiển thị cho user
- [ ] Judge bị cancel/cleanup khi user đóng file hoặc đổi project (xem Section 8a)

---

## 19. DEPENDENCY VERSIONS — Dùng đúng version, không tự chọn

### `src-tauri/Cargo.toml`

```toml
[package]
name = "zetacp"
version = "1.0.0"
edition = "2021"

[dependencies]
tauri        = { version = "2", features = ["protocol-asset"] }
tauri-build  = { version = "2", build-dependencies = true }
serde        = { version = "1", features = ["derive"] }
serde_json   = "1"
sqlx         = { version = "0.8", features = ["sqlite", "runtime-tokio", "macros"] }
tokio        = { version = "1", features = ["full"] }
rayon        = "1.10"
tracing      = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
thiserror    = "2"
sha2         = "0.10"
notify       = "6"              # File watcher cho fs://file_changed

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = ["Win32_System_JobObjects", "Win32_Security"] }
```

### `package.json` (frontend)

```json
{
  "dependencies": {
    "@tauri-apps/api":        "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-fs":  "^2",
    "@tauri-apps/plugin-shell": "^2",
    "react":                  "^18",
    "react-dom":              "^18",
    "zustand":                "^5",
    "@monaco-editor/react":   "^4.6",
    "@codemirror/view":       "^6",
    "@codemirror/state":      "^6",
    "react-arborist":         "^3",
    "@xyflow/react":          "^12",
    "react-konva":            "^18",
    "konva":                  "^9",
    "react-hotkeys-hook":     "^4",
    "tailwindcss":            "^3",
    "@radix-ui/react-tooltip": "^1",
    "@radix-ui/react-dialog":  "^1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "vite":            "^5",
    "vitest":          "^2",
    "@playwright/test": "^1.45"
  }
}
```

---

## 20. TESTING STRATEGY — Bắt buộc viết test song song với code

### Rust — Unit Tests

```rust
// Mỗi module Rust phải có section #[cfg(test)] bên trong file.
// Ví dụ: src-tauri/src/judge/checker.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_checker_ac() {
        let expected = "1 2 3\n";
        let actual   = "1  2   3\n";  // Whitespace khác vẫn là AC
        assert_eq!(token_check(expected, actual), Verdict::AC);
    }

    #[test]
    fn test_token_checker_wa() {
        let expected = "1 2 3\n";
        let actual   = "1 2 4\n";
        assert_eq!(token_check(expected, actual), Verdict::WA);
    }

    #[tokio::test]
    async fn test_migration_runs_cleanly() {
        let db = open_in_memory_db().await.unwrap();
        run_migrations(&db).await.unwrap();
        // Kiểm tra user_version
        let v: i32 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&db).await.unwrap();
        assert!(v >= 1);
    }
}

// Chạy: cargo test
```

### Frontend — Vitest

```typescript
// src/__tests__/validators.test.ts
import { describe, it, expect } from 'vitest';
import { validateJudgeConfig } from '@/lib/validators';

describe('validateJudgeConfig', () => {
  it('rejects empty filePath', () => {
    expect(() => validateJudgeConfig({ filePath: '', timeLimitMs: 1000, ... }))
      .toThrow('INVALID_INPUT');
  });
  it('accepts valid config', () => {
    expect(validateJudgeConfig({ filePath: 'a.cpp', timeLimitMs: 2000, ... }))
      .toBeTruthy();
  });
});

// Chạy: npx vitest run
```

### E2E — Playwright + Tauri Driver

```typescript
// tests/e2e/judge.spec.ts
import { test, expect } from '@playwright/test';
// Dùng tauri-driver để launch app thật:
// https://v2.tauri.app/develop/tests/webdriver/

test('F5 triggers judge and shows AC badge', async ({ page }) => {
  await page.goto('tauri://localhost');
  await page.keyboard.press('F5');
  await expect(page.locator('[data-verdict="AC"]')).toBeVisible({ timeout: 10000 });
});

// Chạy: npx playwright test
// Cần: cargo install tauri-driver
```

---

## 21. CRITICAL PATH WORKFLOW — Edit → F5 → Results (80% use case)

> Đây là flow QUAN TRỌNG NHẤT của app. Agent viết bất kỳ phần nào liên quan (editor, judge, events, UI) phải hiểu toàn bộ chain dưới đây.

```
User sửa code trong Monaco Editor
   │
   ├─ [useAutoSave.ts] Debounce 1s → ghi file lên disk (fs write)
   │
User bấm F5 (hoặc click Run All)
   │
   ├─ [useShortcuts.ts] → judgeStore.runAll()
   │
   ├─ [useJudgeStore.ts] → gọi tauri-bridge.runTests(config)
   │
   ├─ [tauri-bridge.ts] → invoke('run_tests', config)
   │
   ├─ [Rust: commands/judge.rs run_tests()]
   │   ├─ 1. db-sync: đảm bảo TestcaseData đã được ghi xuống DB (flush debounced writes)
   │   ├─ 2. Check CompileCache (SHA-256 source) → compile nếu cần
   │   ├─ 3. Spawn rayon workers (số thread = config.threads)
   │   │
   │   └─ Mỗi worker song song:
   │       ├─ Đọc TestcaseData từ DB
   │       ├─ Spawn child process với sandbox + timeout
   │       ├─ Capture stdout (max 4MB)
   │       ├─ Token/exact/custom check
   │       ├─ Ghi TestcaseResult vào DB (write-through)
   │       └─ mpsc::Sender.send(JudgeProgress)
   │
   ├─ [Rust: judge/streamer.rs] Nhận từ mpsc → app_handle.emit("judge://progress", payload)
   │
   ├─ [Frontend: useJudgeEvents.ts] listen("judge://progress") → useJudgeStore.updateResult()
   │
   ├─ [React re-render] TestcaseList cập nhật badge (AC/WA/TLE/...) real-time
   │
   └─ Khi tất cả testcase xong → emit "judge://complete" → judgeStore.setCompleted()
       → Toast summary: "X/Y AC"
```

**Cancel behavior (khi user đóng file hoặc đổi project trong lúc judge đang chạy):**
- Frontend gọi `invoke('stop_judge')` trước khi thực hiện thao tác tiếp theo.
- Rust: `stop_judge` abort `judge_handle` (JoinHandle), drop tất cả worker threads.
- Worker đang chạy sẽ bị cancelled; child process bị kill.
- Temp files được cleanup trong Drop impl của executor.
- Events "judge://progress" sau khi stop sẽ bị ignore ở frontend (check `judgeStore.isStopped`).

---

## 22. COMPETITIVE COMPANION PROTOCOL — Spec cho task P3-4

> Competitive Companion là browser extension gửi problem data từ Codeforces/VNOJ/... vào local app.

**Port:** `10042` (cố định, không configurable)  
**Protocol:** HTTP POST (không phải WebSocket)  
**Rust implementation:** Spawn một HTTP server nhỏ với `axum` hoặc `hyper` lắng nghe `localhost:10042`.

```rust
// src-tauri/src/commands/file_system.rs (hoặc tạo module riêng)

#[tauri::command]
async fn start_companion_listener(state: State<AppState>) -> Result<(), ZetaError>
// Lắng nghe POST http://localhost:10042
// Khi nhận payload → parse → emit event "companion://problem" về frontend
```

**Payload format (do Competitive Companion gửi):**

```json
{
  "name": "A. Two Sum",
  "group": "Codeforces Round 999",
  "url": "https://codeforces.com/contest/999/problem/A",
  "memoryLimit": 256,
  "timeLimit": 1000,
  "tests": [
    { "input": "3\n1 2 3\n", "output": "6\n" },
    { "input": "1\n42\n", "output": "42\n" }
  ],
  "testType": "single",
  "input":  { "type": "stdin" },
  "output": { "type": "stdout" }
}
```

**Frontend nhận event:**
```typescript
listen<CompanionPayload>('companion://problem', (event) => {
  // Import tests vào TestcaseStore
  event.payload.tests.forEach(t => testcaseStore.addNew(t.input, t.output));
});
```

---

## 23. FILE WATCHER IMPLEMENTATION — Spec cho fs://file_changed

```rust
// src-tauri/src/watcher/mod.rs

use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config};

pub fn start_watcher(root: &str, app_handle: AppHandle) -> Result<RecommendedWatcher, ZetaError> {
    let mut watcher = notify::recommended_watcher(move |res| {
        match res {
            Ok(event) => {
                if let Some(path) = event.paths.first() {
                    let rel = make_relative(path, &root);
                    app_handle.emit("fs://file_changed", serde_json::json!({ "path": rel })).ok();
                }
            }
            Err(e) => tracing::warn!("Watcher error: {}", e),
        }
    })?;

    watcher.watch(Path::new(root), RecursiveMode::Recursive)?;
    Ok(watcher)  // Lưu vào AppState để giữ watcher alive và để stop_watcher dùng
}
```

**AppState cần lưu watcher handle:**
```rust
pub struct AppState {
    // ... các field cũ ...
    pub file_watcher: Mutex<Option<RecommendedWatcher>>,
}
```

**Tauri commands cần thêm:**
```rust
#[tauri::command]
async fn start_file_watcher(root: String, app_handle: AppHandle, state: State<AppState>) -> Result<(), ZetaError>

#[tauri::command]
async fn stop_file_watcher(state: State<AppState>) -> Result<(), ZetaError>
```

---

## 24. CI/CD — GitHub Actions cho cross-platform build

```yaml
# .github/workflows/build.yml
name: Build ZetaCP

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Linux dependencies
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

      - name: Install frontend dependencies
        run: npm ci

      - name: Run frontend tests
        run: npx vitest run

      - name: Run Rust tests
        run: cargo test --manifest-path src-tauri/Cargo.toml

      - name: Build Tauri app
        run: npx tauri build

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: zetacp-${{ matrix.os }}
          path: src-tauri/target/release/bundle/
```

---

## 25. ACCESSIBILITY (A11Y) — Yêu cầu tối thiểu

> Keyboard-first là yêu cầu tự nhiên của CP tool. Implement đúng từ đầu, không retrofit sau.

```typescript
// Các yêu cầu bắt buộc:

// 1. Focus management — sau khi judge xong, focus về editor
judgeStore.onComplete(() => {
  monacoRef.current?.focus();
});

// 2. ARIA labels cho verdict badges
<ResultBadge
  verdict={result.lastStatus}
  aria-label={`Testcase ${meta.name}: ${result.lastStatus ?? 'Chưa chạy'}`}
/>

// 3. Keyboard navigation trong TestcaseList
// react-arborist và TestcaseList phải hỗ trợ Arrow Up/Down, Enter để chọn

// 4. Screen reader announcement khi judge xong
<div role="status" aria-live="polite" className="sr-only">
  {judgeStore.isComplete && `Judge xong: ${judgeStore.acCount}/${judgeStore.total} AC`}
</div>

// 5. FloatingWindow (Problem Statement) — trap focus khi mở, Escape để đóng
// Dùng @radix-ui/react-dialog đã handle sẵn focus trap

// 6. Color không phải cách duy nhất phân biệt verdict
// Badge phải hiển thị cả text (AC/WA/TLE) không chỉ màu xanh/đỏ
```

---

## 26. MODERN FLAT & INDUSTRIAL UI DESIGN RULES

These design rules define the look, layout sizes, and interactions for the ZetaCP IDE and must be strictly followed for any visual or front-end changes:

### 26a. Layout Dimensions & Sizing
* **Activity Bar:** Width is fixed at exactly `36px`. Sidebar panel triggers and items have a height of `36px` and icon sizes of `18px`.
* **Overlay Taskbar:** Height is fixed at exactly `24px`. It must have a 1px top border separator (`border-t border-[var(--zcp-border)]`).
* **Plus Button:** Placed at the right end of the taskbar. Its height is `18px` with a `text-[9px]` font configuration.
* **Tighter Layout Margins:** Margins between cards in list views (e.g. testcase overview items) should be kept to a minimum (`mb-0.5` or `2px`) to optimize vertical scroll space.
* **Separators:** Splitting panel resize separators must have a physical visual size of `1px` and use transparent backgrounds to enable a clean, borderless appearance.

### 26b. Testcase Overview Verdict Badges
* Do not render graphical progress bars or progress percentage labels. Use flat, compact status badge counters for each competitive programming verdict state.
* Badges must have zero borders (`border-none`) and perfectly square corners (`rounded-[2px]`).
* **Active Status Badges (Count > 0):** Solid, vibrant color-coded backgrounds with highly contrasting text colors:
  * **AC (Accepted):** Green (`#22C55E`) background with dark contrast text (`#111827`).
  * **WA (Wrong Answer):** Red (`#EF4444`) background with white text (`#ffffff`).
  * **TLE (Time Limit Exceeded):** Gray (`#6B7280`) background with white text (`#ffffff`).
  * **MLE (Memory Limit Exceeded):** Yellow (`#EAB308`) background with dark contrast text (`#111827`).
  * **RTE (Runtime Error):** Orange (`#F59E0B`) background with dark contrast text (`#111827`).
  * **RUN (Running):** Blue (`#007acc`) background with white text (`#ffffff`).
* **Inactive Status Badges (Count = 0):** Muted, translucent version of the status color with soft, light-colored text (e.g. `rgba(34, 197, 94, 0.15)` backdrop with `#86efac` text for `AC`) to remain readable but secondary to active errors.
* **CE Counter Excluded:** Do not include a Compilation Error (CE) badge in the overview counters. Compilation status is tracked inside the terminal.

### 26c. Output Console / Terminal Visibility
* **Closed by Default:** The terminal panel must initialize collapsed/hidden (`terminalOpen: false`) on launch or active file changes.
* **Automatic Error Expansion:** The terminal remains hidden during normal compile/run phases, and slides open automatically (`setTerminalOpen(true)`) only when compilation errors or execution exceptions are encountered.

### 26d. Global Webview Intercepts
* **Default Context Menu Blocked:** Implement `window.addEventListener("contextmenu", (e) => e.preventDefault())` globally to disable the web browser context menu.
* **Browser Hotkeys Blocked:** Block standard webview shortcuts globally via `window.addEventListener("keydown", ...)` (e.g. `F5`, `Ctrl+R` reloads, `Alt+Arrows` back/forward, `Ctrl+S` save, `Ctrl+P` print, `Ctrl+O` open, `Ctrl+N` new window, `Ctrl+T` tab, `Ctrl+W` close tab, `F11` fullscreen, and `F12` DevTools).
* **Bubbling and Editors:** Ensure editor-specific actions (like Monaco Editor's custom `Ctrl+F` search panel) function by catching key events inside the component and stopping event propagation.

### 26e. Uniform Theme Backgrounds
* **Diff Viewers:** Align all CodeMirror 6 editors, gutters, and diff container background colors in widgets and modals to exactly `#1f1f1f`.
* **Undecorated Windows:** Disable OS-level drop shadows (`.shadow(false)`) on all Tauri floating overlay widgets and diff windows.

---

*Tài liệu này là nguồn sự thật duy nhất (single source of truth) cho kiến trúc ZetaCP. Mọi quyết định thiết kế quan trọng phải được phản ánh tại đây trước khi implement.*
