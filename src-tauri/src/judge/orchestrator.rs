// src-tauri/src/judge/orchestrator.rs

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use tokio::sync::Semaphore;
use tauri::{AppHandle, Emitter};
use sqlx::SqlitePool;
use crate::commands::testcases::{TestcaseResult, FileSettings};
use crate::errors::ZetaError;

#[derive(Debug, Clone, serde::Serialize)]
pub struct BatchProgress {
    #[serde(rename = "progress")]
    pub progress: usize, // Percentage 0..100
    #[serde(rename = "completed")]
    pub completed: usize,
    #[serde(rename = "total")]
    pub total: usize,
}

/// Executes a batch of testcases using the provided execution path, settings, and database.
/// Concurrency is controlled via a Semaphore.
/// Progress calculation is strictly monotonic (never decreasing, <= 100%).
/// Accepts a cancellation flag (Arc<AtomicBool>).
pub async fn execute_batch(
    testcase_ids: Vec<String>,
    exec_path: String,
    args: Vec<String>,
    settings: FileSettings,
    run_dir: &Path,
    inp_name: String,
    out_name: String,
    proj_db: SqlitePool,
    app_handle: AppHandle,
    concurrency: usize,
    cancel_flag: Arc<AtomicBool>,
) -> Result<Vec<TestcaseResult>, ZetaError> {
    let total = testcase_ids.len();
    if total == 0 {
        // Report 100% progress for empty batch
        let _ = app_handle.emit("judge-batch-progress", BatchProgress {
            progress: 100,
            completed: 0,
            total: 0,
        });
        return Ok(Vec::new());
    }

    let semaphore = Arc::new(Semaphore::new(concurrency));
    let completed_count = Arc::new(AtomicUsize::new(0));
    let max_progress = Arc::new(AtomicUsize::new(0));
    
    let mut join_handles = Vec::new();

    for tc_id in testcase_ids {
        // If cancellation is already requested, do not spawn further tasks
        if cancel_flag.load(Ordering::SeqCst) {
            break;
        }

        let sem = semaphore.clone();
        let app_handle_clone = app_handle.clone();
        let proj_db_clone = proj_db.clone();
        let exec_path_clone = exec_path.clone();
        let args_clone = args.clone();
        let settings_clone = settings.clone();
        let run_dir_clone = run_dir.to_path_buf();
        let inp_name_clone = inp_name.clone();
        let out_name_clone = out_name.clone();
        let cancel_flag_clone = cancel_flag.clone();
        
        let completed_count_clone = completed_count.clone();
        let max_progress_clone = max_progress.clone();

        let handle = tokio::spawn(async move {
            // Check cancellation before acquiring semaphore permit
            if cancel_flag_clone.load(Ordering::SeqCst) {
                return None;
            }

            // Acquire permit from semaphore ( limits parallel concurrency )
            let _permit = match sem.acquire().await {
                Ok(p) => p,
                Err(_) => return None,
            };

            // Check cancellation again after acquiring permit
            if cancel_flag_clone.load(Ordering::SeqCst) {
                return None;
            }

            // Run the testcase using the engine
            let params = crate::judge::engine::JudgeParams {
                tc_id: &tc_id,
                exec_path: &exec_path_clone,
                args: &args_clone,
                settings: &settings_clone,
                run_dir: &run_dir_clone,
                inp_name: &inp_name_clone,
                out_name: &out_name_clone,
                proj_db: &proj_db_clone,
                app_handle: &app_handle_clone,
            };
            let result = crate::judge::engine::judge_testcase(params).await;

            // Increment completed count
            let completed = completed_count_clone.fetch_add(1, Ordering::SeqCst) + 1;
            
            // Calculate progress percentage, ensuring it is clamped at 100%
            let raw_progress = (completed * 100) / total;
            let progress = std::cmp::min(raw_progress, 100);
            
            // Update max_progress atomically to guarantee it is strictly monotonic (never decreasing)
            let prev_max = max_progress_clone.fetch_max(progress, Ordering::SeqCst);
            let final_progress = std::cmp::max(progress, prev_max);

            // Emit the standardized monotonic batch progress
            let _ = app_handle_clone.emit("judge-batch-progress", BatchProgress {
                progress: final_progress,
                completed,
                total,
            });

            match result {
                Ok(res) => Some(res),
                Err(_) => None,
            }
        });

        join_handles.push(handle);
    }

    let mut results = Vec::new();
    for h in join_handles {
        if let Ok(Some(res)) = h.await {
            results.push(res);
        }
    }

    Ok(results)
}
