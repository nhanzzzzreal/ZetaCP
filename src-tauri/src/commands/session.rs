// src-tauri/src/commands/session.rs

use crate::errors::ZetaError;

/// Trạng thái phiên làm việc được lưu cạnh .exe
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct SessionState {
    /// Thư mục dự án đang mở (absolute path)
    #[serde(rename = "rootPath")]
    pub root_path: Option<String>,
    /// Danh sách các file đang mở (relative paths)
    #[serde(rename = "openTabs")]
    pub open_tabs: Vec<String>,
    /// File đang active (relative path)
    #[serde(rename = "activeFile")]
    pub active_file: Option<String>,
}

/// Trả về đường dẫn file session.json cạnh .exe
fn session_file_path() -> std::path::PathBuf {
    let mut exe_dir = std::env::current_exe()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    exe_dir.pop();
    exe_dir.join("zetacp-session.json")
}

#[tauri::command]
pub async fn save_session(session: SessionState) -> Result<(), ZetaError> {
    let path = session_file_path();
    let json = serde_json::to_string_pretty(&session)
        .map_err(|e| ZetaError::Fatal(format!("Lỗi serialize session: {}", e)))?;
    std::fs::write(&path, json)
        .map_err(|e| ZetaError::Io(format!("Không thể ghi session file tại {:?}: {}", path, e)))?;
    Ok(())
}

#[tauri::command]
pub async fn load_session() -> Result<SessionState, ZetaError> {
    let path = session_file_path();
    if !path.exists() {
        return Ok(SessionState {
            root_path: None,
            open_tabs: vec![],
            active_file: None,
        });
    }
    let json = std::fs::read_to_string(&path)
        .map_err(|e| ZetaError::Io(format!("Không thể đọc session file: {}", e)))?;
    let state: SessionState = serde_json::from_str(&json)
        .unwrap_or(SessionState {
            root_path: None,
            open_tabs: vec![],
            active_file: None,
        });
    Ok(state)
}
