use sqlx::SqlitePool;
use tokio::sync::Mutex;
use notify::RecommendedWatcher;
use std::collections::HashMap;
use crate::errors::ZetaError;

pub struct AppState {
    pub settings_db: SqlitePool,                // Pool kết nối zetacp-settings.db (global)
    pub project_dbs: Mutex<HashMap<String, SqlitePool>>,  // Cache pools kết nối ZetaCP.db theo thư mục cha
    pub project_root: Mutex<Option<String>>,    // Đường dẫn tuyệt đối của project đang mở
    pub judge_handle: Mutex<Option<tokio::task::JoinHandle<()>>>, // Handle để dừng judge
    pub file_watcher: Mutex<Option<RecommendedWatcher>>, // Watcher quản lý thay đổi file
}

impl AppState {
    pub async fn get_db_pool(&self, file_path: &str, create_if_missing: bool) -> Result<Option<SqlitePool>, ZetaError> {
        let path = std::path::Path::new(file_path);
        let abs_path = if path.is_relative() {
            let root_guard = self.project_root.lock().await;
            if let Some(ref root) = *root_guard {
                std::path::Path::new(root).join(path)
            } else {
                path.to_path_buf()
            }
        } else {
            path.to_path_buf()
        };
        
        let parent = abs_path.parent().ok_or_else(|| ZetaError::InvalidInput {
            message: format!("Không thể tìm thư mục cha của file: {}", file_path),
        })?;
        
        let parent_dir = parent.to_string_lossy().to_string();
        
        // Kiểm tra xem pool đã tồn tại trong cache chưa
        {
            let dbs = self.project_dbs.lock().await;
            if let Some(pool) = dbs.get(&parent_dir) {
                return Ok(Some(pool.clone()));
            }
        }
        
        // Kiểm tra xem file DB đã tồn tại chưa
        let zeta_cp_dir = parent.join(".ZetaCP");
        let db_path = zeta_cp_dir.join("ZetaCP.db");
        
        if !create_if_missing && !db_path.exists() {
            return Ok(None);
        }
        
        // Tạo thư mục .ZetaCP nếu chưa có
        if !zeta_cp_dir.exists() {
            std::fs::create_dir_all(&zeta_cp_dir)
                .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục .ZetaCP tại {}: {}", parent_dir, e)))?;
        }
        
        // Mở kết nối SQLite pool
        let db_path_str = db_path.to_string_lossy().to_string();
        let pool = crate::db::open_db(&db_path_str).await?;
        
        // Lưu trữ vào cache
        let mut dbs = self.project_dbs.lock().await;
        dbs.insert(parent_dir, pool.clone());
        
        Ok(Some(pool))
    }
}
