// src-tauri/src/commands/lsp.rs

use tauri::{AppHandle, State, Emitter};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot, mpsc};
use std::sync::atomic::{AtomicI64, Ordering};
use serde_json::Value;
use crate::errors::ZetaError;
use crate::state::AppState;
use tokio::process::Command;
use std::process::Stdio;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};

fn log_debug(_msg: &str) {
}

pub struct LspServerInstance {
    stdin_tx: mpsc::Sender<String>,
    pending_requests: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    next_id: AtomicI64,
    _child_handle: tokio::task::JoinHandle<()>,
}

impl LspServerInstance {
    pub async fn spawn(
        language: &str,
        exec_path: &str,
        args: &[&str],
        extra_path: Option<String>,
        app_handle: AppHandle,
    ) -> Result<Self, ZetaError> {
        log_debug(&format!("[SPAWN - {}] Path: {}, Args: {:?}, Extra Path: {:?}", language, exec_path, args, extra_path));
        
        let mut cmd = Command::new(exec_path);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        if let Some(ref path_dir) = extra_path {
            let mut paths = vec![std::path::PathBuf::from(path_dir)];
            if let Ok(current_path) = std::env::var("PATH") {
                paths.extend(std::env::split_paths(&current_path));
            }
            if let Ok(new_path) = std::env::join_paths(paths) {
                cmd.env("PATH", new_path);
            }
        }

        if language == "python" {
            if let Ok(mut exe_dir) = std::env::current_exe() {
                exe_dir.pop();
                let python_dir = exe_dir.join("python-3.12.7");
                if python_dir.exists() {
                    cmd.env("PYTHONHOME", &python_dir);
                    let lib_dir = python_dir.join("Lib");
                    let site_packages = lib_dir.join("site-packages");
                    if let Ok(p_path) = std::env::join_paths(vec![lib_dir, site_packages]) {
                        cmd.env("PYTHONPATH", p_path);
                    }
                }
            }
        }

        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut child = cmd.spawn().map_err(|e| {
            log_debug(&format!("[SPAWN_ERROR_SPAWNING - {}] {}", language, e));
            ZetaError::Io(format!(
                "Failed to spawn LSP server for {} at {}: {}",
                language, exec_path, e
            ))
        })?;

        let stdout = child.stdout.take().ok_or_else(|| {
            ZetaError::Fatal("Failed to open LSP stdout".into())
        })?;
        let mut stdin = child.stdin.take().ok_or_else(|| {
            ZetaError::Fatal("Failed to open LSP stdin".into())
        })?;
        let mut stderr = child.stderr.take().ok_or_else(|| {
            ZetaError::Fatal("Failed to open LSP stderr".into())
        })?;

        // Channel for writing to stdin
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(128);

        // Spawn stdin writer task
        tokio::spawn(async move {
            while let Some(msg) = stdin_rx.recv().await {
                let payload = format!("Content-Length: {}\r\n\r\n{}", msg.len(), msg);
                if let Err(e) = stdin.write_all(payload.as_bytes()).await {
                    tracing::error!("Failed to write to LSP stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush().await {
                    tracing::error!("Failed to flush LSP stdin: {}", e);
                    break;
                }
            }
        });

        // Spawn stderr logger task
        let language_log = language.to_string();
        tokio::spawn(async move {
            let mut reader = BufReader::new(&mut stderr);
            let mut buf = vec![0u8; 1024];
            loop {
                match reader.read(&mut buf).await {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let log_str = String::from_utf8_lossy(&buf[..n]);
                        log_debug(&format!("[STDERR - {}] {}", language_log, log_str));
                        tracing::debug!("[LSP Stderr - {}] {}", language_log, log_str);
                    }
                    Err(_) => break,
                }
            }
        });

        // Pending requests map
        let pending_requests = Arc::new(Mutex::new(HashMap::<i64, oneshot::Sender<Value>>::new()));
        let pending_requests_clone = Arc::clone(&pending_requests);
        let language_clone = language.to_string();

        // Spawn stdout reader task
        let child_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            loop {
                match read_message(&mut reader).await {
                    Ok(body_str) => {
                        log_debug(&format!("[STDOUT - {}] {}", language_clone, body_str));
                        if let Ok(msg) = serde_json::from_str::<Value>(&body_str) {
                            if let Some(id_val) = msg.get("id") {
                                // It's a response
                                if let Some(id) = id_val.as_i64() {
                                    let mut reqs = pending_requests_clone.lock().await;
                                    if let Some(tx) = reqs.remove(&id) {
                                        let _ = tx.send(msg);
                                    }
                                }
                            } else if let Some(method_val) = msg.get("method") {
                                // It's a notification
                                if let Some(method) = method_val.as_str() {
                                    if method == "textDocument/publishDiagnostics" {
                                        if let Some(params) = msg.get("params") {
                                            let mut payload = params.clone();
                                            if let Some(obj) = payload.as_object_mut() {
                                                obj.insert(
                                                    "language".to_string(),
                                                    Value::String(language_clone.clone()),
                                                );
                                            }
                                            let _ = app_handle.emit("lsp://diagnostics", payload);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log_debug(&format!("[STDOUT_ERROR - {}] {}", language_clone, e));
                        tracing::warn!("LSP stdout reader closed for {}: {}", language_clone, e);
                        break;
                    }
                }
            }
            // Child process exited
            let _ = child.kill().await;
        });

        Ok(Self {
            stdin_tx,
            pending_requests,
            next_id: AtomicI64::new(1),
            _child_handle: child_handle,
        })
    }

    pub async fn send_notification(&self, method: &str, params: Value) -> Result<(), ZetaError> {
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });
        let msg_str = serde_json::to_string(&msg).map_err(|e| ZetaError::Fatal(e.to_string()))?;
        log_debug(&format!("[SEND_NOTIFICATION] {}", msg_str));
        self.stdin_tx.send(msg_str).await.map_err(|_| {
            ZetaError::Fatal("LSP connection closed".into())
        })?;
        Ok(())
    }

    pub async fn send_request(&self, method: &str, params: Value) -> Result<Value, ZetaError> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });

        let (tx, rx) = oneshot::channel();
        {
            let mut reqs = self.pending_requests.lock().await;
            reqs.insert(id, tx);
        }

        let msg_str = serde_json::to_string(&msg).map_err(|e| ZetaError::Fatal(e.to_string()))?;
        log_debug(&format!("[SEND_REQUEST - id {}] {}", id, msg_str));
        if self.stdin_tx.send(msg_str).await.is_err() {
            let mut reqs = self.pending_requests.lock().await;
            reqs.remove(&id);
            return Err(ZetaError::Fatal("LSP server stopped".into()));
        }

        let response = rx.await.map_err(|_| {
            ZetaError::Fatal("LSP request cancelled or server crashed".into())
        })?;

        if let Some(err) = response.get("error") {
            return Err(ZetaError::Fatal(err.to_string()));
        }

        Ok(response.get("result").cloned().unwrap_or(Value::Null))
    }
}

async fn read_message<R: AsyncReadExt + Unpin>(reader: &mut R) -> Result<String, std::io::Error> {
    let mut content_length = 0;

    // Read headers line by line
    loop {
        let mut line = String::new();
        let mut byte = [0u8; 1];
        loop {
            reader.read_exact(&mut byte).await?;
            let c = byte[0] as char;
            line.push(c);
            if byte[0] == b'\n' {
                break;
            }
        }

        if line == "\r\n" || line == "\n" {
            break;
        }

        if line.to_lowercase().starts_with("content-length:") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() >= 2 {
                if let Ok(len) = parts[1].trim().parse::<usize>() {
                    content_length = len;
                }
            }
        }
    }

    if content_length == 0 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Zero content length",
        ));
    }

    // Read body
    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body).await?;
    let body_str = String::from_utf8(body).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, e)
    })?;

    Ok(body_str)
}

fn path_to_uri(path: &str) -> String {
    if path.starts_with("file://") {
        return path.to_string();
    }
    let normalized = path.replace("\\", "/");
    if normalized.starts_with('/') {
        format!("file://{}", normalized)
    } else {
        format!("file:///{}", normalized)
    }
}

async fn ensure_compile_flags(project_root: &str, settings_db: &sqlx::SqlitePool) -> Result<(), std::io::Error> {
    let path = std::path::Path::new(project_root).join("compile_flags.txt");
    let default_flags = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.default_flags'")
        .fetch_optional(settings_db)
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| "-O2 -std=c++17".to_string());
        
    let mut flags = Vec::new();
    for flag in default_flags.split_whitespace() {
        flags.push(flag.to_string());
    }
    
    #[cfg(target_os = "windows")]
    {
        flags.push("-target".to_string());
        flags.push("x86_64-pc-windows-gnu".to_string());
    }
    
    let content = flags.join("\n");
    tokio::fs::write(path, content).await?;
    Ok(())
}

async fn get_or_spawn_lsp(
    language: &str,
    state: &State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<Arc<LspServerInstance>, ZetaError> {
    let mut instances = state.lsp_instances.lock().await;
    if let Some(instance) = instances.get(language) {
        return Ok(Arc::clone(instance));
    }

    // Resolve executable paths
    let mut exec_path = language.to_string();
    let mut args: Vec<String> = Vec::new();

    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        if language == "cpp" {
            let portable_clangd = exe_dir.join("clangd.exe");
            if portable_clangd.exists() {
                exec_path = portable_clangd.to_string_lossy().to_string();
            } else {
                exec_path = "clangd".to_string();
            }
            args.push("--query-driver=**".to_string());
            args.push("--background-index".to_string());
            
            // Explicitly set resource-dir to help clangd find standard built-in headers (like mm_malloc.h)
            let resource_dir_18 = exe_dir.join("lib").join("clang").join("18");
            let resource_dir_18_1_3 = exe_dir.join("lib").join("clang").join("18.1.3");
            if resource_dir_18.exists() {
                args.push(format!("--resource-dir={}", resource_dir_18.to_string_lossy()));
            } else if resource_dir_18_1_3.exists() {
                args.push(format!("--resource-dir={}", resource_dir_18_1_3.to_string_lossy()));
            }
        } else if language == "python" {
            exec_path = crate::resolve_portable_path(&crate::get_default_python());
            args.push("-m".to_string());
            args.push("pylsp".to_string());
        }
    }

    // Get g++ path parent directory to add to PATH for child processes
    let pool = &state.settings_db;
    let mut extra_path: Option<String> = None;
    if language == "cpp" {
        // Prefer stored setting, otherwise fall back to dynamic default
        let gpp_val = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.gpp_path'")
            .fetch_optional(pool)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| crate::get_default_gpp());

        let resolved_gpp = crate::resolve_portable_path(&gpp_val);
        let resolved_path = std::path::Path::new(&resolved_gpp);

        if let Some(parent) = resolved_path.parent() {
            let parent_str = parent.to_string_lossy();
            if !parent_str.is_empty() && parent_str != "." {
                extra_path = Some(parent_str.to_string());
            }
        }

        // Update --query-driver arg to point to exact resolved g++ so clangd
        // queries the correct compiler for system include paths
        if let Some(pos) = args.iter().position(|a| a.starts_with("--query-driver=")) {
            args[pos] = format!("--query-driver={}", resolved_gpp);
        }
    } else if language == "python" {
        if let Ok(mut exe_dir) = std::env::current_exe() {
            exe_dir.pop();
            let python_dir = exe_dir.join("python-3.12.7");
            if python_dir.exists() {
                extra_path = Some(python_dir.to_string_lossy().to_string());
            }
        }
    }

    // Compile borrowed slice of string references for the Command call
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    log_debug(&format!("[GET_OR_SPAWN] Spawning instance for: {}", language));
    let spawn_res = LspServerInstance::spawn(language, &exec_path, &args_ref, extra_path, app_handle).await;
    let instance = match spawn_res {
        Ok(inst) => {
            log_debug(&format!("[SPAWN_SUCCESS - {}]", language));
            Arc::new(inst)
        }
        Err(e) => {
            log_debug(&format!("[SPAWN_ERROR - {}] {:?}", language, e));
            return Err(e);
        }
    };

    // Initialize LSP server
    let root_path_guard = state.project_root.lock().await;
    let root_path = root_path_guard.clone().unwrap_or_else(|| {
        std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .to_string_lossy()
            .to_string()
    });

    if language == "cpp" {
        if let Err(e) = ensure_compile_flags(&root_path, &state.settings_db).await {
            log_debug(&format!("[COMPILE_FLAGS_ERROR] {:?}", e));
            tracing::warn!("Failed to generate compile_flags.txt: {}", e);
        }
    }

    let root_uri = path_to_uri(&root_path);

    let init_params = serde_json::json!({
        "processId": std::process::id(),
        "rootPath": root_path,
        "rootUri": root_uri,
        "capabilities": {
            "textDocument": {
                "completion": {
                    "completionItem": {
                        "documentationFormat": ["markdown", "plaintext"],
                        "snippetSupport": true
                    }
                },
                "hover": {
                    "contentFormat": ["markdown", "plaintext"]
                },
                "definition": {
                    "dynamicRegistration": true
                }
            }
        }
    });

    log_debug(&format!("[INITIALIZE_REQUEST - {}]", language));
    let init_result = instance.send_request("initialize", init_params).await;
    match init_result {
        Ok(res) => {
            log_debug(&format!("[INITIALIZE_SUCCESS - {}] {:?}", language, res));
        }
        Err(e) => {
            log_debug(&format!("[INITIALIZE_ERROR - {}] {:?}", language, e));
            return Err(e);
        }
    }
    
    log_debug(&format!("[INITIALIZED_NOTIFICATION - {}]", language));
    instance.send_notification("initialized", serde_json::json!({})).await?;

    instances.insert(language.to_string(), Arc::clone(&instance));
    log_debug(&format!("[LSP_READY - {}]", language));
    Ok(instance)
}

#[tauri::command]
pub async fn lsp_initialize(
    language: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let _ = get_or_spawn_lsp(&language, &state, app_handle).await?;
    Ok(())
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
    
    // Resolve absolute path using project_root
    let abs_path = if std::path::Path::new(&file_path).is_relative() {
        let root_guard = state.project_root.lock().await;
        if let Some(ref root) = *root_guard {
            std::path::Path::new(root).join(&file_path).to_string_lossy().to_string()
        } else {
            file_path.clone()
        }
    } else {
        file_path.clone()
    };

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

    let abs_path = if std::path::Path::new(&file_path).is_relative() {
        let root_guard = state.project_root.lock().await;
        if let Some(ref root) = *root_guard {
            std::path::Path::new(root).join(&file_path).to_string_lossy().to_string()
        } else {
            file_path.clone()
        }
    } else {
        file_path.clone()
    };

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

    let abs_path = if std::path::Path::new(&file_path).is_relative() {
        let root_guard = state.project_root.lock().await;
        if let Some(ref root) = *root_guard {
            std::path::Path::new(root).join(&file_path).to_string_lossy().to_string()
        } else {
            file_path.clone()
        }
    } else {
        file_path.clone()
    };

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

    let abs_path = if std::path::Path::new(&file_path).is_relative() {
        let root_guard = state.project_root.lock().await;
        if let Some(ref root) = *root_guard {
            std::path::Path::new(root).join(&file_path).to_string_lossy().to_string()
        } else {
            file_path.clone()
        }
    } else {
        file_path.clone()
    };

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

    let abs_path = if std::path::Path::new(&file_path).is_relative() {
        let root_guard = state.project_root.lock().await;
        if let Some(ref root) = *root_guard {
            std::path::Path::new(root).join(&file_path).to_string_lossy().to_string()
        } else {
            file_path.clone()
        }
    } else {
        file_path.clone()
    };

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
