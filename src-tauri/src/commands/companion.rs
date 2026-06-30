// src-tauri/src/commands/companion.rs

use tauri::{State, AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde::{Deserialize, Serialize};
use crate::state::AppState;
use crate::errors::ZetaError;
use sha2::{Sha256, Digest};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompanionTest {
    pub input: String,
    pub output: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompanionInputOutput {
    pub r#type: String, // "stdin" | "stdout" | "file"
    pub file_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompanionProblem {
    pub name: String,
    pub group: String,
    pub url: String,
    pub interactive: Option<bool>,
    pub memory_limit: i64,
    pub time_limit: i64,
    pub tests: Vec<CompanionTest>,
    pub input: Option<CompanionInputOutput>,
    pub output: Option<CompanionInputOutput>,
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}

fn parse_content_length(headers: &str) -> Option<usize> {
    for line in headers.lines() {
        if line.to_lowercase().starts_with("content-length:") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() == 2 {
                if let Ok(len) = parts[1].trim().parse::<usize>() {
                    return Some(len);
                }
            }
        }
    }
    None
}

fn generate_in_memory_id(name: &str, idx: usize) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let mut hasher = Sha256::new();
    hasher.update(format!("{}-{}-{}", now, name, idx).as_bytes());
    format!("{:x}", hasher.finalize())[..32].to_string()
}

async fn run_listener(app_handle: AppHandle, port: u16) -> Result<(), std::io::Error> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
    tracing::info!("Competitive Companion HTTP server listening on 127.0.0.1:{}", port);
    
    loop {
        let (mut socket, _) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::error!("Failed to accept connection: {}", e);
                continue;
            }
        };
        let app_handle_clone = app_handle.clone();
        
        tokio::spawn(async move {
            let mut buffer = vec![0; 256 * 1024]; // 256KB buffer for large testcases
            let mut read_bytes = 0;
            
            loop {
                match socket.read(&mut buffer[read_bytes..]).await {
                    Ok(0) => break,
                    Ok(n) => {
                        read_bytes += n;
                        if let Some(pos) = find_subsequence(&buffer[..read_bytes], b"\r\n\r\n") {
                            let headers_part = String::from_utf8_lossy(&buffer[..pos]);
                            
                            // Handle preflight OPTIONS request
                            if headers_part.starts_with("OPTIONS") {
                                let response = "HTTP/1.1 200 OK\r\n\
                                                Access-Control-Allow-Origin: *\r\n\
                                                Access-Control-Allow-Methods: POST, OPTIONS\r\n\
                                                Access-Control-Allow-Headers: *\r\n\
                                                Content-Length: 0\r\n\
                                                Connection: close\r\n\r\n";
                                let _ = socket.write_all(response.as_bytes()).await;
                                let _ = socket.flush().await;
                                return;
                            }
                            
                            let content_length = parse_content_length(&headers_part).unwrap_or(0);
                            let body_start = pos + 4;
                            let total_needed = body_start + content_length;
                            
                            if total_needed > buffer.len() {
                                buffer.resize(total_needed, 0);
                            }
                            
                            while read_bytes < total_needed {
                                match socket.read(&mut buffer[read_bytes..]).await {
                                    Ok(0) => break,
                                    Ok(m) => read_bytes += m,
                                    Err(_) => break,
                                }
                            }
                            
                            if read_bytes >= total_needed {
                                let body = &buffer[body_start..total_needed];
                                if let Ok(problem) = serde_json::from_slice::<CompanionProblem>(body) {
                                    tracing::info!("Received problem from companion: {}", problem.name);
                                    let _ = app_handle_clone.emit("companion://problem", problem);
                                } else {
                                    tracing::warn!("Failed to parse JSON body from companion");
                                }
                            }
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            
            let response = "HTTP/1.1 200 OK\r\n\
                            Access-Control-Allow-Origin: *\r\n\
                            Access-Control-Allow-Headers: *\r\n\
                            Content-Length: 0\r\n\
                            Connection: close\r\n\r\n";
            let _ = socket.write_all(response.as_bytes()).await;
            let _ = socket.flush().await;
        });
    }
}

#[tauri::command]
pub async fn start_companion_listener(
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let mut handle_guard = state.companion_handle.lock().await;
    if handle_guard.is_some() {
        return Ok(());
    }

    let port = 10042;
    let app_handle_clone = app_handle.clone();
    let join_handle = tokio::spawn(async move {
        if let Err(e) = run_listener(app_handle_clone, port).await {
            tracing::error!("Error running companion listener: {}", e);
        }
    });

    *handle_guard = Some(join_handle);
    Ok(())
}

#[tauri::command]
pub async fn stop_companion_listener(
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let mut handle_guard = state.companion_handle.lock().await;
    if let Some(handle) = handle_guard.take() {
        handle.abort();
        tracing::info!("Competitive Companion listener stopped.");
    }
    Ok(())
}

#[tauri::command]
pub async fn is_companion_listener_running(
    state: State<'_, AppState>,
) -> Result<bool, ZetaError> {
    let guard = state.companion_handle.lock().await;
    Ok(guard.is_some())
}

#[tauri::command]
pub async fn overwrite_testcases(
    file_path: String,
    tests: Vec<CompanionTest>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    let mut tx = proj_db.begin().await?;

    // 1. Delete existing testcases for this file
    sqlx::query("DELETE FROM TestcaseMeta WHERE file_path = ?")
        .bind(&file_path)
        .execute(&mut *tx)
        .await?;

    // 2. Insert new ones
    for (idx, test) in tests.into_iter().enumerate() {
        let name = format!("Test {}", idx + 1);
        let id = generate_in_memory_id(&name, idx);
        let order_index = idx as i32;
        
        sqlx::query("INSERT INTO TestcaseMeta (id, file_path, name, order_index, subtask_id, is_active) VALUES (?, ?, ?, ?, NULL, 1)")
            .bind(&id).bind(&file_path).bind(&name).bind(order_index).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?)")
            .bind(&id).bind(&test.input).bind(&test.output).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO TestcaseResult (id, last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at) VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL)")
            .bind(&id).execute(&mut *tx).await?;
    }

    tx.commit().await?;

    // 3. Emit update event so frontend reloads
    let _ = app_handle.emit("testcase-list-updated", serde_json::json!({ "filePath": file_path }));

    Ok(())
}
