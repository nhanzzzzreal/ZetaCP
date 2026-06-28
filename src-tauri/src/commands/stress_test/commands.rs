// src-tauri/src/commands/stress_test/commands.rs

use tauri::{State, AppHandle, Emitter, Manager};
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use crate::errors::ZetaError;
use crate::state::AppState;
use super::types::StressTestPayload;
use super::helpers::{resolve_executable, download_testlib, resolve_generator, normalize_relative_path};
use super::runner::{run_iteration, StressRunConfig};

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn run_stress_test(
    solution_path: String,
    brute_path: String,
    gen_path: String,
    gen_code: String,
    gen_lang: String,
    project_root: String,
    test_count: i32,
    _multitest_count: i32,
    _is_multitest: bool,
    _use_sum_max: bool,
    _sum_max: i64,
    _timeout_ms: u64,
    stop_condition: String,
    auto_export: bool,
    _named_types: Vec<serde_json::Value>,
    _global_variables: Vec<serde_json::Value>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let root_path = Path::new(&project_root);
    
    let solution_path = normalize_relative_path(root_path, &solution_path);
    let brute_path = normalize_relative_path(root_path, &brute_path);
    let gen_path = normalize_relative_path(root_path, &gen_path);

    let proj_db = state.get_db_pool(&solution_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Failed to initialize database pool".to_string())
    })?;

    // Set up directories inside .ZetaCP of project_root
    let zetacp_dir = Path::new(&project_root).join(".ZetaCP");
    let temp_dir = zetacp_dir.join("stress_temp");
    // Only clean iteration subdirectories, NOT the entire stress_temp (preserves generator.py)
    if temp_dir.exists() {
        // Clean only iter_* subdirs from previous runs
        if let Ok(entries) = std::fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                if entry.file_name().to_string_lossy().starts_with("iter_") {
                    let _ = std::fs::remove_dir_all(entry.path());
                }
            }
        }
    } else {
        let _ = std::fs::create_dir_all(&temp_dir);
    }

    let testlib_path = download_testlib(&zetacp_dir).await?;

    // Resolve Generator binary/script path
    let (gen_exec, gen_args) = resolve_generator(
        &state,
        &app_handle,
        &project_root,
        &gen_path,
        &gen_lang,
        &gen_code,
        &zetacp_dir,
        &temp_dir,
        &testlib_path,
    )
    .await?;

    // Load file-specific settings or default if not found
    let config_repo = crate::db::repository::ConfigRepository::new(&proj_db);
    let settings = config_repo.get_file_settings(&solution_path).await?
    .unwrap_or_else(|| crate::commands::testcases::FileSettings {
        file_path: solution_path.clone(),
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
        stress_brute_path: brute_path.clone(),
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

    let (sol_exec, sol_args) = resolve_executable(&proj_db, &state, &app_handle, &project_root, &solution_path).await?;
    let (brute_exec, brute_args) = resolve_executable(&proj_db, &state, &app_handle, &project_root, &brute_path).await?;

    let file_name = Path::new(&solution_path)
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

    // Kill any active stress test
    let mut stress_guard = state.stress_handle.lock().await;
    if let Some(handle) = stress_guard.take() {
        handle.abort();
    }

    // Initialize stress_pause_notify
    state.stress_paused.store(false, Ordering::Relaxed);
    state.stress_cancel.store(false, Ordering::Relaxed);
    let notify = std::sync::Arc::new(tokio::sync::Notify::new());
    {
        let mut pause_guard = state.stress_pause_notify.lock().await;
        *pause_guard = Some(notify.clone());
    }

    // Query Concurrency settings outside background spawn
    let concurrency = if settings.run_mode == "parallel" {
        let repo = crate::db::repository::SettingsRepository::new(&state.settings_db);
        repo.get_judge_threads().await
    } else {
        1
    };

    let start_time_nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let stress_session_id = format!("stress_{}", start_time_nanos);

    // Spawn the coordinator task in the background
    let app_handle_clone = app_handle.clone();
    let solution_path_clone = solution_path.clone();
    let brute_path_clone = brute_path.clone();
    let gen_path_clone = gen_path.clone();
    let project_root_clone = project_root.clone();
    let stop_condition_clone = stop_condition.clone();
    let notify_clone = notify.clone();

    let task = tokio::spawn(async move {
        let semaphore = Arc::new(tokio::sync::Semaphore::new(concurrency));
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let error_count = Arc::new(AtomicUsize::new(0));
        let mut join_handles = Vec::new();

        for iteration in 1..=test_count {
            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let state_paused = app_handle_clone.state::<AppState>();
            while state_paused.stress_paused.load(Ordering::Relaxed) {
                if cancel_flag.load(Ordering::Relaxed) {
                    break;
                }
                notify_clone.notified().await;
            }

            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let permit = match semaphore.clone().acquire_owned().await {
                Ok(p) => p,
                Err(_) => break,
            };

            let app = app_handle_clone.clone();
            let cancel = cancel_flag.clone();
            let errors = error_count.clone();
            let proj_db = proj_db.clone();

            let gen_exec = gen_exec.clone();
            let gen_args = gen_args.clone();
            let sol_exec = sol_exec.clone();
            let sol_args = sol_args.clone();
            let brute_exec = brute_exec.clone();
            let brute_args = brute_args.clone();
            let settings = settings.clone();
            let inp_name = inp_name.clone();
            let out_name = out_name.clone();
            let project_root = project_root_clone.clone();
            let solution_path = solution_path_clone.clone();
            let brute_path = brute_path_clone.clone();
            let gen_path = gen_path_clone.clone();
            let stop_condition = stop_condition_clone.clone();
            let temp_dir_clone = temp_dir.clone();
            let stress_session_id = stress_session_id.clone();

            let notify_iter = notify_clone.clone();
            let config = StressRunConfig {
                iteration,
                app: app.clone(),
                proj_db: proj_db.clone(),
                gen_exec,
                gen_args,
                sol_exec,
                sol_args,
                brute_exec,
                brute_args,
                settings,
                inp_name,
                out_name,
                project_root,
                solution_path,
                brute_path,
                gen_path,
                stop_condition,
                temp_dir: temp_dir_clone,
                stress_session_id,
                cancel,
                errors,
                auto_export,
                stress_pause_notify: notify_iter,
            };

            let handle = tokio::spawn(async move {
                let _permit = permit;
                run_iteration(config).await;
            });

            if concurrency == 1 {
                let _ = handle.await;
            } else {
                join_handles.push(handle);
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        }

        if concurrency > 1 {
            for h in join_handles {
                let _ = h.await;
            }
        }

        let is_cancelled = cancel_flag.load(Ordering::Relaxed);
        let final_errs = error_count.load(Ordering::Relaxed);
        
        let message = if is_cancelled {
            format!("Aborted early due to stop condition (Errors: {})", final_errs)
        } else {
            format!("Completed {} runs with {} errors.", test_count, final_errs)
        };

        let _ = app_handle_clone.emit("stress-test-progress", StressTestPayload::Complete { message });
    });

    *stress_guard = Some(task);
    Ok(())
}

#[tauri::command]
pub async fn stop_stress_test(
    state: State<'_, crate::state::AppState>,
) -> Result<(), ZetaError> {
    state.stress_cancel.store(true, Ordering::Relaxed);
    let mut stress_guard = state.stress_handle.lock().await;
    if let Some(handle) = stress_guard.take() {
        handle.abort();
    }

    let pause_guard = state.stress_pause_notify.lock().await;
    if let Some(ref notify) = *pause_guard {
        notify.notify_waiters();
    }

    // Clean up iteration subdirectories in stress_temp (keep the directory itself and generator files)
    let project_root_guard = state.project_root.lock().await;
    if let Some(ref project_root) = *project_root_guard {
        let temp_dir = Path::new(project_root).join(".ZetaCP").join("stress_temp");
        if temp_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&temp_dir) {
                for entry in entries.flatten() {
                    if entry.file_name().to_string_lossy().starts_with("iter_") {
                        let _ = std::fs::remove_dir_all(entry.path());
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn resume_stress_test(
    state: State<'_, crate::state::AppState>,
) -> Result<(), ZetaError> {
    state.stress_paused.store(false, Ordering::Relaxed);
    let pause_guard = state.stress_pause_notify.lock().await;
    if let Some(ref notify) = *pause_guard {
        notify.notify_waiters();
    }
    Ok(())
}

#[tauri::command]
pub async fn install_testlib(
    project_root: String,
    state: State<'_, AppState>,
) -> Result<String, ZetaError> {
    let zetacp_dir = Path::new(&project_root).join(".ZetaCP");
    if !zetacp_dir.exists() {
        let _ = std::fs::create_dir_all(&zetacp_dir);
    }
    
    // 1. Download to .ZetaCP/testlib.h
    let testlib_path = download_testlib(&zetacp_dir).await?;

    // 2. Copy directly to project root
    let dest_project = Path::new(&project_root).join("testlib.h");
    let _ = std::fs::copy(&testlib_path, &dest_project);

    // 3. Copy to E:\w64devkit standard release path include folder if it exists
    let e_w64devkit = Path::new("E:\\w64devkit");
    if e_w64devkit.exists() {
        let e_inc1 = e_w64devkit.join("x86_64-w64-mingw32").join("include");
        if e_inc1.exists() {
            let _ = std::fs::copy(&testlib_path, e_inc1.join("testlib.h"));
        }
        let e_inc2 = e_w64devkit.join("include");
        if e_inc2.exists() {
            let _ = std::fs::copy(&testlib_path, e_inc2.join("testlib.h"));
        }
    }

    // 4. Copy to compiler in settings (system/packaged compiler) include folders
    let gpp_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.gpp_path'")
        .fetch_optional(&state.settings_db)
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| crate::get_default_gpp());
    let resolved_gpp = crate::resolve_portable_path(&gpp_path);
    if let Some(bin_dir) = Path::new(&resolved_gpp).parent() {
        if let Some(compiler_root) = bin_dir.parent() {
            let mingw_include = compiler_root.join("x86_64-w64-mingw32").join("include");
            if mingw_include.exists() {
                let _ = std::fs::copy(&testlib_path, mingw_include.join("testlib.h"));
            }
            let std_include = compiler_root.join("include");
            if std_include.exists() {
                let _ = std::fs::copy(&testlib_path, std_include.join("testlib.h"));
            }
        }
    }

    Ok("testlib.h installed successfully".to_string())
}
