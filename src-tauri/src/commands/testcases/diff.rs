// src-tauri/src/commands/testcases/diff.rs

use crate::errors::ZetaError;
use super::types::DiffLine;

#[tauri::command]
pub async fn compute_diff(
    expected: String,
    actual: String,
) -> Result<Vec<DiffLine>, ZetaError> {
    // Chỉ chuẩn hóa CRLF → LF để hiển thị đúng trong editor.
    // Giữ nguyên toàn bộ raw data còn lại để diff phản ánh đúng output thực tế.
    let expected_clean = expected.replace("\r\n", "\n");
    let actual_clean   = actual.replace("\r\n", "\n");

    // Dùng split('\n') thay vì .lines() vì:
    //   .lines() tự strip trailing newline → "5\n" và "5" trông giống hệt nhau
    //   split('\n') giữ nguyên: "5\n" → ["5", ""] còn "5" → ["5"]
    //   → trailing newline trở thành dòng rỗng "" có thể nhìn thấy trong diff
    let expected_parts: Vec<&str> = expected_clean.split('\n').collect();
    let actual_parts: Vec<&str>   = actual_clean.split('\n').collect();

    // Phân biệt "dòng rỗng tồn tại" vs "dòng không tồn tại" (do một bên ngắn hơn):
    //   - Some("")  → dòng tồn tại, nội dung rỗng (có thể là trailing newline)
    //   - None      → dòng không tồn tại → hiển thị sentinel "\\ No newline at end"
    //     (cùng ký hiệu với git diff)
    const ABSENT: &str = "\\ No newline at end of file";

    let max_lines = expected_parts.len().max(actual_parts.len());
    let mut details = Vec::new();

    for idx in 0..max_lines {
        let exp = match expected_parts.get(idx).copied() {
            Some(s) => s.to_string(),
            None    => ABSENT.to_string(),
        };
        let act = match actual_parts.get(idx).copied() {
            Some(s) => s.to_string(),
            None    => ABSENT.to_string(),
        };
        details.push(DiffLine {
            line: (idx + 1) as i32,
            expected: exp,
            actual:   act,
        });
    }

    Ok(details)
}
