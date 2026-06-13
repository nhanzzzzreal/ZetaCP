// src-tauri/src/commands/file_system.rs

use std::path::Path;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use crate::errors::ZetaError;
use crate::state::AppState;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ProjectInfo {
  #[serde(rename = "rootPath")]
  pub root_path: String,
  #[serde(rename = "dbPath")]
  pub db_path: String,
  #[serde(rename = "dbWasNew")]
  pub db_was_new: bool,
  #[serde(rename = "recentFiles")]
  pub recent_files: Vec<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileNode {
  pub name: String,
  pub path: String, // Relative path from project root
  #[serde(rename = "isDir")]
  pub is_dir: bool,
  pub children: Vec<FileNode>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileFilter {
  pub show: Vec<String>,
  pub hide: Vec<String>,
}

fn get_recent_files(root: &str) -> Vec<String> {
  let mut files = Vec::new();
  if let Ok(entries) = std::fs::read_dir(root) {
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_file() {
        if let Some(ext) = path.extension() {
          let ext_str = ext.to_string_lossy().to_lowercase();
          if ext_str == "cpp" || ext_str == "py" {
            if let Ok(rel) = path.strip_prefix(root) {
              let rel_str = rel.to_string_lossy().to_string().replace('\\', "/");
              files.push(rel_str);
            }
          }
        }
      }
    }
  }
  files.truncate(10);
  files
}

fn should_show_file(name: &str, filter: &FileFilter) -> bool {
  let ext = if let Some(pos) = name.rfind('.') {
    name[pos..].to_lowercase()
  } else {
    "".to_string()
  };

  if filter.hide.iter().any(|h| h.to_lowercase() == ext) {
    return false;
  }

  if !filter.show.is_empty() {
    return filter.show.iter().any(|s| s.to_lowercase() == ext);
  }

  true
}

fn scan_dir_recursive(root_path: &Path, current_path: &Path, filter: &FileFilter) -> Result<Vec<FileNode>, std::io::Error> {
  let mut nodes = Vec::new();
  if let Ok(entries) = std::fs::read_dir(current_path) {
    for entry in entries.flatten() {
      let path = entry.path();
      let name = entry.file_name().to_string_lossy().to_string();

      if name.starts_with('.') {
        continue;
      }

      let is_dir = path.is_dir();
      let rel_path = path.strip_prefix(root_path)
        .unwrap_or(&path)
        .to_string_lossy()
        .to_string()
        .replace('\\', "/");

      if is_dir {
        let children = scan_dir_recursive(root_path, &path, filter)?;
        nodes.push(FileNode {
          name,
          path: rel_path,
          is_dir: true,
          children,
        });
      } else if should_show_file(&name, filter) {
        nodes.push(FileNode {
          name,
          path: rel_path,
          is_dir: false,
          children: Vec::new(),
        });
      }
    }
  }

  nodes.sort_by(|a, b| {
    if a.is_dir != b.is_dir {
      b.is_dir.cmp(&a.is_dir)
    } else {
      a.name.cmp(&b.name)
    }
  });

  Ok(nodes)
}

#[tauri::command]
pub async fn open_project(
  folder_path: String,
  state: State<'_, AppState>,
) -> Result<ProjectInfo, ZetaError> {
  let root = Path::new(&folder_path);
  if !root.exists() || !root.is_dir() {
    return Err(ZetaError::InvalidInput {
      message: format!("Thư mục không tồn tại: {}", folder_path),
    });
  }

  {
    let mut proj_root = state.project_root.lock().await;
    *proj_root = Some(folder_path.clone());
  }

  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs() as i64;

  sqlx::query(
    "INSERT INTO RecentProjects (path, last_open) VALUES (?, ?) \
     ON CONFLICT(path) DO UPDATE SET last_open = excluded.last_open"
  )
  .bind(&folder_path)
  .bind(now)
  .execute(&state.settings_db)
  .await
  .ok();

  let recent_files = get_recent_files(&folder_path);

  Ok(ProjectInfo {
    root_path: folder_path,
    db_path: String::new(),
    db_was_new: false,
    recent_files,
  })
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
  let root = Path::new(&project_root);
  let old_full = root.join(&old_path);
  let new_full = root.join(&new_path);

  if !old_full.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Không tìm thấy đối tượng cần đổi tên: {}", old_path),
    });
  }

  if new_full.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Tên mới đã tồn tại: {}", new_path),
    });
  }

  if let Some(parent) = new_full.parent() {
    if !parent.exists() {
      std::fs::create_dir_all(parent)
        .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục cha cho {}: {}", new_path, e)))?;
    }
  }

  std::fs::rename(&old_full, &new_full)
    .map_err(|e| ZetaError::Io(format!("Lỗi khi đổi tên từ {} sang {}: {}", old_path, new_path, e)))?;

  Ok(())
}

#[tauri::command]
pub async fn delete_item(
  item_path: String,
  project_root: String,
) -> Result<(), ZetaError> {
  let root = Path::new(&project_root);
  let full_path = root.join(&item_path);

  if !full_path.exists() {
    return Err(ZetaError::InvalidInput {
      message: format!("Không tìm thấy đối tượng cần xóa: {}", item_path),
    });
  }

  if full_path.is_dir() {
    std::fs::remove_dir_all(&full_path)
      .map_err(|e| ZetaError::Io(format!("Lỗi khi xóa thư mục {}: {}", item_path, e)))?;
  } else {
    std::fs::remove_file(&full_path)
      .map_err(|e| ZetaError::Io(format!("Lỗi khi xóa tệp {}: {}", item_path, e)))?;
  }

  Ok(())
}

#[tauri::command]
#[allow(unused_variables)]
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

  #[cfg(target_os = "windows")]
  {
    let path_str = full_path.to_string_lossy().replace("/", "\\");
    let mut cmd = std::process::Command::new("explorer.exe");
    cmd.arg(format!("/select,{}", path_str));
    let _ = cmd.spawn().map_err(|e| ZetaError::Io(format!("Lỗi khi mở explorer: {}", e)))?;
  }

  #[cfg(target_os = "macos")]
  {
    let _ = std::process::Command::new("open")
      .arg("-R")
      .arg(&full_path)
      .spawn()
      .map_err(|e| ZetaError::Io(format!("Lỗi khi mở Finder: {}", e)))?;
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    if let Some(parent) = full_path.parent() {
      let parent_str = parent.to_string_lossy().to_string();
      use tauri_plugin_opener::OpenerExt;
      let _ = app_handle.opener().open_path(parent_str, None)
        .map_err(|e| ZetaError::Io(format!("Lỗi khi mở thư mục: {}", e)))?;
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn start_file_watcher(
  root: String,
  state: State<'_, AppState>,
  app_handle: tauri::AppHandle,
) -> Result<(), ZetaError> {
  // Stop existing watcher if any
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
  use tauri::Emitter;

  let app_clone = app_handle.clone();
  let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
    if let Ok(event) = res {
      let is_interesting = matches!(
        event.kind,
        notify::EventKind::Create(_) | notify::EventKind::Remove(_) | notify::EventKind::Modify(_)
      );

      if is_interesting {
        let should_emit = event.paths.iter().any(|path| {
          let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
          !name.starts_with('.') && !name.ends_with('~') && !name.contains(".db") && !name.contains(".git")
        });

        if should_emit {
          let _ = app_clone.emit("file-changed", ());
        }
      }
    }
  }).map_err(|e| ZetaError::Io(format!("Không thể tạo watcher: {}", e)))?;

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



#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;

  #[tokio::test]
  async fn test_read_write_text_file() {
    let temp_dir = std::env::temp_dir().join("zetacp_fs_test");
    if temp_dir.exists() {
      let _ = fs::remove_dir_all(&temp_dir);
    }
    fs::create_dir_all(&temp_dir).unwrap();
    let project_root = temp_dir.to_string_lossy().to_string();

    let relative_file_path = "subfolder/test_file.cpp".to_string();
    let expected_content = "int main() { return 0; }".to_string();

    // 1. Write the file
    let write_res = write_text_file(
      relative_file_path.clone(),
      expected_content.clone(),
      project_root.clone(),
    ).await;
    assert!(write_res.is_ok());

    // Verify file exists on disk physically
    let physical_path = temp_dir.join("subfolder/test_file.cpp");
    assert!(physical_path.exists());
    let physical_content = fs::read_to_string(&physical_path).unwrap();
    assert_eq!(physical_content, expected_content);

    // 2. Read the file
    let read_res = read_text_file(
      relative_file_path.clone(),
      project_root.clone(),
    ).await;
    assert!(read_res.is_ok());
    assert_eq!(read_res.unwrap(), expected_content);

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
  }
}

