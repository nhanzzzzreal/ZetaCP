// src-tauri/src/commands/stress_test/db_helpers.rs

use tauri::Emitter;
use crate::errors::ZetaError;

pub async fn export_failed_testcase(
    proj_db: &sqlx::SqlitePool,
    solution_path: &str,
    iteration: i32,
    input: &str,
    expected_output: &str,
    app: &tauri::AppHandle,
) -> Result<(), ZetaError> {
    let max_order: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(order_index) FROM TestcaseMeta WHERE file_path = ?"
    )
    .bind(solution_path)
    .fetch_one(proj_db)
    .await
    .unwrap_or(None);
    let order_index = max_order.unwrap_or(0) + 1;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let id = format!("stress_{}", timestamp);
    let name = format!("Stress #{}", iteration);

    sqlx::query(
        "INSERT INTO TestcaseMeta (id, file_path, name, order_index, subtask_id, is_active) VALUES (?, ?, ?, ?, NULL, 1)"
    )
    .bind(&id)
    .bind(solution_path)
    .bind(&name)
    .bind(order_index)
    .execute(proj_db)
    .await?;

    sqlx::query(
        "INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(input)
    .bind(expected_output)
    .execute(proj_db)
    .await?;

    let _ = app.emit("testcase-list-updated", serde_json::json!({
        "filePath": solution_path,
    }));

    Ok(())
}

pub async fn save_failed_runs(
    proj_db: sqlx::SqlitePool,
    stress_session_id: String,
    gen_path: String,
    solution_path: String,
    brute_path: String,
    iteration: i32,
    gen_r: Option<crate::judge::runner::RunResult>,
    sol_r: Option<crate::judge::runner::RunResult>,
    brute_r: Option<crate::judge::runner::RunResult>,
) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let extra_json = serde_json::json!({ "iteration": iteration }).to_string();

    if let Some(r) = gen_r {
        let gen_run_id = format!("run_gen_{}_{}", stress_session_id, iteration);
        let record = crate::db::repository::RunRecord {
            id: gen_run_id,
            run_type: "stress_gen".to_string(),
            parent_id: Some(stress_session_id.clone()),
            file_path: gen_path.clone(),
            verdict: Some(r.verdict),
            exec_time_ms: r.exec_time_ms,
            memory_kb: r.memory_kb,
            actual_output: Some(r.stdout),
            diff_info: None,
            run_at: now,
            extra_json: Some(extra_json.clone()),
        };
        let repo = crate::db::repository::RunsRepository::new(&proj_db);
        let _ = repo.insert_run(&record).await;
    }

    if let Some(r) = sol_r {
        let sol_run_id = format!("run_sol_{}_{}", stress_session_id, iteration);
        let record = crate::db::repository::RunRecord {
            id: sol_run_id,
            run_type: "stress_sol".to_string(),
            parent_id: Some(stress_session_id.clone()),
            file_path: solution_path.clone(),
            verdict: Some(r.verdict),
            exec_time_ms: r.exec_time_ms,
            memory_kb: r.memory_kb,
            actual_output: Some(r.stdout),
            diff_info: None,
            run_at: now,
            extra_json: Some(extra_json.clone()),
        };
        let repo = crate::db::repository::RunsRepository::new(&proj_db);
        let _ = repo.insert_run(&record).await;
    }

    if let Some(r) = brute_r {
        let brute_run_id = format!("run_brute_{}_{}", stress_session_id, iteration);
        let record = crate::db::repository::RunRecord {
            id: brute_run_id,
            run_type: "stress_brute".to_string(),
            parent_id: Some(stress_session_id.clone()),
            file_path: brute_path.clone(),
            verdict: Some(r.verdict),
            exec_time_ms: r.exec_time_ms,
            memory_kb: r.memory_kb,
            actual_output: Some(r.stdout),
            diff_info: None,
            run_at: now,
            extra_json: Some(extra_json.clone()),
        };
        let repo = crate::db::repository::RunsRepository::new(&proj_db);
        let _ = repo.insert_run(&record).await;
    }
}
