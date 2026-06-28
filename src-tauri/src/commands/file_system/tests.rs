// src-tauri/src/commands/file_system/tests.rs

use super::super::*;
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

  let write_res = write_text_file(
    relative_file_path.clone(),
    expected_content.clone(),
    project_root.clone(),
  ).await;
  assert!(write_res.is_ok());

  let physical_path = temp_dir.join("subfolder/test_file.cpp");
  assert!(physical_path.exists());
  let physical_content = fs::read_to_string(&physical_path).unwrap();
  assert_eq!(physical_content, expected_content);

  let read_res = read_text_file(
    relative_file_path.clone(),
    project_root.clone(),
  ).await;
  assert!(read_res.is_ok());
  assert_eq!(read_res.unwrap(), expected_content);

  let _ = fs::remove_dir_all(&temp_dir);
}
