// src-tauri/src/commands/testcases/subtasks.rs

use tauri::State;
use crate::state::AppState;
use crate::errors::ZetaError;

#[tauri::command]
pub async fn add_subtask(
    id: String,
    file_path: String,
    name: String,
    max_score: i32,
    order_index: i32,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query(
        "INSERT INTO Subtask (id, file_path, name, max_score, order_index) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&file_path)
    .bind(&name)
    .bind(max_score)
    .bind(order_index)
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn delete_subtask(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query("UPDATE TestcaseMeta SET subtask_id = NULL WHERE subtask_id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    sqlx::query("DELETE FROM Subtask WHERE id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn assign_to_subtask(
    file_path: String,
    testcase_id: String,
    subtask_id: Option<String>,
    order_index: i32,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query("UPDATE TestcaseMeta SET subtask_id = ?, order_index = ? WHERE id = ?")
        .bind(&subtask_id)
        .bind(order_index)
        .bind(&testcase_id)
        .execute(&proj_db)
        .await?;

    Ok(())
}
