// src-tauri/src/commands/testcases/import_export.rs

use tauri::{State, AppHandle, Emitter};
use crate::state::AppState;
use crate::errors::ZetaError;
use super::types::{TestcaseMeta, TestcaseResult, TestcaseImportedPayload};

struct TestcasePair {
    name: String,
    input_path: std::path::PathBuf,
    output_path: std::path::PathBuf,
}

fn scan_dir_for_pairs(
    dir: &std::path::Path,
    root_dir: &std::path::Path,
    pairs: &mut Vec<TestcasePair>,
) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut files = Vec::new();
        let mut subdirs = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                subdirs.push(path);
            } else if path.is_file() {
                files.push(path);
            }
        }

        let mut local_pairs = Vec::new();
        let mut inputs = Vec::new();
        let mut outputs = Vec::new();

        for file in &files {
            let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            let file_name = file.file_name().and_then(|f| f.to_str()).unwrap_or("").to_lowercase();
            
            let is_in = ext == "inp" || ext == "in" || (ext == "txt" && (file_name.contains("input") || file_name.contains("inp") || file_name.contains("in")));
            let is_out = ext == "out" || ext == "ans" || (ext == "txt" && (file_name.contains("output") || file_name.contains("out") || file_name.contains("ans") || file_name.contains("result")));
            
            if is_in {
                inputs.push(file.clone());
            } else if is_out {
                outputs.push(file.clone());
            }
        }

        let is_root = dir == root_dir;
        let dir_name = dir.file_name().and_then(|f| f.to_str()).unwrap_or("test").to_string();
        let relative_name = if is_root {
            String::new()
        } else {
            match dir.strip_prefix(root_dir) {
                Ok(rel_path) => {
                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                    if rel_str.is_empty() {
                        dir_name.clone()
                    } else {
                        rel_str
                    }
                }
                Err(_) => dir_name.clone(),
            }
        };

        // Method A: Match by base name
        for inp in &inputs {
            let inp_base = inp.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            for out in &outputs {
                let out_base = out.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                if inp_base == out_base || (inp_base == "input" && out_base == "output") {
                    let tc_name = if is_root {
                        inp.file_stem().and_then(|s| s.to_str()).unwrap_or("test").to_string()
                    } else {
                        relative_name.clone()
                    };

                    local_pairs.push(TestcasePair {
                        name: tc_name,
                        input_path: inp.clone(),
                        output_path: out.clone(),
                    });
                }
            }
        }

        // Method B: Match by single input and single output in directory
        if local_pairs.is_empty() && inputs.len() == 1 && outputs.len() == 1 {
            let tc_name = if is_root {
                inputs[0].file_stem().and_then(|s| s.to_str()).unwrap_or("test").to_string()
            } else {
                relative_name.clone()
            };

            local_pairs.push(TestcasePair {
                name: tc_name,
                input_path: inputs[0].clone(),
                output_path: outputs[0].clone(),
            });
        }

        pairs.extend(local_pairs);

        // Recurse into subdirectories
        for subdir in subdirs {
            scan_dir_for_pairs(&subdir, root_dir, pairs);
        }
    }
}

#[tauri::command]
pub async fn import_testcases_from_folder(
    folder_path: String,
    file_path: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    let scan_path = std::path::Path::new(&folder_path);
    if !scan_path.exists() || !scan_path.is_dir() {
        return Err(ZetaError::InvalidInput {
            message: format!("Thư mục import không tồn tại hoặc không hợp lệ: {}", folder_path),
        });
    }

    let mut pairs = Vec::new();
    scan_dir_for_pairs(scan_path, scan_path, &mut pairs);
    pairs.sort_by(|a, b| a.name.cmp(&b.name));

    execute_import_transaction(&proj_db, &file_path, pairs, &app_handle).await?;
    Ok(())
}

async fn execute_import_transaction(db: &sqlx::SqlitePool, file_path: &str, pairs: Vec<TestcasePair>, app_handle: &AppHandle) -> Result<(), ZetaError> {
    let mut max_order = fetch_max_order_index(db, file_path).await;
    let mut tx = db.begin().await?;
    for (idx, pair) in pairs.into_iter().enumerate() {
        let input = std::fs::read_to_string(&pair.input_path).unwrap_or_default();
        let expected = std::fs::read_to_string(&pair.output_path).unwrap_or_default();
        let id = generate_in_memory_id(&pair.name, idx);
        max_order += 1;
        insert_testcase_records(&mut tx, &id, file_path, &pair.name, max_order, &input, &expected).await?;
        emit_import_event(app_handle, &id, file_path, &pair.name, max_order);
    }
    tx.commit().await?;
    Ok(())
}

async fn fetch_max_order_index(db: &sqlx::SqlitePool, file_path: &str) -> i32 {
    sqlx::query_scalar("SELECT COALESCE(MAX(order_index), -1) FROM TestcaseMeta WHERE file_path = ?")
        .bind(file_path).fetch_one(db).await.unwrap_or(-1)
}

fn generate_in_memory_id(name: &str, idx: usize) -> String {
    use sha2::{Sha256, Digest};
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
    let mut hasher = Sha256::new();
    hasher.update(format!("{}-{}-{}", now, name, idx).as_bytes());
    format!("{:x}", hasher.finalize())[..32].to_string()
}

async fn insert_testcase_records(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: &str,
    file_path: &str,
    name: &str,
    order_index: i32,
    input: &str,
    expected: &str,
) -> Result<(), ZetaError> {
    sqlx::query("INSERT INTO TestcaseMeta (id, file_path, name, order_index, subtask_id, is_active) VALUES (?, ?, ?, ?, NULL, 1)")
        .bind(id).bind(file_path).bind(name).bind(order_index).execute(&mut **tx).await?;
    sqlx::query("INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?)")
        .bind(id).bind(input).bind(expected).execute(&mut **tx).await?;
    sqlx::query("INSERT INTO TestcaseResult (id, last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at) VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL)")
        .bind(id).execute(&mut **tx).await?;
    Ok(())
}

fn emit_import_event(app_handle: &AppHandle, id: &str, file_path: &str, name: &str, order_index: i32) {
    let meta = TestcaseMeta { id: id.to_string(), file_path: file_path.to_string(), name: name.to_string(), order_index, subtask_id: None, is_active: true };
    let result = TestcaseResult { id: id.to_string(), last_status: None, exec_time_ms: None, memory_kb: None, actual_output: None, diff_info: None, run_at: None };
    app_handle.emit("testcase-imported", TestcaseImportedPayload { meta, result }).ok();
}

#[tauri::command]
pub async fn export_testcases(
    export_dir: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    let base_name = get_problem_base_name(&file_path);
    let target_root = std::path::Path::new(&export_dir).join(&base_name);
    if !target_root.exists() {
        tokio::fs::create_dir_all(&target_root).await
            .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục xuất: {}", e)))?;
    }

    let testcases = fetch_testcases_with_data(&proj_db, &file_path).await?;
    write_testcases_to_disk(&target_root, &base_name, &testcases).await?;
    Ok(())
}

fn get_problem_base_name(file_path: &str) -> String {
    let file_name = std::path::Path::new(file_path).file_name().and_then(|n| n.to_str()).unwrap_or("solution");
    file_name.rfind('.').map_or_else(|| file_name.to_string(), |idx| file_name[..idx].to_string())
}

async fn fetch_testcases_with_data(db: &sqlx::SqlitePool, file_path: &str) -> Result<Vec<(String, String, String)>, ZetaError> {
    Ok(sqlx::query_as::<_, (String, String, String)>(
        "SELECT m.name, d.input, d.expected_output FROM TestcaseMeta m \
         INNER JOIN TestcaseData d ON m.id = d.id \
         LEFT JOIN Subtask s ON m.subtask_id = s.id \
         WHERE m.file_path = ? \
         ORDER BY CASE WHEN m.subtask_id IS NULL THEN 1 ELSE 0 END ASC, s.order_index ASC, m.order_index ASC"
    )
    .bind(file_path).fetch_all(db).await.unwrap_or_default())
}

async fn write_testcases_to_disk(target_root: &std::path::Path, base_name: &str, testcases: &[(String, String, String)]) -> Result<(), ZetaError> {
    for (idx, (_, input, expected)) in testcases.iter().enumerate() {
        let test_dir = target_root.join(format!("test{:02}", idx + 1));
        if !test_dir.exists() {
            tokio::fs::create_dir_all(&test_dir).await
                .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục con: {}", e)))?;
        }
        tokio::fs::write(test_dir.join(format!("{}.inp", base_name)), input).await
            .map_err(|e| ZetaError::Io(format!("Lỗi ghi file inp: {}", e)))?;
        tokio::fs::write(test_dir.join(format!("{}.out", base_name)), expected).await
            .map_err(|e| ZetaError::Io(format!("Lỗi ghi file out: {}", e)))?;
    }
    Ok(())
}
