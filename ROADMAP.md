# ZetaCP Development Roadmap

> **Mục tiêu:** Xây dựng ZetaCP trở thành CP IDE portable mạnh nhất, tối ưu hóa workflow cá nhân của lập trình viên thi đấu (Competitive Programming).
> **Phiên bản hiện tại:** v1.0.0 (Production Release)
> **Cập nhật:** 2026-06-13

---

## Tổng quan tiến độ

```
v1.0.0 ██████████████████████████████ Done — Core IDE + Judge Engine
v1.1.0 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Planned — Intelligent Editor
v1.2.0 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Planned — Online Judge Integration
v1.3.0 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Planned — Advanced Testing
v1.4.0 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Planned — Visualization & Analytics
v1.5.0 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Planned — Integrated Tools & Offline Library
```

---

## v1.0.0 — Core IDE & Judge Engine ✅ Released

Đã triển khai đầy đủ nền tảng cốt lõi:

- [x] Tauri v2 project scaffold + portable architecture
- [x] SQLite database (WAL mode) + migration system
- [x] File Explorer (react-arborist virtual tree)
- [x] Monaco Editor (syntax highlighting, autosave, multi-tab)
- [x] Testcase CRUD (add/delete/reorder/rename) + Subtask grouping
- [x] Lazy-load CodeMirror 6 testcase editor
- [x] Import testcase from folder (.inp/.out/.in/.ans)
- [x] Parallel Judge Engine (rayon workers + mpsc streaming)
- [x] Process Sandbox (Windows Job Object, memory/time limits)
- [x] Binary cache (SHA-256, skip recompile if source unchanged)
- [x] Multiple checker types (token, exact, floating-point, custom checker)
- [x] Side-by-side Diff Viewer (synchronized scroll)
- [x] Verdict badges & timing bars (AC/WA/TLE/MLE/RTE/OLE)
- [x] Desktop Overlay Widgets (Note Editor, PDF/Markdown/Image/Word Viewer, Scratchpad Canvas, Diff Widget)
- [x] Floating pinnable windows with minimize/maximize/close
- [x] Overlay Taskbar for widget management
- [x] Settings Panel (Compiler, Editor, Judge, Keyboard Shortcuts)
- [x] Session persistence (restore project, tabs, active file)
- [x] File watcher (auto-refresh tree on external changes)
- [x] Global keyboard shortcut registry (configurable)
- [x] Browser key blocking + context menu disabled
- [x] Terminal panel (xterm.js, auto-open on compile error only)
- [x] Custom Title Bar (frameless window)
- [x] Full English localization for CP terminology

---

## v1.1.0 — Intelligent Editor

> Nâng cấp trải nghiệm viết code ngang tầm VS Code, biến Monaco Editor thành
> một công cụ soạn thảo thông minh với gợi ý hàm, bắt lỗi real-time, và
> thư viện snippet thuật toán CP.

### 1.1.1 — Language Server Protocol (LSP)

**Mục tiêu:** Autocomplete, diagnostics, hover info, go-to-definition cho C++ và Python.

**C++ (clangd):**
- [ ] Nhúng `clangd.exe` vào bộ portable package (sidecar binary)
- [ ] Backend Rust: Spawn `clangd` như child process, giao tiếp stdin/stdout (JSON-RPC)
- [ ] Tạo WebSocket proxy trong Rust để bridge giữa Frontend và clangd
- [ ] Frontend: Tích hợp `monaco-languageclient` để kết nối Monaco ↔ WebSocket proxy
- [ ] Auto-generate `compile_flags.txt` từ compiler flags trong FileSettings
- [ ] Cấu hình Settings: đường dẫn clangd, bật/tắt LSP

**Python (pylsp):**
- [ ] Pre-install `python-lsp-server` vào bản Python portable đóng gói
- [ ] Backend Rust: Spawn `python -m pylsp` tương tự clangd
- [ ] Chia sẻ WebSocket proxy infrastructure với clangd
- [ ] Auto-switch LSP server khi chuyển tab giữa file .cpp và .py

**Kiến trúc LSP:**
```
Monaco Editor ←→ monaco-languageclient ←→ WebSocket ←→ Rust Proxy ←→ clangd/pylsp (stdio)
```

### 1.1.2 — Code Snippet & Template Manager

**Mục tiêu:** Thư viện snippet thuật toán CP có thể tùy chỉnh, chèn nhanh vào editor.

- [ ] Database table `Snippets` trong `zetacp-settings.db`:
  ```sql
  CREATE TABLE Snippets (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,          -- "Segment Tree"
      prefix TEXT NOT NULL,        -- "segtree" (trigger word)
      body TEXT NOT NULL,          -- Full code template
      category TEXT DEFAULT '',    -- "Data Structure", "Graph", "Math"
      language TEXT DEFAULT 'cpp', -- "cpp" | "py"
      order_index INTEGER DEFAULT 0
  );
  ```
- [ ] Built-in snippet pack: 30+ thuật toán CP phổ biến
  - Data Structures: Segment Tree, Fenwick/BIT, DSU, Sparse Table, Trie
  - Graph: BFS, DFS, Dijkstra, Bellman-Ford, Floyd, Kruskal, Prim, SCC (Tarjan), LCA
  - Math: Sieve, Modular Exponentiation, Matrix Exponentiation, Extended GCD
  - String: KMP, Z-function, Hashing, Suffix Array
  - Geometry: Convex Hull, Line Intersection
  - Misc: Binary Search template, Fast I/O template, Policy-based tree
- [ ] UI: Snippet Manager panel trong sidebar (Activity Bar icon)
  - Duyệt theo category, tìm kiếm theo tên/prefix
  - Xem preview code, nút Insert vào editor
  - Thêm/sửa/xóa snippet tùy chỉnh
- [ ] Monaco Integration: Đăng ký `CompletionItemProvider`
  - Gõ prefix → gợi ý snippet trong autocomplete dropdown
  - Hỗ trợ tab-stop placeholders (`$1`, `$2`, `$0`)
- [ ] Default Template: Tự động điền template khi tạo file `.cpp` mới
  ```cpp
  #include <bits/stdc++.h>
  using namespace std;

  int main() {
      ios::sync_with_stdio(false);
      cin.tie(nullptr);
      $0
      return 0;
  }
  ```

### 1.1.3 — Code Formatter

**Mục tiêu:** Tự động format code đẹp bằng một phím tắt.

- [ ] C++: Nhúng `clang-format` (có sẵn trong bộ LLVM cùng clangd)
  - Phím tắt `Shift+Alt+F` format toàn bộ file
  - Format on save (tùy chọn trong Settings)
  - Hỗ trợ custom `.clang-format` config file
- [ ] Python: Sử dụng `autopep8` hoặc `black` (pre-install vào Python portable)
- [ ] UI: Nút Format trên Editor Toolbar + indicator trên Status Bar

### 1.1.4 — Monaco Editor Advanced Integrations

**Mục tiêu:** Tích hợp sâu các tính năng của Monaco Editor để hỗ trợ viết code và sửa lỗi cực nhanh.

- [ ] **Lỗi biên dịch nội dòng (Inline Compile Markers):**
  - Tự động parse file, dòng và thông báo lỗi từ trình biên dịch (`g++`).
  - Gọi API `monaco.editor.setModelMarkers` hiển thị gạch đỏ răng cưa trực tiếp trong editor, rê chuột vào để xem nội dung lỗi mà không cần kiểm tra Terminal.
- [ ] **Code Lens hỗ trợ thực thi:**
  - Đăng ký `CodeLensProvider` cho file C++ và Python.
  - Hiển thị dòng text lơ lửng: `▶ Run Tests` | `⏹ Stop Judge` ngay phía trên hàm `int main()` để kích hoạt chạy testcase bằng chuột trực tiếp.
- [ ] **Lưu trạng thái Tab (View State Persistence):**
  - Sử dụng `editor.saveViewState()` và `editor.restoreViewState()` khi chuyển đổi tab file để giữ nguyên vị trí cuộn, vị trí con trỏ, các khối code đang thu gọn (folding) và đặc biệt là giữ nguyên Undo/Redo stack riêng biệt của từng file.
- [ ] **Vim Mode Toggle:**
  - Tích hợp `monaco-vim` và cấu hình bật/tắt trong Settings cho các lập trình viên quen dùng phím tắt Vim.
- [ ] **Custom Context Menu (Chuột phải thông minh):**
  - Thêm hành động: **"Create Testcase from Selection"** (bôi đen đoạn văn bản và tạo nhanh thành một testcase input) và **"Search in CP Library"** (bôi đen tên thuật toán để mở tài liệu hướng dẫn nhanh).
- [ ] **Tô màu cặp ngoặc nâng cao (Bracket Pair Colorizer):**
  - Kích hoạt `bracketPairColorization.enabled` và `guides.bracketPairs` mặc định để tránh nhầm lẫn ngoặc khi code lồng nhau nhiều tầng.
- [ ] **signature Help & Parameter Hints:**
  - Bật popup nhắc nhở tham số của hàm STL khi gõ dấu mở ngoặc đơn `(`.

### 1.1.5 — UX Fixes

- [ ] Ẩn cửa sổ CMD khi chạy trên Windows (`CREATE_NO_WINDOW` flag)
  - Áp dụng cho: `compiler.rs` (compile), `sandbox.rs` (run testcase)
  - Import `std::os::windows::process::CommandExt`
  - Gọi `.creation_flags(0x08000000)` trước `.spawn()` / `.output()`
- [ ] Welcome Screen khi chưa mở project
  - Nút "Open Folder" nổi bật
  - Danh sách Recent Projects (click để mở lại)
  - Hiển thị phím tắt chính
  - Auto-detect compiler (g++, python) và hiển thị trạng thái

---

## v1.2.0 — Online Judge Integration

> Kết nối trực tiếp với Codeforces, AtCoder, VNOJ và các trang thi đấu CP.
> Nhận đề bài tự động, nộp bài và theo dõi kết quả ngay trong app.

### 1.2.1 — Competitive Companion Listener

**Mục tiêu:** Nhận đề bài + testcase từ trình duyệt qua extension Competitive Companion.

- [ ] Backend Rust: HTTP server lắng nghe `localhost:10042`
  - Spawn async TCP listener trong tokio task
  - Parse HTTP POST body → JSON payload (name, tests, timeLimit, memoryLimit, url)
  - Emit Tauri event `companion://problem` về Frontend
- [ ] Frontend: Lắng nghe `companion://problem`
  - Tự động tạo testcase từ `tests[]` array
  - Cập nhật time/memory limit từ payload vào FileSettings
  - Toast notification: "Imported 3 testcases from Codeforces Round 999 - A"
- [ ] Tauri commands: `start_companion_listener`, `stop_companion_listener`
- [ ] Settings: Cấu hình port (mặc định 10042), bật/tắt auto-listen on startup

### 1.2.2 — Codeforces Submit & Verdict Tracking

**Mục tiêu:** Nộp bài và theo dõi kết quả trực tiếp từ ZetaCP.

**Phương án:** Nhúng `cf-tool.exe` (~5MB, binary Go) vào portable package.

- [ ] Nhúng `cf-tool.exe` vào bộ portable, cấu hình path trong Settings
- [ ] Tauri command `cf_login`: Spawn `cf-tool config` để đăng nhập Codeforces
  - Lưu session vào thư mục portable (không phải `~/.cf/`)
- [ ] Tauri command `cf_submit(contest_id, problem_index, file_path)`:
  - Spawn `cf-tool submit -f <file>`
  - Parse stdout để lấy submission ID
- [ ] Tauri command `cf_watch(submission_id)`:
  - Poll verdict từ Codeforces (hoặc spawn `cf-tool watch`)
  - Emit Tauri event `cf://verdict` real-time về Frontend
- [ ] Frontend UI:
  - Nút "Submit to CF" trên Editor Toolbar (chỉ hiện khi có problem URL)
  - Dialog nhập/xác nhận contest + problem index
  - Status Bar hiển thị verdict real-time: "Submitting..." → "Running on test 5..." → "Accepted (62ms)"
  - History panel: danh sách các lần submit gần đây kèm verdict
- [ ] Lưu problem URL vào `FileSettings` (tự động set khi nhận từ Competitive Companion)

### 1.2.3 — Contest Parse

**Mục tiêu:** Tải toàn bộ đề + testcase của cả contest một lần.

- [ ] Tauri command `cf_parse_contest(contest_id)`:
  - Spawn `cf-tool parse <contest_id>`
  - Tạo thư mục cho mỗi bài (A/, B/, C/...) với file template + testcase
- [ ] Frontend: Dialog nhập contest ID/URL → auto-create project structure
- [ ] Tự động mở project vừa tạo sau khi parse xong

### 1.2.4 — Problem Timer & Solve Tracker

**Mục tiêu:** Theo dõi thời gian giải bài cá nhân để cải thiện tốc độ và ghi nhận lịch sử.

- [ ] Timer widget trên Status Bar: `⏱ 00:12:35` (tự động bắt đầu khi mở bài mới hoặc nhận từ Competitive Companion, hỗ trợ pause/reset)
- [ ] Lưu thời gian giải mỗi bài vào DB (bảng `SolveHistory`)
  ```sql
  CREATE TABLE SolveHistory (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL,
      problem_url TEXT,
      solve_time_seconds INTEGER,
      verdict TEXT,
      submitted_at INTEGER
  );
  ```
- [ ] Widget thống kê lịch sử giải bài (Solve History Panel) hiển thị danh sách các bài đã hoàn thành và thời gian thực hiện.

---

## v1.3.0 — Advanced Testing

> Bộ công cụ debug và tìm lỗi chuyên sâu dành cho các bài khó,
> bao gồm stress test tự động, hỗ trợ bài interactive, và chế độ File I/O.

### 1.3.1 — Stress Tester Canvas

**Mục tiêu:** Giao diện kéo thả node-based để tạo pipeline stress test.

- [ ] Frontend: Stress Tester panel/tab mới
  - Sử dụng `@xyflow/react` (đã cài đặt) để dựng canvas
  - Các loại node:
    - **Generator Node:** Chọn file code sinh test ngẫu nhiên
    - **Solution Node:** File solution chính (cần test)
    - **Brute-force Node:** File solution chạy đúng nhưng chậm
    - **Checker Node:** So sánh output (token/exact/custom)
  - Kết nối node bằng edges (kéo thả)
  - Controls: Start/Stop, số iteration, seed range
- [ ] Backend Rust: `stress_test` command
  - Vòng lặp: Generator → tạo input → chạy Solution + Brute-force song song → compare
  - Khi phát hiện WA: dừng lại, emit event kèm counter-example
  - Auto-import testcase gây lỗi vào danh sách testcase chính
- [ ] Hiển thị tiến trình real-time: "Iteration #1523... all matched"
- [ ] Lưu cấu hình stress test vào DB per-file

### 1.3.2 — Interactive Problem Support

**Mục tiêu:** Chạy bài interactive (giao tiếp 2 chiều giữa solution và interactor).

- [ ] Chế độ judge mới: `io_mode = "interactive"`
- [ ] Backend Rust:
  - Spawn 2 child process: Solution + Interactor
  - Pipe stdout của Solution → stdin của Interactor và ngược lại
  - Timeout áp dụng cho toàn bộ phiên giao tiếp
  - Verdict dựa trên exit code của Interactor
- [ ] Frontend UI:
  - Tùy chọn "Interactive" trong FileSettings checker dropdown
  - Trường chọn file Interactor (tương tự custom checker)
  - Log panel hiển thị toàn bộ giao tiếp stdin/stdout giữa 2 process

### 1.3.3 — USACO / File I/O Mode

**Mục tiêu:** Hỗ trợ bài thi yêu cầu đọc/ghi file thay vì stdin/stdout (phổ biến trong HSG/USACO).

- [ ] FileSettings: Toggle "Use File I/O" + cấu hình tên file (ví dụ `problem.in`, `problem.out`)
- [ ] Judge engine: Thay vì pipe stdin/stdout, tạo file input trước khi chạy, đọc file output sau khi chạy xong
- [ ] Auto-detect từ đề bài nếu nhận qua Competitive Companion (field `input.type = "file"`)

### 1.3.4 — Run Only Failed & Duplicate Testcase

- [ ] Nút "Run Failed" chạy lại chỉ các testcase WA/RTE/TLE, bỏ qua AC
- [ ] Nút "Duplicate" nhân bản testcase đang chọn (1-click clone)
- [ ] Nút "Uncheck Accepted" bỏ chọn tất cả testcase đã AC

---

## v1.4.0 — Visualization & Analytics

> Trực quan hóa thuật toán, dữ liệu, và phân tích hiệu suất luyện tập.

### 1.4.1 — Graph Viewer & Analyzer

**Mục tiêu:** Vẽ đồ thị từ input/output, tự động phân tích cấu trúc đồ thị.

- [ ] Backend Rust (`src-tauri/src/graph/analyzer.rs`):
  - Parse danh sách cạnh từ text input
  - Thuật toán: SCC (Tarjan), Bridges, Articulation Points, Bipartite check
  - Layout algorithm: Force-directed (Fruchterman-Reingold)
  - Trả về JSON: nodes[] (x, y, color, label) + edges[] (from, to, type)
- [ ] Frontend: Graph Viewer panel
  - Sử dụng `react-konva` (đã cài đặt) để vẽ canvas
  - Kéo thả di chuyển các đỉnh, zoom/pan navigation
  - Toggle hiển thị đặc trưng: SCC colors, bridges (đỏ), articulation points (vàng)
  - Hỗ trợ: đồ thị có hướng/vô hướng, có trọng số/không trọng số
- [ ] Input modes: Paste text, đọc từ testcase input, đọc từ file

### 1.4.2 — Data Structure Visualizer

**Mục tiêu:** Hiển thị trạng thái mảng, cây, segment tree theo từng bước để debug trực quan.

- [ ] Array Visualizer: Thanh biểu đồ cho mảng số nguyên, highlight phần tử đang xét
- [ ] Tree Visualizer: Vẽ cây nhị phân/cây tổng quát từ danh sách cạnh hoặc mảng parent[]
- [ ] Segment Tree Visualizer: Hiển thị cấu trúc cây phân đoạn với giá trị tại mỗi node
- [ ] Step-by-step mode: Đọc output debug (`cerr` với format đặc biệt) và render từng bước thay đổi

### 1.4.3 — Solve Analytics Dashboard

**Mục tiêu:** Thống kê quá trình luyện tập CP dài hạn.

- [ ] Dashboard panel hiển thị:
  - Số bài giải theo ngày/tuần/tháng (biểu đồ heatmap kiểu GitHub)
  - Thời gian trung bình giải mỗi bài (theo difficulty rating)
  - Tỷ lệ verdict: % AC / WA / TLE trên tổng submission
  - Điểm yếu: category/tag nào hay bị WA nhất
- [ ] Dữ liệu lấy từ bảng `SolveHistory` (tạo ở v1.2.4)
- [ ] Export thống kê dạng CSV/JSON

### 1.4.4 — Search Across Files

- [ ] `Ctrl+Shift+F` mở panel tìm kiếm toàn project
- [ ] Tìm kiếm text/regex trong tất cả file .cpp/.py
- [ ] Hiển thị kết quả theo file, click để nhảy tới dòng tương ứng
- [ ] Backend Rust: command `search_in_project(query, root_path, is_regex)`

---

## v1.5.0 — Integrated Tools & Offline Library

> Tập trung loại bỏ thao tác Alt-Tab ra ngoài bằng cách nhúng các công cụ cần thiết vào IDE,
> hỗ trợ cả khi luyện tập và làm bài offline không có kết nối mạng.

### 1.5.1 — Embedded Problem Browser
**Mục tiêu:** Đọc đề bài trực tiếp bên trong IDE.
- [ ] Nhúng cửa sổ WebView phụ (Tauri Webview Window / Sub-panel) để hiển thị trang đề bài Codeforces, AtCoder, VNOJ.
- [ ] Tự động đồng bộ hóa: Khi Competitive Companion gửi bài, tự động mở trình duyệt nhúng bên cạnh Editor hiển thị đề bài.
- [ ] Tích hợp nút Submit nhanh trên thanh toolbar của browser nhúng.

### 1.5.2 — CP Math Toolkit
**Mục tiêu:** Máy tính nhanh các phép toán thường gặp trong CP, tránh mở Calculator ngoài.
- [ ] Panel tính toán nhanh các hàm số học:
  - Lũy thừa modular (`modpow(a, b, mod)`), nghịch đảo modular (`modinv(a, mod)`).
  - Tính tổ hợp (`nCr % mod`), chỉnh hợp.
  - Kiểm tra số nguyên tố (`isprime(n)`), phân tích thừa số nguyên tố (`factorize(n)`).
  - Đổi cơ số (Dec -> Bin/Hex/Oct).
- [ ] Liên kết: Cho phép bôi đen một số/công thức trong editor -> Chuột phải -> "Send to Math Toolkit".

### 1.5.3 — Smart Clipboard & Code Stripper
- [ ] Tự động tách input/output khi paste block văn bản mẫu từ đề bài (nhận diện qua từ khóa "Sample Input", "Ví dụ input",...).
- [ ] **Code Stripper:** Tự động loại bỏ các khối code debug (ví dụ: `#ifdef LOCAL ... #endif`, các câu lệnh debug in ra `cerr`) trước khi copy toàn bộ code để nộp bài hoặc gửi đi, tránh lỗi TLE hoặc WA do thừa log debug.

### 1.5.4 — Built-in CP Algorithm Library (Mini CP-Algorithms Offline)
**Mục tiêu:** Thư viện cẩm nang thuật toán tích hợp sẵn, cực kỳ hữu ích khi offline không có internet để tra cứu.
- [ ] Đóng gói ~60+ thuật toán/cấu trúc dữ liệu CP phổ biến dưới dạng file offline JSON:
  - **Data Structures:** Segment Tree (Lazy, Persistent), Fenwick, DSU, Sparse Table, HLD, Centroid Decomposition.
  - **Graph:** Dijkstra, SPFA, Tarjan (SCC), Bridges & Articulation Points, Dinic Max Flow, LCA, 2-SAT.
  - **Math & NT:** Sieve, CRT, NTT/FFT, Matrix Exponentiation, Extended GCD, Lucas Theorem.
  - **String:** KMP, Z-algo, Hashing, Suffix Array, Aho-Corasick, Manacher.
  - **DP Optimizations:** Convex Hull Trick, Divide & Conquer, Knuth Optimization.
  - **Geometry:** Convex Hull, Line Intersection, Point in Polygon.
- [ ] Mỗi thuật toán bao gồm: Giải thích lý thuyết ngắn gọn, độ phức tạp, và **Code mẫu C++ tối ưu**.
- [ ] Giao diện tra cứu nhanh (Quick Search Panel) ở Sidebar.
- [ ] Nút **"Insert Snippet"** để chèn trực tiếp code mẫu thuật toán vào file đang chỉnh sửa.

---

## Portable Package Structure (Full Bundle)

```
ZetaCP-v1.x-portable/
├── ZetaCP.exe                    # Ứng dụng chính (~20MB)
├── cf-tool.exe                   # Codeforces CLI tool (~5MB)
├── clangd.exe                    # C++ LSP server (~50MB)
├── clang-format.exe              # C++ formatter (~5MB)
├── mingw/                        # g++ compiler (~150MB)
│   └── bin/
│       └── g++.exe
├── python/                       # Python portable (~80MB)
│   ├── python.exe
│   └── Lib/site-packages/
│       ├── pylsp/                # Python LSP server
│       └── autopep8/             # Python formatter
├── zetacp-settings.db            # Auto-created on first run
└── session.json                  # Auto-created on first run

Tổng dung lượng ước tính: ~350MB (nén ZIP: ~170MB)
```

---

## So sánh ZetaCP vs CP Editor (sau khi hoàn thành roadmap)

| Tính năng | CP Editor | ZetaCP |
|---|---|---|
| Code Editor | QScintilla | **Monaco Editor (VS Code engine)** ✅ |
| LSP | clangd (tùy chọn) | **clangd + pylsp (tích hợp sẵn)** ✅ |
| Snippet | Đơn giản | **Thư viện snippet + 60+ thuật toán mẫu** ✅ |
| Formatter | clang-format / YAPF | **clang-format + autopep8** ✅ |
| Competitive Companion | ✅ | ✅ |
| Nộp bài Codeforces | cf-tool | **cf-tool + UI tích hợp** ✅ |
| Verdict tracking | Terminal | **Real-time UI + Status Bar** ✅ |
| Contest parse | cf-tool | **1-click + auto project setup** ✅ |
| Testcase Management | Cơ bản | **Subtask, import, checker, reorder** ✅ |
| Diff Viewer | ❌ | **Side-by-side sync scroll** ✅ (Tích hợp Monaco DiffEditor) |
| Stress Tester | ❌ | **Node-based canvas** ✅ |
| Interactive Problems | ❌ | **2-way pipe support** ✅ |
| Graph Viewer | ❌ | **SCC/Bridge/Articulation** ✅ |
| DS Visualizer | ❌ | **Array/Tree/SegTree** ✅ |
| File Explorer | ❌ (single file) | **Full project tree** ✅ |
| Parallel Judge | ❌ | **rayon multi-thread + sandbox** ✅ |
| Overlay Widgets | ❌ | **Note/PDF/Scratchpad floating** ✅ |
| Problem Timer / Tracker| ❌ | **Stopwatch + Solve History Dashboard** ✅ |
| Analytics | ❌ | **Solve history + dashboard** ✅ |
| Portable | ✅ | **✅ All-in-one USB package** |
| File I/O mode | ❌ | **USACO-style support** ✅ |
| Embedded Browser | ❌ | **Nhúng Webview đề bài** ✅ |
| Math Toolkit | ❌ | **Phép toán CP nhanh tích hợp** ✅ |
| Smart Clipboard | ❌ | **Tách input/output & Code Stripper** ✅ |
| Offline Reference | ❌ | **Mini CP-Algorithms Offline** ✅ |
