# ZetaCP — Project AI Governance Master Rules

> **Tài liệu quy tắc cốt lõi (Source of Truth) cho AI Agent và Nhà phát triển.**  
> File này được nạp tự động vào ngữ cảnh của AI Agent (Antigravity, Claude Code) cho dự án **ZetaCP2**. Tuân thủ nghiêm ngặt, không có ngoại lệ.

---

## 1. Stack Công Nghệ & Phân Cấp Ưu Tiên Quy Tắc

### Stack Tổng Quan
| Tầng | Công nghệ | Chi tiết kiến trúc |
|---|---|---|
| **Desktop Shell** | Tauri v2 | Rust backend + WebView frontend. Tối ưu portable, chạy từ USB. |
| **Frontend** | React 18 + TypeScript | Trình đóng gói Vite. |
| **State** | Zustand | Mỗi domain = 1 store (ví dụ: `useTestcaseStore`, `useProjectStore`). |
| **Styling** | TailwindCSS | Utility-first. Cấm inline style trừ phi chứa giá trị động. |
| **Database** | SQLite + `sqlx` | Tách biệt: `zetacp-settings.db` (global config) và `ZetaCP.db` (per-directory project data). |
| **Editor** | Monaco Editor | Engine chính; CodeMirror 6 cho testcase editor (virtualized). |

### Phân Cấp Ưu Tiên (Rule Hierarchy) & Giải Quyết Xung Đột
1. **Quy tắc đặc thù dự án (Section 2) có mức ưu tiên CAO NHẤT**. 
2. Các nguyên tắc chung (tránh over-engineering, YAGNI) **không được dùng** để biện minh cho việc copy-paste code chạy process, judge, hay sandbox. Việc tái sử dụng `judge::runner::execute_once` và `judge::orchestrator::execute_batch` là **bắt buộc**.
3. **Quy tắc Lỗi Tauri Commands:** Lỗi trả về frontend bắt buộc phải là `Result<T, ZetaError>`. Cấm trả về `Result<T, String>` thô (vi phạm sẽ làm crash trình hiển thị Toast lỗi của frontend).
4. **Quy tắc Tương Tác IPC:** Cấm gọi trực tiếp `invoke('cmd')` thô từ React components hoặc Zustand stores. Mọi lệnh gọi Rust phải đi qua API Client ở [src/lib/tauri-bridge.ts](file:///c:/ZetaCP2/src/lib/tauri-bridge.ts). Zustand stores sẽ là lớp trung gian chứa logic nghiệp vụ và gọi API qua bridge này.

---

## 2. Quy Tắc Đặc Thù Dự Án (ZetaCP Specific Rules)

### 2.1. Cấm tự viết lại hoặc nhân bản logic chạy Process / Judge / Sandbox
* Mọi tác vụ chạy process, chấm bài, chạy thử, chạy song song (parallel) **phải** sử dụng cơ sở hạ tầng có sẵn trong thư mục `judge/`.
* Tác vụ chạy một lần: Gọi `judge::runner::execute_once()`.
* Tác vụ chạy hàng loạt song song: Gọi `judge::orchestrator::execute_batch()`.
* Cấm tự ý viết `Command::new()`, tự tính concurrency bằng semaphore, hay tự viết logic phân tích verdict (TLE/WA/MLE) ở bất kỳ file nào ngoài `judge/`.

### 2.2. Tuyệt đối không dùng dữ liệu giả (Mock / Random / Placeholder)
* Cấm sử dụng `Math.random()`, `faker` hoặc hardcode số ngẫu nhiên để lấp đầy các trường thông tin hiển thị trên UI (như thời gian chạy `timeMs`, bộ nhớ `memoryKb`).
* Nếu backend chưa trả về dữ liệu, phải cập nhật backend để gửi đầy đủ payload hoặc hiển thị trạng thái "đang tải"/"chưa có dữ liệu" rõ ràng.

### 2.3. Quản lý lưu trữ kết quả chạy (Run Results)
* Mọi kết quả thực thi (kể cả tính năng tạm thời như stress test) phải được lưu trữ vào bảng dữ liệu `Runs` chung sử dụng cột `run_type` để phân loại. 
* Cấm tạo các bảng riêng biệt như `StressResult`, `ContestResult` gây loãng schema DB.

### 2.4. Nguyên tắc Thiết kế Database SQLite
* Phân biệt rõ: **Global settings** (lưu ở `zetacp-settings.db`) và **Project data** (lưu ở `ZetaCP.db`).
* Cấm tự ý thêm cột cấu hình mới vào các bảng config dùng chung (như `FileSettings`) làm phình bảng dữ liệu. Cấu hình mới cho tính năng riêng phải nằm ở bảng riêng biệt.
* Migration database: Thêm file migration `vN+1.sql` vào `src-tauri/src/db/migrations/` và đăng ký trong `mod.rs`.

### 2.5. Đồng bộ hóa Schema và Kiểu Dữ Liệu
* Toàn bộ Struct Rust truyền qua Tauri event/command phải gắn macro `#[serde(rename_all = "camelCase")]` để tương thích tự nhiên với TypeScript.
* Không viết lại logic tính toán ở Frontend nếu dữ liệu đó có thể tính ở Backend. Đưa toàn bộ vào event payload.

### 2.6. Quy trình xử lý lỗi lặp lại (Fixing Duplicated Bugs)
Nếu phát hiện cùng một lỗi xuất hiện ở nhiều module khác nhau:
1. Dừng lại, kiểm tra xem có sự sao chép code (copy-paste) giữa các module đó không.
2. Nếu có, đề xuất gộp phần code trùng lặp thành một abstraction chung.
3. Grep toàn repo để tìm kiếm và quét sạch mọi chỗ copy-paste tương tự còn sót lại.

---

## 3. Nguyên Tắc Viết Code Chung (Core Coding Principles)

### Thái Độ Với Code Cũ (Legacy Code)
* **Không bắt chước phong cách xấu của code cũ.** Khi sửa đổi một file, hãy refactor những phần bạn chạm tới theo đúng tiêu chuẩn mới.
* Nếu phát hiện lỗi thiết kế nghiêm trọng (God Class, lồng ghép quá sâu, hardcoding), hãy đề xuất kế hoạch refactor trước khi tiến hành nếu phạm vi ảnh hưởng vượt quá 3 files.

### Tiêu Chuẩn Chất Lượng Code
* **Độ dài hàm:** Một hàm không vượt quá 30 dòng (không tính dòng trống và comment).
* **Độ dài file:** Một file code không vượt quá 300 dòng.
* **Độ sâu lồng (Nesting depth):** Không lồng ghép cấu trúc điều kiện/vòng lặp quá 3 cấp. Dùng guard clause (early return) để làm phẳng code.
* **Tham số:** Một hàm nhận tối đa 4 tham số. Vượt quá 4 tham số phải chuyển sang dùng object.
* **Clean Code:** Xóa bỏ hoàn toàn code thừa, code bị comment-out thay vì giữ lại dưới dạng chú thích. Không sử dụng magic number/string, phải khai báo hằng số.

### Quy Tắc Đặt Tên (Naming Conventions)
* Tên hàm/biến: `camelCase` ở JS/TS; `snake_case` ở Rust.
* Tên kiểu dữ liệu (Class, Struct, Interface, Enum): `PascalCase` ở mọi ngôn ngữ.
* Hằng số: `SCREAMING_SNAKE_CASE` (ALL_CAPS).
* Biến Boolean: Phải có tiền tố `is`, `has`, `can`, `should`.
* Hàm xử lý sự kiện frontend: Bắt đầu bằng tiền tố `handle` (ví dụ: `handleClick`).

---

## 4. Quy Chuẩn Rust Backend

* **Clippy:** Code Rust phải vượt qua kiểm tra `cargo clippy` sạch sẽ, không có bất kỳ warning nào.
* **Safety & Process Sandbox:** Mọi hoạt động khởi chạy process con bắt buộc phải thực thi thông qua `judge::sandbox::run_in_sandbox()`. Cấm gọi `std::process::Command` trực tiếp.
* **Error Handling:** 
  * Cấm sử dụng `unwrap()` hoặc `expect()` trong runtime code (chỉ chấp nhận trong các tệp test hoặc script phụ trợ).
  * Định nghĩa lỗi rõ ràng bằng crate `thiserror`. Mọi command Tauri phải trả về kiểu `Result<T, ZetaError>`.
* **Bộ nhớ:** Ưu tiên truyền tham chiếu mượn (`&T`, `&str`) thay vì clone dữ liệu vô tội vạ. Chỉ clone khi gặp vấn đề về lifetime của borrow checker mà không thể cơ cấu lại code.

---

## 5. Quy Chuẩn Frontend (TypeScript, React, Styling)

### Quy Chuẩn React
* **Component:** Chỉ sử dụng Functional Components, cấm viết Class Components. Một tệp component React không dài quá 200 dòng.
* **State & Hook:**
  * Component chỉ chịu trách nhiệm render UI; logic nghiệp vụ phức tạp phải chuyển ra Custom Hook hoặc Zustand Store.
  * Custom Hook bắt buộc bắt đầu bằng tiền tố `use` (ví dụ: `useAuth.ts`).
  * Cấm dùng `// eslint-disable-next-line` để bỏ qua lỗi dependency array của `useEffect`.
  * `useEffect` có side-effect phải có hàm cleanup trả về. Không truyền trực tiếp hàm `async` vào `useEffect`.

### Quy Chuẩn TypeScript & IPC Bridge
* **Cấm dùng `any`:** Sử dụng `unknown` nếu kiểu dữ liệu chưa xác định, sau đó thu hẹp kiểu (type narrowing) bằng type guards.
* **Imports:** Import trực tiếp từ file nguồn, không tạo tệp barrel export `index.ts` vì dễ gây lỗi import vòng tròn (circular dependency). Tách riêng import kiểu dữ liệu: `import type { Type }`.
* **Ràng buộc Gọi API Rust:**
  * Component và Store **không được phép** trực tiếp gọi `invoke(...)` của Tauri.
  * Mọi lệnh gọi Rust phải gọi thông qua các hàm được định nghĩa kiểu tĩnh trong [src/lib/tauri-bridge.ts](file:///c:/ZetaCP2/src/lib/tauri-bridge.ts).
  * Nếu thêm command mới ở Backend, việc đầu tiên là phải khai báo hàm tương ứng có kiểu dữ liệu rõ ràng trong `tauri-bridge.ts` trước khi sử dụng ở các store khác.

### Quy Chuẩn Styling (TailwindCSS)
* Mọi styles phải sử dụng class của TailwindCSS. Cấm viết CSS thô hoặc custom class trong tệp CSS trừ phi định nghĩa biến màu gốc trong `:root`.
* Cấm dùng inline styles (`style={{ ... }}`) trừ khi giá trị đó là động (dynamic) và được tính toán liên tục từ JS (ví dụ: tọa độ kéo thả).

---

## 6. Quy Chuẩn Git & Commit

* Không tự động thực hiện commit code trừ khi có yêu cầu rõ ràng từ người dùng.
* Định dạng Commit Message chuẩn: `<type>(<scope>): <subject>`
  * Các loại `type` hợp lệ: `feat` (tính năng mới), `fix` (sửa lỗi), `docs` (tài liệu), `style` (format code, không ảnh hưởng runtime), `refactor` (tái cấu trúc code), `perf` (tối ưu hiệu năng), `test` (thêm testcase), `chore` (cấu hình build/tooling).
  * Viết hoa chữ cái đầu và có dấu cách sau dấu hai chấm.

---

## 7. Tài Liệu Kiến Trúc Tham Khảo
Khi bắt đầu làm việc với các phần chuyên sâu, hãy đọc các tài liệu sau để nắm được sơ đồ và thiết kế:
* **[ZETACP_GUIDE.md](file:///c:/ZetaCP2/ZETACP_GUIDE.md)**: Sơ đồ thư mục dự án, luồng chạy judge chi tiết, giải thích chi tiết cấu trúc app state và cơ chế cache.
* **Skill `zeta-api`**: Đặc tả chi tiết API hệ thống Notification, cấu trúc Schema của các bảng SQLite, bảng phân chia thứ tự Z-index của UI.
