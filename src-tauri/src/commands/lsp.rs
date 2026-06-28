// src-tauri/src/commands/lsp.rs

pub mod helper;

use tauri::{AppHandle, State};
use serde_json::Value;
use crate::errors::ZetaError;
use crate::state::AppState;
use helper::*;
pub use helper::LspServerInstance;

#[tauri::command]
pub async fn lsp_initialize(
    language: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let _ = get_or_spawn_lsp(&language, &state, app_handle).await?;
    Ok(())
}

fn resolve_abs_path_sync(file_path: &str, project_root: &Option<String>) -> String {
    if std::path::Path::new(file_path).is_relative() {
        if let Some(ref root) = project_root {
            std::path::Path::new(root).join(file_path).to_string_lossy().to_string()
        } else {
            file_path.to_string()
        }
    } else {
        file_path.to_string()
    }
}

#[tauri::command]
pub async fn lsp_did_open(
    language: String,
    file_path: String,
    content: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let instance = get_or_spawn_lsp(&language, &state, app_handle).await?;
    
    let root_guard = state.project_root.lock().await;
    let abs_path = resolve_abs_path_sync(&file_path, &root_guard);
    let file_uri = path_to_uri(&abs_path);

    let params = serde_json::json!({
        "textDocument": {
            "uri": file_uri,
            "languageId": if language == "cpp" { "cpp" } else { "python" },
            "version": 1,
            "text": content
        }
    });

    instance.send_notification("textDocument/didOpen", params).await?;
    Ok(())
}

#[tauri::command]
pub async fn lsp_did_change(
    language: String,
    file_path: String,
    content: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let instance = get_or_spawn_lsp(&language, &state, app_handle).await?;

    let root_guard = state.project_root.lock().await;
    let abs_path = resolve_abs_path_sync(&file_path, &root_guard);
    let file_uri = path_to_uri(&abs_path);

    let params = serde_json::json!({
        "textDocument": {
            "uri": file_uri,
            "version": 2
        },
        "contentChanges": [
            {
                "text": content
            }
        ]
    });

    instance.send_notification("textDocument/didChange", params).await?;
    Ok(())
}

#[tauri::command]
pub async fn lsp_get_completions(
    language: String,
    file_path: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<Value, ZetaError> {
    let instance = get_or_spawn_lsp(&language, &state, app_handle).await?;

    let root_guard = state.project_root.lock().await;
    let abs_path = resolve_abs_path_sync(&file_path, &root_guard);
    let file_uri = path_to_uri(&abs_path);

    let params = serde_json::json!({
        "textDocument": {
            "uri": file_uri
        },
        "position": {
            "line": line,
            "character": character
        }
    });

    let result = instance.send_request("textDocument/completion", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn lsp_get_hover(
    language: String,
    file_path: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<Value, ZetaError> {
    let instance = get_or_spawn_lsp(&language, &state, app_handle).await?;

    let root_guard = state.project_root.lock().await;
    let abs_path = resolve_abs_path_sync(&file_path, &root_guard);
    let file_uri = path_to_uri(&abs_path);

    let params = serde_json::json!({
        "textDocument": {
            "uri": file_uri
        },
        "position": {
            "line": line,
            "character": character
        }
    });

    let result = instance.send_request("textDocument/hover", params).await?;
    Ok(result)
}

#[tauri::command]
pub async fn lsp_get_definition(
    language: String,
    file_path: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<Value, ZetaError> {
    let instance = get_or_spawn_lsp(&language, &state, app_handle).await?;

    let root_guard = state.project_root.lock().await;
    let abs_path = resolve_abs_path_sync(&file_path, &root_guard);
    let file_uri = path_to_uri(&abs_path);

    let params = serde_json::json!({
        "textDocument": {
            "uri": file_uri
        },
        "position": {
            "line": line,
            "character": character
        }
    });

    let result = instance.send_request("textDocument/definition", params).await?;
    Ok(result)
}
