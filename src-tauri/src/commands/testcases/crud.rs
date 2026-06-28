// src-tauri/src/commands/testcases/crud.rs

use tauri::State;
use crate::state::AppState;
use crate::errors::ZetaError;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn add_testcase(
    id: String,
    file_path: String,
    name: String,
    order_index: i32,
    input: String,
    expected_output: String,
    subtask_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query(
        "INSERT INTO TestcaseMeta (id, file_path, name, order_index, subtask_id, is_active) VALUES (?, ?, ?, ?, ?, 1)"
    )
    .bind(&id)
    .bind(&file_path)
    .bind(&name)
    .bind(order_index)
    .bind(&subtask_id)
    .execute(&proj_db)
    .await?;

    sqlx::query(
        "INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(&input)
    .bind(&expected_output)
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn delete_testcase(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query("DELETE FROM TestcaseMeta WHERE id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn update_testcase_data(
    file_path: String,
    id: String,
    input: String,
    expected_output: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query(
        "INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET input = excluded.input, expected_output = excluded.expected_output"
    )
    .bind(&id)
    .bind(&input)
    .bind(&expected_output)
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_testcase_active(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query("UPDATE TestcaseMeta SET is_active = 1 - is_active WHERE id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn save_testcases_ce(
    file_path: String,
    testcase_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    for tc_id in testcase_ids {
        sqlx::query(
            "INSERT INTO TestcaseResult (id, last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at) \
             VALUES (?, 'CE', NULL, NULL, NULL, NULL, ?) \
             ON CONFLICT(id) DO UPDATE SET \
                last_status = 'CE', \
                exec_time_ms = NULL, \
                memory_kb = NULL, \
                actual_output = NULL, \
                diff_info = NULL, \
                run_at = ?"
        )
        .bind(&tc_id)
        .bind(now)
        .bind(now)
        .execute(&proj_db)
        .await?;
    }

    Ok(())
}
