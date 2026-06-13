# ZetaCP Frontend Tasks

- [x] Cập nhật `src/types/testcase.ts` để thêm các trường checker vào `FileSettings`.
- [x] Sửa `src/stores/useTestcaseStore.ts` để:
   - Truyền `filePath: get().activeFilePath` vào tất cả các Tauri command thao tác cơ sở dữ liệu (`load_testcase_data`, `delete_testcase`, `delete_subtask`, `assign_to_subtask`, `update_testcase_data`, `toggle_testcase_active`).
   - Sửa `simulateRun` để nếu là file `.cpp`, tự động gọi `saveActiveFile()` sau đó gọi `compile_file` trước khi chạy. In kết quả dịch ra Output Console. Nếu dịch lỗi thì hủy (abort) không chạy testcase.
   - Trong `loadForFile`, đảm bảo lazy loading: chỉ load subtasks, metas, results, settings. Phần `loadedData` luôn được reset về rỗng để load sau.
- [x] Sửa `src/App.tsx` để xóa bỏ hoàn toàn phần Toolbar (h-8 chứa nút Biên dịch) dưới Custom Title Bar.
- [x] Tạo component `src/components/TestcasePanel/DiffViewerModal.tsx` hiển thị so sánh Side-by-side hoặc Top-bottom, có hiển thị màu sắc và đồng bộ cuộn (sync scroll) dựa trên hover.
- [x] Sửa `src/components/TestcasePanel/TestcaseItem.tsx` để thêm nút "Diff" ở mỗi testcase khi có status WA. Khi bấm sẽ gọi backend `compute_diff` và hiển thị `DiffViewerModal`.
- [x] Sửa `src/components/TestcasePanel/TestcasePanel.tsx` để thêm cấu hình Checker trong Settings modal:
   - Các lựa chọn checker chuẩn và custom checkers.
   - Ô chọn file checker (gọi `selectProjectFolder` hoặc file picker).
   - Tự động gọi `compile_checker` khi chọn file checker và thông báo lỗi/thành công.
