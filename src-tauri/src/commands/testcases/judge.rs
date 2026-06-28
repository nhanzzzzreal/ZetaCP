// src-tauri/src/commands/testcases/judge.rs

use tauri::{State, AppHandle};
use crate::state::AppState;
use crate::errors::ZetaError;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use super::types::FileSettings;

static JUDGE_CANCEL: OnceLock<Arc<AtomicBool>> = OnceLock::new();

pub fn get_judge_cancel_flag() -> Arc<AtomicBool> {
    JUDGE_CANCEL.get_or_init(|| Arc::new(AtomicBool::new(false))).clone()
}

#[tauri::command]
pub async fn run_testcases(
    file_path: String,
    testcase_ids: Vec<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    // Clean up any remaining zetacp temp directories from previous runs/aborts
    if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("zetacp-") {
                        let _ = std::fs::remove_dir_all(&path);
                    }
                }
            }
        }
    }

    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    let project_root_guard = state.project_root.lock().await;
    let project_root = project_root_guard.as_ref().ok_or_else(|| {
        ZetaError::Fatal("Project root path not set.".to_string())
    })?.clone();

    // Cancel any active judging run
    let mut judge_guard = state.judge_handle.lock().await;
    if let Some(handle) = judge_guard.take() {
        handle.abort();
    }

    // Load file-specific settings or default if not found
    let config_repo = crate::db::repository::ConfigRepository::new(&proj_db);
    let settings = config_repo.get_file_settings(&file_path).await?
        .unwrap_or_else(|| FileSettings {
            file_path: file_path.clone(),
            compiler_flags: "-O2 -std=c++17".to_string(),
            interpreter_flags: "".to_string(),
            io_mode: "stdio".to_string(),
            input_file: "".to_string(),
            output_file: "".to_string(),
            time_limit_ms: 1000,
            memory_limit_kb: 262144, // 256MB
            run_mode: "parallel".to_string(),
            checker_type: "ignore_trailing_space".to_string(),
            custom_checker_path: "".to_string(),
            custom_checker_binary: "".to_string(),
            stress_brute_path: "".to_string(),
            stress_sol_path: "".to_string(),
            stress_gen_path: "".to_string(),
            stress_gen_mode: "blockly".to_string(),
            stress_gen_time_limit_ms: 2000,
            stress_gen_memory_limit_kb: 262144,
            stress_brute_time_limit_ms: 2000,
            stress_brute_memory_limit_kb: 262144,
            stress_test_count: 100,
            stress_stop_condition: "first_error".to_string(),
            stress_auto_export: false,
            blockly_workspace: "".to_string(),
        });

    // Resolve Executable configuration
    let is_python = file_path.ends_with(".py");
    let (exec_path, args) = if is_python {
        let repo = crate::db::repository::SettingsRepository::new(&state.settings_db);
        let python_path = repo.get_python_path().await;
        let resolved_python = crate::resolve_portable_path(&python_path);
        
        let full_src_path = std::path::Path::new(&project_root).join(&file_path);
        
        // Add python custom interpreter flags if defined
        let mut python_args = Vec::new();
        if !settings.interpreter_flags.trim().is_empty() {
            for flag in settings.interpreter_flags.split_whitespace() {
                python_args.push(flag.to_string());
            }
        }
        python_args.push(full_src_path.to_string_lossy().to_string());
        (resolved_python, python_args)
    } else {
        let binary_relative_path: Option<String> = sqlx::query_scalar(
            "SELECT binary_path FROM CompileCache WHERE file_path = ?"
        )
        .bind(&file_path)
        .fetch_optional(&proj_db)
        .await
        .unwrap_or(None);

        match binary_relative_path {
            Some(rel) => {
                let full_bin = std::path::Path::new(&project_root).join(rel);
                if !full_bin.exists() {
                    return Err(ZetaError::InvalidInput {
                        message: "Không tìm thấy file thực thi. Hãy compile lại.".to_string(),
                    });
                }
                (full_bin.to_string_lossy().to_string(), vec![])
            }
            None => return Err(ZetaError::InvalidInput {
                message: "Vui lòng biên dịch (Compile) file nguồn trước khi chạy testcase.".to_string(),
            }),
        }
    };

    // Calculate concurrency
    let concurrency = if settings.run_mode == "parallel" {
        let repo = crate::db::repository::SettingsRepository::new(&state.settings_db);
        repo.get_judge_threads().await
    } else {
        1
    };

    // Resolve I/O Filenames for File I/O redirection
    let full_src_path = std::path::Path::new(&project_root).join(&file_path);
    let run_dir = full_src_path.parent().unwrap_or(std::path::Path::new(&project_root)).to_path_buf();
    
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("solution");
    let base_name = if let Some(idx) = file_name.rfind('.') {
        &file_name[..idx]
    } else {
        file_name
    };

    let inp_name = if settings.input_file.is_empty() {
        format!("{}.inp", base_name)
    } else {
        settings.input_file.clone()
    };

    let out_name = if settings.output_file.is_empty() {
        format!("{}.out", base_name)
    } else {
        settings.output_file.clone()
    };

    let cancel_flag = get_judge_cancel_flag();
    cancel_flag.store(false, Ordering::SeqCst);

    // Spawn the async judging task
    let app_handle_clone = app_handle.clone();
    let proj_db_clone = proj_db.clone();
    let file_path_clone = file_path.clone();

    let task = tokio::spawn(async move {
        let results = crate::judge::orchestrator::execute_batch(
            testcase_ids,
            exec_path,
            args,
            settings,
            &run_dir,
            inp_name,
            out_name,
            proj_db_clone.clone(),
            app_handle_clone,
            concurrency,
            cancel_flag,
        ).await;

        if let Ok(res_vec) = results {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            
            for tc_res in res_vec {
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos();
                let run_id = format!("run_tc_{}_{}", tc_res.id, timestamp);
                let diff_info_json = tc_res.diff_info.as_ref().and_then(|d| serde_json::to_string(d).ok());
                
                let record = crate::db::repository::RunRecord {
                    id: run_id,
                    run_type: "testcase_judge".to_string(),
                    parent_id: Some(tc_res.id.clone()),
                    file_path: file_path_clone.clone(),
                    verdict: tc_res.last_status.clone(),
                    exec_time_ms: tc_res.exec_time_ms.unwrap_or(0.0),
                    memory_kb: tc_res.memory_kb.unwrap_or(0),
                    actual_output: tc_res.actual_output.clone(),
                    diff_info: diff_info_json,
                    run_at: now,
                    extra_json: None,
                };
                let repo = crate::db::repository::RunsRepository::new(&proj_db_clone);
                let _ = repo.insert_run(&record).await;
            }
        }
    });

    *judge_guard = Some(task);
    Ok(())
}

#[tauri::command]
pub async fn stop_testcases(
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let mut judge_guard = state.judge_handle.lock().await;
    if let Some(handle) = judge_guard.take() {
        handle.abort();
    }
    let cancel_flag = get_judge_cancel_flag();
    cancel_flag.store(true, Ordering::SeqCst);

    // Also perform cleanup of temp directories when aborting
    if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("zetacp-") {
                        let _ = std::fs::remove_dir_all(&path);
                    }
                }
            }
        }
    }

    Ok(())
}
