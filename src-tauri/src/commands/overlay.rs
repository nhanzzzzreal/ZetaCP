// src-tauri/src/commands/overlay.rs

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Emitter, State};
use crate::state::AppState;
use crate::errors::ZetaError;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OverlayState {
    pub id: String,
    pub file_path: String,
    pub r#type: String,
    pub title: String,
    pub content: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_minimized: bool,
    pub is_pinned: bool,
    pub opacity: f64,
    pub is_visible: bool,
    pub z_index: i32,
}

// Database Row Struct for safe SQLx mapping
#[derive(sqlx::FromRow)]
struct DbOverlayRow {
    id: String,
    file_path: String,
    #[sqlx(rename = "type")]
    r#type: String,
    title: String,
    content: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_minimized: i32,
    is_pinned: i32,
    opacity: f64,
    is_visible: i32,
    z_index: i32,
}

impl From<DbOverlayRow> for OverlayState {
    fn from(row: DbOverlayRow) -> Self {
        Self {
            id: row.id,
            file_path: row.file_path,
            r#type: row.r#type,
            title: row.title,
            content: row.content,
            x: row.x,
            y: row.y,
            width: row.width,
            height: row.height,
            is_minimized: row.is_minimized != 0,
            is_pinned: row.is_pinned != 0,
            opacity: row.opacity,
            is_visible: row.is_visible != 0,
            z_index: row.z_index,
        }
    }
}

#[tauri::command]
pub async fn load_overlays(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<OverlayState>, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => return Ok(Vec::new()),
    };

    let rows = sqlx::query_as::<_, DbOverlayRow>(
        "SELECT id, file_path, type, title, content, x, y, width, height, is_minimized, is_pinned, opacity, is_visible, z_index FROM OverlayState WHERE file_path = ?"
    )
    .bind(&file_path)
    .fetch_all(&proj_db)
    .await?;

    Ok(rows.into_iter().map(OverlayState::from).collect())
}

#[tauri::command]
pub async fn save_overlays(
    file_path: String,
    overlays: Vec<OverlayState>,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    let mut tx = proj_db.begin().await?;

    // Delete existing overlays for this file_path
    sqlx::query("DELETE FROM OverlayState WHERE file_path = ?")
        .bind(&file_path)
        .execute(&mut *tx)
        .await?;

    // Insert new overlays
    for overlay in overlays {
        sqlx::query(
            "INSERT INTO OverlayState (id, file_path, type, title, content, x, y, width, height, is_minimized, is_pinned, opacity, is_visible, z_index) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&overlay.id)
        .bind(&file_path)
        .bind(&overlay.r#type)
        .bind(&overlay.title)
        .bind(&overlay.content)
        .bind(overlay.x)
        .bind(overlay.y)
        .bind(overlay.width)
        .bind(overlay.height)
        .bind(overlay.is_minimized as i32)
        .bind(overlay.is_pinned as i32)
        .bind(overlay.opacity)
        .bind(overlay.is_visible as i32)
        .bind(overlay.z_index)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}

#[tauri::command]
pub async fn delete_overlay(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    sqlx::query("DELETE FROM OverlayState WHERE id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn create_overlay_window(
    app: AppHandle,
    overlay: OverlayState,
) -> Result<(), ZetaError> {
    let main_window = app.get_webview_window("main")
        .ok_or_else(|| ZetaError::Fatal("Main window not found".to_string()))?;

    let label = format!("overlay-widget-{}", overlay.id);

    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .parent(&main_window)
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;

    let _win = builder
        .title(&overlay.title)
        .position(overlay.x, overlay.y)
        .inner_size(overlay.width, overlay.height)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(overlay.is_pinned)
        .skip_taskbar(true)
        .build()
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn create_diff_window(
    app: AppHandle,
    testcase_name: String,
    expected: String,
    actual: String,
) -> Result<(), ZetaError> {
    let main_window = app.get_webview_window("main")
        .ok_or_else(|| ZetaError::Fatal("Main window not found".to_string()))?;

    let label = format!("overlay-diff-{}", testcase_name);

    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .parent(&main_window)
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;

    let _win = builder
        .title(format!("Diff — {}", testcase_name))
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(false)
        .skip_taskbar(true)
        .build()
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;

    // Emit event asynchronously after a delay so that standalone window event listeners have time to mount.
    let app_clone = app.clone();
    let testcase_name_clone = testcase_name.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        if let Ok(diff_lines) = crate::commands::testcases::compute_diff(expected, actual).await {
            let payload = serde_json::json!({
                "testcaseId": testcase_name_clone,
                "diffLines": diff_lines,
            });
            let _ = app_clone.emit("diff-data-updated", payload);
        }
    });

    Ok(())
}
