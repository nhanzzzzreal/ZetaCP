// src-tauri/src/commands/file_system/helper.rs

use std::path::Path;
use crate::errors::ZetaError;

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
  pub path: String,
  #[serde(rename = "isDir")]
  pub is_dir: bool,
  pub children: Vec<FileNode>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileFilter {
  pub show: Vec<String>,
  pub hide: Vec<String>,
}

pub fn get_recent_files(root: &str) -> Vec<String> {
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

pub fn should_show_file(name: &str, filter: &FileFilter) -> bool {
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

fn build_file_node(root_path: &Path, entry: std::fs::DirEntry, filter: &FileFilter) -> Result<Option<FileNode>, std::io::Error> {
  let path = entry.path();
  let name = entry.file_name().to_string_lossy().to_string();

  if name.starts_with('.') {
    return Ok(None);
  }

  let is_dir = path.is_dir();
  let rel_path = path.strip_prefix(root_path)
    .unwrap_or(&path)
    .to_string_lossy()
    .to_string()
    .replace('\\', "/");

  if is_dir {
    let children = scan_dir_recursive(root_path, &path, filter)?;
    Ok(Some(FileNode { name, path: rel_path, is_dir: true, children }))
  } else if should_show_file(&name, filter) {
    Ok(Some(FileNode { name, path: rel_path, is_dir: false, children: Vec::new() }))
  } else {
    Ok(None)
  }
}

pub fn scan_dir_recursive(root_path: &Path, current_path: &Path, filter: &FileFilter) -> Result<Vec<FileNode>, std::io::Error> {
  let mut nodes = Vec::new();
  if let Ok(entries) = std::fs::read_dir(current_path) {
    for entry in entries.flatten() {
      if let Some(node) = build_file_node(root_path, entry, filter)? {
        nodes.push(node);
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

pub fn reveal_path_in_system(
  full_path: &Path,
  _app_handle: &tauri::AppHandle,
) -> Result<(), ZetaError> {
  #[cfg(target_os = "windows")]
  {
    let path_str = full_path.to_string_lossy().replace("/", "\\");
    let mut cmd = std::process::Command::new("explorer.exe");
    cmd.arg(format!("/select,{}", path_str));
    cmd.spawn().map_err(|e| ZetaError::Io(format!("Lỗi khi mở explorer: {}", e)))?;
  }

  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg("-R")
      .arg(full_path)
      .spawn()
      .map_err(|e| ZetaError::Io(format!("Lỗi khi mở Finder: {}", e)))?;
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    if let Some(parent) = full_path.parent() {
      let parent_str = parent.to_string_lossy().to_string();
      use tauri_plugin_opener::OpenerExt;
      _app_handle.opener().open_path(parent_str, None)
        .map_err(|e| ZetaError::Io(format!("Lỗi khi mở thư mục: {}", e)))?;
    }
  }

  Ok(())
}

pub fn create_recommended_watcher(app_handle: tauri::AppHandle) -> Result<notify::RecommendedWatcher, ZetaError> {
  use tauri::Emitter;
  notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
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
          let _ = app_handle.emit("file-changed", ());
        }
      }
    }
  }).map_err(|e| ZetaError::Io(format!("Không thể tạo watcher: {}", e)))
}

pub async fn open_project_impl(
  folder_path: String,
  state: &crate::state::AppState,
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

pub fn rename_item_impl(
  old_path: &str,
  new_path: &str,
  project_root: &str,
) -> Result<(), ZetaError> {
  let root = Path::new(project_root);
  let old_full = root.join(old_path);
  let new_full = root.join(new_path);

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

pub fn delete_item_impl(
  item_path: &str,
  project_root: &str,
) -> Result<(), ZetaError> {
  let root = Path::new(project_root);
  let full_path = root.join(item_path);

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

#[cfg(test)]
#[path = "tests.rs"]
mod tests;


