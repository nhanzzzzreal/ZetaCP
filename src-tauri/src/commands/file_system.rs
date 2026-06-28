// src-tauri/src/commands/file_system.rs

pub mod helper;

use std::path::Path;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use crate::errors::ZetaError;
use crate::state::AppState;
use helper::*;

#[tauri::command]
pub async fn open_project(
  folder_path: String,
  state: State<'_, AppState>,
) -> Result<ProjectInfo, ZetaError> {
  open_project_impl(folder_path, &state).await
}

#[tauri::command]
pub async fn scan_directory(
  folder_path: String,
  filter: FileFilter,
) -> Result<Vec<FileNode>, ZetaError> {
  let root = Path::new(&folder_path);
  if !root.exists() || !root.is_dir() {
    return Err(ZetaError::InvalidInput {
      message: format!("Thư mục không tồn tại: {}", folder_path),
    });
  }

  let nodes = scan_dir_recursive(root, root, &filter)?;
  Ok(nodes)
}

#[tauri::command]
pub async fn read_text_file(
  file_path: String,
  project_root: String,
) -> Result<String, ZetaError> {
  let root = Path::new(&project_root);
  let full_path = root.join(&file_path);

  if !full_path.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Không tìm thấy tệp tin: {}", file_path),
    });
  }

  let content = std::fs::read_to_string(&full_path)
    .map_err(|e| ZetaError::Io(format!("Lỗi đọc tệp {}: {}", file_path, e)))?;

  Ok(content)
}

#[tauri::command]
pub async fn write_text_file(
  file_path: String,
  content: String,
  project_root: String,
) -> Result<(), ZetaError> {
  let root = Path::new(&project_root);
  let full_path = root.join(&file_path);

  if let Some(parent) = full_path.parent() {
    if !parent.exists() {
      std::fs::create_dir_all(parent)
        .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục cha cho file {}: {}", file_path, e)))?;
    }
  }

  std::fs::write(&full_path, content)
    .map_err(|e| ZetaError::Io(format!("Lỗi ghi tệp {}: {}", file_path, e)))?;

  Ok(())
}

#[tauri::command]
pub async fn select_project_folder(
  app_handle: tauri::AppHandle,
) -> Result<Option<String>, ZetaError> {
  let (tx, rx) = tokio::sync::oneshot::channel();
  
  app_handle.dialog().file().pick_folder(move |folder| {
    let _ = tx.send(folder);
  });
  
  let folder = rx.await.map_err(|e| ZetaError::Fatal(format!("Lỗi hộp thoại chọn thư mục: {}", e)))?;
  
  Ok(folder.map(|f| match f {
    tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
    tauri_plugin_dialog::FilePath::Url(u) => u.to_string(),
  }))
}

#[tauri::command]
pub async fn select_checker_file(
  app_handle: tauri::AppHandle,
) -> Result<Option<String>, ZetaError> {
  let (tx, rx) = tokio::sync::oneshot::channel();
  
  app_handle.dialog().file().pick_file(move |file| {
    let _ = tx.send(file);
  });
  
  let file = rx.await.map_err(|e| ZetaError::Fatal(format!("Lỗi hộp thoại chọn tệp: {}", e)))?;
  
  Ok(file.map(|f| match f {
    tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
    tauri_plugin_dialog::FilePath::Url(u) => u.to_string(),
  }))
}

#[tauri::command]
pub async fn create_file(
  file_path: String,
  project_root: String,
) -> Result<(), ZetaError> {
  let root = Path::new(&project_root);
  let full_path = root.join(&file_path);

  if full_path.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Tệp tin đã tồn tại: {}", file_path),
    });
  }

  if let Some(parent) = full_path.parent() {
    if !parent.exists() {
      std::fs::create_dir_all(parent)
        .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục cha cho file {}: {}", file_path, e)))?;
    }
  }

  std::fs::File::create(&full_path)
    .map_err(|e| ZetaError::Io(format!("Lỗi tạo tệp {}: {}", file_path, e)))?;

  Ok(())
}

#[tauri::command]
pub async fn create_directory(
  dir_path: String,
  project_root: String,
) -> Result<(), ZetaError> {
  let root = Path::new(&project_root);
  let full_path = root.join(&dir_path);

  if full_path.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Thư mục đã tồn tại: {}", dir_path),
    });
  }

  std::fs::create_dir_all(&full_path)
    .map_err(|e| ZetaError::Io(format!("Lỗi tạo thư mục {}: {}", dir_path, e)))?;

  Ok(())
}

#[tauri::command]
pub async fn rename_item(
  old_path: String,
  new_path: String,
  project_root: String,
) -> Result<(), ZetaError> {
  rename_item_impl(&old_path, &new_path, &project_root)
}

#[tauri::command]
pub async fn delete_item(
  item_path: String,
  project_root: String,
) -> Result<(), ZetaError> {
  delete_item_impl(&item_path, &project_root)
}

#[tauri::command]
pub async fn reveal_in_explorer(
  item_path: String,
  project_root: String,
  app_handle: tauri::AppHandle,
) -> Result<(), ZetaError> {
  let root = Path::new(&project_root);
  let full_path = root.join(&item_path);

  if !full_path.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Không tìm thấy đối tượng: {}", item_path),
    });
  }

  reveal_path_in_system(&full_path, &app_handle)
}

#[tauri::command]
pub async fn start_file_watcher(
  root: String,
  state: State<'_, AppState>,
  app_handle: tauri::AppHandle,
) -> Result<(), ZetaError> {
  {
    let mut watcher_guard = state.file_watcher.lock().await;
    *watcher_guard = None;
  }

  let root_path = Path::new(&root).to_path_buf();
  if !root_path.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Thư mục không tồn tại: {}", root),
    });
  }

  use notify::Watcher;

  let mut watcher = create_recommended_watcher(app_handle)?;
  watcher.watch(&root_path, notify::RecursiveMode::Recursive)
    .map_err(|e| ZetaError::Io(format!("Lỗi bắt đầu watch: {}", e)))?;

  {
    let mut watcher_guard = state.file_watcher.lock().await;
    *watcher_guard = Some(watcher);
  }

  Ok(())
}

#[tauri::command]
pub async fn stop_file_watcher(
  state: State<'_, AppState>,
) -> Result<(), ZetaError> {
  let mut watcher_guard = state.file_watcher.lock().await;
  *watcher_guard = None;
  Ok(())
}
