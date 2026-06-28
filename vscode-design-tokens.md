# VSCode Design Tokens

**Ngày trích xuất:** 2026-06-19 | **Phiên bản VSCode:** 1.125.0

---

## MỤC A — Color Tokens

| Token gốc VSCode | Giá trị hex (Dark+) | Vai trò ngữ nghĩa (đặt tên role, vd: surface-1) | Dùng ở component nào |
|---|---|---|---|
| **Background (Độ sâu / Elevation)** | | | |
| `editor.background` | `#1E1E1E` | `surface-base` | Code Editor |
| `tab.selectedBackground` | `#222222` | `surface-1` | Selected Tab |
| `sideBar.background` | `#252526` | `surface-2` | Side Bar |
| `editorWidget.background` | `#252526` | `surface-2-overlay` | Editor Widgets (Find, Hover, v.v.) |
| `tab.inactiveBackground` | `#2D2D2D` | `surface-3` | Inactive Tabs |
| `activityBar.background` | `#333333` | `surface-4` | Activity Bar |
| `titleBar.activeBackground` | `#3C3C3C` | `surface-5` | Title Bar (Active window) |
| `statusBar.background` | `#007ACC` | `surface-accent` | Status Bar |
| `panel.background` | `#1E1E1E` | `surface-panel` | Bottom Panel (Terminal, Output, v.v.) |
| **Border** | | | |
| `focusBorder` | `#007FD4` | `border-focus` | General Focus Outline |
| `tab.border` | `#252526` | `border-tab` | Tab border |
| `widget.border` | `#303031` | `border-widget` | Dropdowns & overlay panels border |
| `editorGroup.border` | `#444444` | `border-editor-group` | Split editor separators |
| `panel.border` | `#80808059` | `border-panel` | Panel separator |
| `sideBar.border` | `N/A — không tìm thấy trong source` | `border-sidebar` | Side Bar border |
| `titleBar.border` | `N/A — không tìm thấy trong source` | `border-titlebar` | Title Bar border |
| `statusBar.border` | `N/A — không tìm thấy trong source` | `border-statusbar` | Status Bar border |
| `contrastBorder` | `N/A — không tìm thấy trong source` | `border-contrast` | High contrast separator border |
| **Text** | | | |
| `foreground` | `#CCCCCC` | `text-primary` | Overall workbench text |
| `editor.foreground` | `#D4D4D4` | `text-editor` | Code text |
| `descriptionForeground` | `#CCCCCCB3` | `text-secondary` | Labels description / muted text |
| `disabledForeground` | `#CCCCCC80` | `text-disabled` | Disabled UI elements text |
| **Accent** | | | |
| `selection.background` | `N/A — không tìm thấy trong source` | `accent-selection` | Input fields selection background |
| `editor.selectionBackground` | `#264F78` | `accent-selection-editor` | Selected code highlight |
| `editor.inactiveSelectionBackground` | `#3A3D41` | `selection-inactive-editor` | Selected code when editor loses focus |
| `textLink.foreground` | `#3794FF` | `accent-link` | Text links |
| `textLink.activeForeground` | `#3794FF` | `accent-link-active` | Hovered/Clicked text links |
| `editorLink.activeForeground` | `#4E94CE` | `link-active-editor` | Hovered code link |
| **Semantic** | | | |
| `errorForeground` | `#F48771` | `semantic-error` | Overall error messages |
| `editorError.foreground` | `#F14C4C` | `semantic-error-editor` | Editor error squiggles |
| `editorWarning.foreground` | `#CCA700` | `semantic-warning-editor` | Editor warning squiggles |
| `editorInfo.foreground` | `#59a4f9` | `semantic-info-editor` | Editor info squiggles |
| `editorGutter.addedBackground` | `#487E02` | `semantic-success` | Gutter added lines |
| `gitDecoration.addedResourceForeground` | `#81b88b` | `semantic-success-resource` | Added files in file tree |
| `gitDecoration.untrackedResourceForeground` | `#73C991` | `untracked-resource` | Untracked files in file tree |
| `charts.green` | `#89D185` | `semantic-success-chart` | Charts green bars/lines |

---

## MỤC B — Spacing & Sizing

| Khu vực / Component | Width (px) | Height (px) | Padding (px, ghi rõ 4 cạnh nếu khác nhau) | Gap/margin giữa item con (px) |
|---|---|---|---|---|
| Activity Bar | `48px` (`var(--activity-bar-width, 48px)`) | `100%` | `0px` | `margin-bottom: auto` (giữa composite bar và global composite bar), không có gap/margin giữa các item con |
| Sidebar | Resizable (chiều rộng tối thiểu: `170px`, mặc định tối ưu: `300px`) | `100%` | Title area: `0px 8px 0px 8px` (padding-left/right: 8px); Title label: `0px 0px 0px 12px` (padding-left: 12px) | Title actions: `margin-right: 4px`; Collapsible header actions: `margin-right: 0.2em` |
| Status Bar | `100%` | `22px` | StatusBar: `0px`; Item labels: `0px 5px` (compact: `0px 3px`, first/last/background items: `0px 8px`) | Item labels: `margin-left: 3px; margin-right: 3px` (compact: `5px` trái hoặc phải, first/last: `0px`) |
| Tab | `sizing-fit`: `120px` (min: `fit-content`); `sizing-shrink`: min `80px` (max: `fit-content`); `sizing-fixed`: `50px` - `160px`; `sticky-compact`: `38px`; `sticky-shrink`: `80px` | `35px` (normal) hoặc `22px` (compact) (`var(--editor-group-tab-height)`) | Mặc định: `padding-left: 10px` (nếu có icon và shrink/fixed: `5px`); Khi tab actions ở bên trái hoặc tắt: `padding-right: 10px` (shrink/fixed: `5px`) | Không có gap giữa các tab; Margin tab cuối cùng: `var(--last-tab-margin-right)`; Tab actions: `width: 28px` |
| Editor toolbar | `initial` (tự động theo nội dung) | `35px` (normal) hoặc `22px` (compact) | `padding-right: 8px` | `margin-right: 4px` (cho mỗi action item) |
| Panel | Resizable (chiều rộng tối thiểu: `300px`) | Resizable (chiều cao tối thiểu: `77px`, chiều cao ưa thích: `40%` của main container) | Title area: `0px 8px 0px 8px` (padding-left/right: 8px); Title label: `0px 0px 0px 12px` | Title actions: `margin-right: 4px`; Tab overflow action: `44px` |

`Scale: [ 2px, 4px, 8px, 12px, 16px, 20px ]`

---

## MỤC C — Typography

| Loại | Font-family | Font-size (px) | Font-weight | Line-height | Dùng ở đâu |
|---|---|---|---|---|---|
| UI font (menu, sidebar, label) | Windows: `"Segoe WPC", "Segoe UI", sans-serif`<br>Mac: `-apple-system, BlinkMacSystemFont, sans-serif`<br>Linux: `system-ui, "Ubuntu", "Droid Sans", sans-serif` | `13px` | `normal` (Tiêu đề, nhãn có thể dùng `600` hoặc `bold`) | `1.4em` | Menu, sidebar, panel, activitybar, labels, workbench UI |
| Monospace (editor) | Windows: `Consolas, 'Courier New', monospace`<br>Mac: `Menlo, Monaco, 'Courier New', monospace`<br>Linux: `'Droid Sans Mono', monospace` | Mac: `12px`<br>Windows/Linux: `14px` | `normal` | Mac: `18px` (`1.5 * fontSize`) <br>Windows/Linux: `19px` (`1.35 * fontSize`) | Khung soạn thảo mã nguồn (Code editor) |
| Monospace (terminal) | Mặc định kế thừa từ `editor.fontFamily` | Mac: `12px`<br>Windows/Linux: `14px` | Mặc định: `normal` (non-bold) / `bold` (bold) | Mac/Windows: `12px` / `14px` (`1.0 * fontSize`) <br>Linux: `1.1 * fontSize` (khoảng `15.4px`) | Integrated terminal |

---

## MỤC D — Border Radius & Elevation (shadow)

| Component | Border-radius (px) | Box-shadow (giá trị thật nếu có) | Ghi chú |
|---|---|---|---|
| Button | `4px` (cho `.monaco-text-button`), `0 4px 4px 0` / `4px 0 0 4px` (cho phần nút dropdown) | N/A — không tìm thấy trong source | Tìm thấy trong `src/vs/base/browser/ui/button/button.css` |
| Input | `4px` (cho `.monaco-inputbox`), `var(--vscode-cornerRadius-medium)` (cho input box bộ lọc trong Quick Input) | N/A — không tìm thấy trong source | Tìm thấy trong `src/vs/base/browser/ui/inputbox/inputBox.css` và `src/vs/platform/quickinput/browser/media/quickInput.css` |
| Dropdown/Quick pick | `var(--vscode-cornerRadius-large)` (Dropdown menu), `5px` (Dropdown with primary), `var(--vscode-cornerRadius-xLarge)` (Quick pick widget), `3px` (Dòng mục chọn) | `var(--vscode-shadow-lg)` (Dropdown menu, thực tế: `0 0 12px rgba(0, 0, 0, 0.14)`), `var(--vscode-shadow-xl)` (Quick pick widget, thực tế: `0 0 20px rgba(0, 0, 0, 0.15)`) | Tìm thấy trong `src/vs/base/browser/ui/dropdown/dropdown.css` và `src/vs/platform/quickinput/browser/media/quickInput.css` |
| Context menu | `var(--vscode-cornerRadius-large)` (Context menu container), `var(--vscode-cornerRadius-medium)` (Menu item) | `var(--vscode-shadow-lg)` (thực tế: `0 0 12px rgba(0, 0, 0, 0.14)`) | Các thuộc tính được tạo và áp dụng động bằng TypeScript trong `src/vs/base/browser/ui/menu/menu.ts` |
| Notification toast | `var(--vscode-cornerRadius-small)` (Toasts container), `4px` (Toast item), `var(--vscode-cornerRadius-small)` (Notifications center) | `var(--vscode-shadow-lg)` (thực tế: `0 0 12px rgba(0, 0, 0, 0.14)`) | Tìm thấy trong `src/vs/workbench/browser/parts/notifications/media/notificationsToasts.css` và `notificationsCenter.css` |
| Tooltip | `var(--vscode-cornerRadius-large)` (Hover widget container), `3px` (Thẻ code bên trong tooltip) | `var(--vscode-shadow-lg)` (thực tế: `0 0 12px rgba(0, 0, 0, 0.14)`) | Tìm thấy trong `src/vs/editor/contrib/hover/browser/hover.css` và `src/vs/base/browser/ui/hover/hoverWidget.css` |

---

## MỤC E — Component Interaction States

| Component | State | Thay đổi gì (màu nền/border/opacity...) |
|---|---|---|
| List item | hover | Thay đổi màu nền (`background-color: ${styles.listHoverBackground};`), màu chữ (`color: ${styles.listHoverForeground};`) và viền outline (`outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px;`) (tại `src/vs/base/browser/ui/list/listWidget.ts`). |
| List item | selected | Thay đổi màu nền (`background-color`), màu chữ (`color`), màu biểu tượng codicon (`color`), và viền outline (`outline: 1px solid` / `dotted`). Giá trị thay đổi tùy thuộc danh sách có đang được focus hay không (active/inactive selection) (tại `src/vs/base/browser/ui/list/listWidget.ts`). |
| List item | focus | Thay đổi màu nền (`background-color`), màu chữ (`color`), và viền outline (`outline: 1px solid` / `dotted`). Giá trị thay đổi tùy thuộc danh sách có đang được focus hay không (active/inactive focus) (tại `src/vs/base/browser/ui/list/listWidget.ts`). |
| Button | hover | Loại bỏ gạch chân chữ (`text-decoration: none !important;`). Thay đổi màu nền (`background-color`) sang màu hover tương ứng thông qua CSS variables hoặc được cập nhật động bằng script JS (tại `src/vs/base/browser/ui/button/button.css` và `button.ts`). |
| Button | active/pressed | N/A — không tìm thấy trong source |
| Tab | active | N/A — không tìm thấy trong source (không tồn tại component Tab trong thư mục `src/vs/base/browser/ui/`) |
| Tab | inactive | N/A — không tìm thấy trong source (không tồn tại component Tab trong thư mục `src/vs/base/browser/ui/`) |

---

## MỤC F — Icon System

| Thuộc tính | Giá trị |
|---|---|
| Icon size chuẩn (px) | 16px |
| Icon set/font dùng | `codicon` (Codicon font - từ `codicon.ttf`) |
| Stroke weight / style (line icon hay filled) | Line icon style, stroke weight chuẩn 1px (một số icon có phiên bản filled riêng biệt như `thumbsup-filled`, `pass-filled`...) |
| Màu icon mặc định (token nào) | `icon.foreground` |
| Màu icon khi active/selected (token nào) | Không có một token chung duy nhất; thay vào đó sử dụng các token cụ thể theo ngữ cảnh như: `list.activeSelectionIconForeground` (cho list/tree item selected và active), `inputOption.activeForeground` (cho input active option), hoặc `activityBar.foreground` (cho active Activity Bar item). |

---

## MỤC G — Layout Structure & Toolbar Logic

| Câu hỏi | Trả lời rút ra từ source/docs |
|---|---|
| Mỗi toolbar tối đa bao nhiêu action hiện trực tiếp trước khi vào overflow? | N/A — không có giới hạn cứng trong source; layout engine sẽ tự động tính toán dựa trên không gian hiển thị của UI và đẩy các action thừa vào menu overflow (`...`). |
| Quy tắc nhóm action (theo gì: chức năng, tần suất, nguy hiểm...)? | Nhóm theo chức năng liên quan (Group Related Items), tần suất sử dụng (các action chính/primary hiện trực tiếp, secondary đưa vào submenu/context menu/overflow), và ngữ cảnh sử dụng (Contextual Relevance) để giảm thiểu visual clutter. |
| Vị trí "global info" vs "contextual info" được tách thế nào (vd statusbar trái/phải)? | - Trái (Left/Primary): Dành cho "global info" của toàn bộ workspace (như trạng thái source control, problems/warnings, sync status).<br>- Phải (Right/Secondary): Dành cho "contextual info" của file đang hoạt động (như language mode, indentation, line endings, feedback). |
| Khi nào dùng button vs khi nào dùng link/text action? | - Button: Dành cho các hành động chính, quan trọng (Primary Actions - "Doing").<br>- Link/Text action: Dành cho điều hướng (Navigation - "Going") hoặc các hành động phụ (Secondary Actions) để tránh làm rối giao diện. |
| Tree/list item giới hạn bao nhiêu action hiển thị? | N/A — không giới hạn cứng về mặt kỹ thuật, nhưng khuyến nghị thiết kế giữ ở mức tối thiểu để tránh visual clutter. Các inline action chỉ xuất hiện khi hover hoặc chọn (selected). |

## MỤC H — Visual Style Philosophy

| Đặc điểm | Quan sát từ source | Hệ quả thiết kế |
|---|---|---|
| Flat vs Skeuomorphic | Hầu hết component dùng border-radius rất nhỏ (3-5px) hoặc =0; shadow chỉ xuất hiện ở layer nổi (dropdown, tooltip, notification) — KHÔNG dùng cho button/input/sidebar | Component "nằm trong layout chính" (sidebar, tab, statusbar, panel) phải FLAT tuyệt đối — không bo tròn lớn, không shadow. Chỉ component "nổi lên trên" (popup, menu, toast) mới được phép có shadow/radius lớn hơn |
| Elevation system | Có 2 loại "độ sâu": (1) màu nền phân tầng (surface-1→5) cho layout tĩnh, (2) shadow cho layer động/nổi | Đừng dùng shadow để phân biệt sidebar với editor — dùng màu nền khác nhau (đã có ở mục A). Shadow CHỈ dành cho overlay |
| Density | Tab height 35px/22px, statusbar 22px, padding ngang rất hẹp (3-10px) | Ưu tiên density cao tuyệt đối — không có "breathing room" kiểu consumer app |
| Border usage | Border mỏng 1px, màu rất nhạt (`panel.border` alpha ~35%), dùng để PHÂN TÁCH chứ không TRANG TRÍ | Border chỉ xuất hiện ở ranh giới layout (giữa sidebar/editor, giữa tab/content), không bọc quanh mọi block nhỏ |
| Icon vs decorative graphic | 100% dùng icon font (codicon) line-style, không ảnh minh họa, không illustration | Net-new component cũng phải dùng icon nhất quán, tuyệt đối tránh illustration/3D icon |
| Animation/transition | (cần kiểm tra thêm — đa số transition trong VSCode rất nhanh, ~100ms hoặc tắt hẳn) | Tránh animation chậm/bouncy kiểu mobile app |
