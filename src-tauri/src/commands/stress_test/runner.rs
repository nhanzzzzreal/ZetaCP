// src-tauri/src/commands/stress_test/runner.rs

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use super::types::StressTestPayload;
use super::db_helpers::{save_failed_runs, export_failed_testcase};
use crate::judge::diff::compare_outputs;
use crate::state::AppState;

pub struct StressRunConfig {
    pub iteration: i32,
    pub app: AppHandle,
    pub proj_db: sqlx::SqlitePool,
    pub gen_exec: String,
    pub gen_args: Vec<String>,
    pub sol_exec: String,
    pub sol_args: Vec<String>,
    pub brute_exec: String,
    pub brute_args: Vec<String>,
    pub settings: crate::commands::testcases::FileSettings,
    pub inp_name: String,
    pub out_name: String,
    pub project_root: String,
    pub solution_path: String,
    pub brute_path: String,
    pub gen_path: String,
    pub stop_condition: String,
    pub temp_dir: std::path::PathBuf,
    pub stress_session_id: String,
    pub cancel: Arc<AtomicBool>,
    pub errors: Arc<AtomicUsize>,
    pub auto_export: bool,
    pub stress_pause_notify: std::sync::Arc<tokio::sync::Notify>,
}

async fn check_cancelled(app: &AppHandle, cancel: &Arc<AtomicBool>) -> bool {
    if cancel.load(Ordering::Relaxed) {
        return true;
    }
    let state = app.state::<AppState>();
    if state.stress_cancel.load(Ordering::Relaxed) {
        cancel.store(true, Ordering::Relaxed);
        return true;
    }
    let guard = state.stress_handle.lock().await;
    if guard.is_none() {
        cancel.store(true, Ordering::Relaxed);
        return true;
    }
    false
}

async fn wait_if_paused(
    app: &AppHandle,
    stress_pause_notify: &Arc<tokio::sync::Notify>,
    cancel: &Arc<AtomicBool>,
) -> bool {
    let state = app.state::<AppState>();
    while state.stress_paused.load(Ordering::Relaxed) {
        if check_cancelled(app, cancel).await {
            return true;
        }
        stress_pause_notify.notified().await;
    }
    check_cancelled(app, cancel).await
}

async fn pause_if_needed(
    iteration: i32,
    app: &AppHandle,
    cancel: &Arc<AtomicBool>,
    errors: &Arc<AtomicUsize>,
    stop_condition: &str,
    stress_pause_notify: &Arc<tokio::sync::Notify>,
    increment_error: bool,
) -> bool {
    let errs = if increment_error {
        errors.fetch_add(1, Ordering::Relaxed) + 1
    } else {
        errors.load(Ordering::Relaxed)
    };
    let should_stop = match stop_condition {
        "first" | "first_error" | "first-error" | "firstError" => true,
        "10_errors" | "ten_errors" | "10-errors" | "ten-errors" | "tenErrors" => errs >= 10,
        _ => false,
    };
    if should_stop {
        if check_cancelled(app, cancel).await {
            return true;
        }
        let state = app.state::<AppState>();
        state.stress_paused.store(true, Ordering::Relaxed);
        let _ = app.emit("stress-test-progress", StressTestPayload::Paused { iteration });
        stress_pause_notify.notified().await;
        if check_cancelled(app, cancel).await {
            return true;
        }
        let _ = app.emit("stress-test-progress", StressTestPayload::Resumed { iteration });
    }
    false
}

pub async fn run_iteration(config: StressRunConfig) {
    let StressRunConfig {
        iteration,
        app,
        proj_db,
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
        temp_dir,
        stress_session_id,
        cancel,
        errors,
        auto_export,
        stress_pause_notify,
    } = config;

    if wait_if_paused(&app, &stress_pause_notify, &cancel).await {
        return;
    }

    // Create iteration temp dir only if file I/O is enabled
    let is_file_io = settings.io_mode == "file";
    let iter_dir = if is_file_io {
        let dir = Path::new(&project_root)
            .join(".ZetaCP")
            .join("stress_temp")
            .join(format!("iter_{}", iteration));
        let _ = std::fs::create_dir_all(&dir);
        dir
    } else {
        temp_dir.clone()
    };

    let _ = app.emit("stress-test-progress", StressTestPayload::StateUpdate {
        iteration,
        generator_status: "running".to_string(),
        solution_status: "queue".to_string(),
        brute_status: "queue".to_string(),
    });

    // 1. Run Generator
    let mut gen_final_args = gen_args.clone();
    gen_final_args.push(iteration.to_string());
    
    let gen_opts = crate::judge::runner::RunOptions {
        exec_path: gen_exec,
        args: gen_final_args,
        working_dir: iter_dir.clone(),
        io_mode: "stdio".to_string(),
        input: "".to_string(),
        inp_name: "".to_string(),
        out_name: "".to_string(),
        time_limit_ms: settings.stress_gen_time_limit_ms as u64,
        memory_limit_kb: settings.stress_gen_memory_limit_kb,
    };
    
    let gen_res = match crate::judge::runner::execute_once(&gen_opts).await {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit("stress-test-progress", StressTestPayload::Progress {
                iteration,
                status: "failed".to_string(),
                input: "".to_string(),
                sol_output: format!("Sandbox initialization error: {}", e),
                brute_output: "".to_string(),
                verdict: "RTE".to_string(),
                time_ms: 0.0,
                memory_kb: 0,
            });
            let _ = pause_if_needed(iteration, &app, &cancel, &errors, &stop_condition, &stress_pause_notify, true).await;
            return;
        }
    };

    if gen_res.verdict != "AC" {
        let verdict_str = gen_res.verdict.clone();
        let msg = if verdict_str == "TLE" {
            "Generator time limit exceeded. Please check generator constraints or reduce test limits.".to_string()
        } else if verdict_str == "MLE" {
            format!("Generator Memory Limit Exceeded: {}", gen_res.stderr)
        } else {
            format!("Generator Runtime Error: {}", gen_res.stderr)
        };
        let _ = app.emit("stress-test-progress", StressTestPayload::Progress {
            iteration,
            status: "failed".to_string(),
            input: "".to_string(),
            sol_output: msg,
            brute_output: "".to_string(),
            verdict: verdict_str,
            time_ms: gen_res.exec_time_ms,
            memory_kb: gen_res.memory_kb,
        });
        save_failed_runs(proj_db, stress_session_id, gen_path, solution_path, brute_path, iteration, Some(gen_res), None, None).await;
        let _ = pause_if_needed(iteration, &app, &cancel, &errors, &stop_condition, &stress_pause_notify, true).await;
        return;
    }

    let input_data = gen_res.stdout.clone();

    if wait_if_paused(&app, &stress_pause_notify, &cancel).await {
        return;
    }

    let _ = app.emit("stress-test-progress", StressTestPayload::StateUpdate {
        iteration,
        generator_status: "done".to_string(),
        solution_status: "running".to_string(),
        brute_status: "queue".to_string(),
    });

    // 2. Run Solution
    let sol_opts = crate::judge::runner::RunOptions {
        exec_path: sol_exec,
        args: sol_args,
        working_dir: iter_dir.clone(),
        io_mode: settings.io_mode.clone(),
        input: input_data.clone(),
        inp_name: inp_name.clone(),
        out_name: out_name.clone(),
        time_limit_ms: settings.time_limit_ms as u64,
        memory_limit_kb: settings.memory_limit_kb,
    };

    let sol_res = match crate::judge::runner::execute_once(&sol_opts).await {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit("stress-test-progress", StressTestPayload::Progress {
                iteration,
                status: "failed".to_string(),
                input: input_data.clone(),
                sol_output: format!("Solution sandbox execution error: {}", e),
                brute_output: "".to_string(),
                verdict: "RTE".to_string(),
                time_ms: 0.0,
                memory_kb: 0,
            });
            save_failed_runs(proj_db, stress_session_id, gen_path, solution_path, brute_path, iteration, Some(gen_res), None, None).await;
            let _ = pause_if_needed(iteration, &app, &cancel, &errors, &stop_condition, &stress_pause_notify, true).await;
            return;
        }
    };

    if wait_if_paused(&app, &stress_pause_notify, &cancel).await {
        return;
    }

    let _ = app.emit("stress-test-progress", StressTestPayload::StateUpdate {
        iteration,
        generator_status: "done".to_string(),
        solution_status: "done".to_string(),
        brute_status: "running".to_string(),
    });

    // 3. Run Brute Force
    let brute_opts = crate::judge::runner::RunOptions {
        exec_path: brute_exec,
        args: brute_args,
        working_dir: iter_dir.clone(),
        io_mode: settings.io_mode.clone(),
        input: input_data.clone(),
        inp_name: inp_name.clone(),
        out_name: out_name.clone(),
        time_limit_ms: settings.stress_brute_time_limit_ms as u64,
        memory_limit_kb: settings.stress_brute_memory_limit_kb,
    };

    let brute_res = match crate::judge::runner::execute_once(&brute_opts).await {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit("stress-test-progress", StressTestPayload::Progress {
                iteration,
                status: "failed".to_string(),
                input: input_data.clone(),
                sol_output: sol_res.stdout.clone(),
                brute_output: format!("Brute Force sandbox execution error: {}", e),
                verdict: "RTE".to_string(),
                time_ms: sol_res.exec_time_ms,
                memory_kb: sol_res.memory_kb,
            });
            save_failed_runs(proj_db, stress_session_id, gen_path, solution_path, brute_path, iteration, Some(gen_res), Some(sol_res), None).await;
            let _ = pause_if_needed(iteration, &app, &cancel, &errors, &stop_condition, &stress_pause_notify, true).await;
            return;
        }
    };

    // Clean up iter_dir if it was created
    if is_file_io {
        let _ = std::fs::remove_dir_all(&iter_dir);
    }

    // Evaluate output comparisons and verdicts
    let mut status = "passed".to_string();
    let mut verdict = "AC".to_string();
    let mut final_sol_out = sol_res.stdout.clone();
    let mut final_brute_out = brute_res.stdout.clone();

    if sol_res.verdict != "AC" {
        status = "failed".to_string();
        verdict = sol_res.verdict.clone();
        if verdict == "TLE" {
            final_sol_out = "Solution time limit exceeded (Testcase Manager limit). Possible infinite loop or slow algorithm.".to_string();
        } else {
            final_sol_out = format!("Solution Runtime Error ({}): {}", verdict, sol_res.stderr);
        }
    } else if brute_res.verdict != "AC" {
        status = "failed".to_string();
        verdict = format!("BRUTE_{}", brute_res.verdict);
        if brute_res.verdict == "TLE" {
            final_brute_out = "Brute Force time limit exceeded. Please reduce N or optimize Brute Force.".to_string();
        } else {
            final_brute_out = format!("Brute Force Runtime Error ({}): {}", brute_res.verdict, brute_res.stderr);
        }
    } else {
        if compare_outputs(&sol_res.stdout, &brute_res.stdout, &settings.checker_type).is_some() {
            status = "failed".to_string();
            verdict = "WA".to_string();
        }
    }

    if status == "failed" {
        save_failed_runs(proj_db.clone(), stress_session_id, gen_path.clone(), solution_path.clone(), brute_path.clone(), iteration, Some(gen_res.clone()), Some(sol_res.clone()), Some(brute_res.clone())).await;

        if auto_export {
            let _ = export_failed_testcase(
                &proj_db,
                &solution_path,
                iteration,
                &input_data,
                &final_brute_out,
                &app,
            )
            .await;
        }
    }

    let is_failed = status == "failed";

    let _ = app.emit("stress-test-progress", StressTestPayload::Progress {
        iteration,
        status,
        input: input_data,
        sol_output: final_sol_out,
        brute_output: final_brute_out,
        verdict,
        time_ms: sol_res.exec_time_ms,
        memory_kb: sol_res.memory_kb,
    });

    if is_failed {
        let _ = pause_if_needed(iteration, &app, &cancel, &errors, &stop_condition, &stress_pause_notify, true).await;
    }
}
