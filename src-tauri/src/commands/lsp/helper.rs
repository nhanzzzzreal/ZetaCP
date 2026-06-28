// src-tauri/src/commands/lsp/helper.rs

use tauri::{AppHandle, State, Emitter};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot, mpsc};
use std::sync::atomic::{AtomicI64, Ordering};
use serde_json::Value;
use crate::errors::ZetaError;
use crate::state::AppState;
#[path = "io.rs"]
mod io;
use io::{spawn_stdin_writer, spawn_stderr_logger, spawn_stdout_reader};

#[path = "setup.rs"]
mod setup;
use setup::{build_lsp_command, ensure_compile_flags, resolve_lsp_exec_and_args, get_lsp_extra_path};
pub use setup::path_to_uri;

pub struct LspServerInstance {
    stdin_tx: mpsc::Sender<String>,
    pending_requests: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    next_id: AtomicI64,
    _child_handle: tokio::task::JoinHandle<()>,
}

pub struct LspSpawnParams<'a> {
    pub language: &'a str,
    pub exec_path: &'a str,
    pub args: &'a [&'a str],
    pub extra_path: Option<String>,
    pub app_handle: AppHandle,
}





pub(crate) async fn handle_stdout_message(
    msg: Value,
    language: &str,
    pending_requests: &Mutex<HashMap<i64, oneshot::Sender<Value>>>,
    app_handle: &AppHandle,
) {
    if let Some(id_val) = msg.get("id") {
        if let Some(id) = id_val.as_i64() {
            let mut reqs = pending_requests.lock().await;
            if let Some(tx) = reqs.remove(&id) {
                let _ = tx.send(msg);
            }
        }
    } else if let Some(method_val) = msg.get("method") {
        if method_val.as_str() == Some("textDocument/publishDiagnostics") {
            if let Some(params) = msg.get("params") {
                let mut payload = params.clone();
                if let Some(obj) = payload.as_object_mut() {
                    obj.insert("language".to_string(), Value::String(language.to_string()));
                }
                let _ = app_handle.emit("lsp://diagnostics", payload);
            }
        }
    }
}

impl LspServerInstance {
    pub async fn spawn(params: LspSpawnParams<'_>) -> Result<Self, ZetaError> {
        let mut cmd = build_lsp_command(&params)?;
        let mut child = cmd.spawn().map_err(|e| {
            ZetaError::Io(format!(
                "Failed to spawn LSP server for {} at {}: {}",
                params.language, params.exec_path, e
            ))
        })?;

        let stdout = child.stdout.take().ok_or_else(|| ZetaError::Fatal("Failed to open LSP stdout".into()))?;
        let stdin = child.stdin.take().ok_or_else(|| ZetaError::Fatal("Failed to open LSP stdin".into()))?;
        let stderr = child.stderr.take().ok_or_else(|| ZetaError::Fatal("Failed to open LSP stderr".into()))?;

        let (stdin_tx, stdin_rx) = mpsc::channel::<String>(128);
        spawn_stdin_writer(stdin, stdin_rx);
        spawn_stderr_logger(params.language, stderr);

        let pending_requests = Arc::new(Mutex::new(HashMap::<i64, oneshot::Sender<Value>>::new()));
        let child_handle = spawn_stdout_reader(params.language, stdout, Arc::clone(&pending_requests), params.app_handle, child);

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
        self.stdin_tx.send(msg_str).await.map_err(|_| ZetaError::Fatal("LSP connection closed".into()))?;
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
        if self.stdin_tx.send(msg_str).await.is_err() {
            let mut reqs = self.pending_requests.lock().await;
            reqs.remove(&id);
            return Err(ZetaError::Fatal("LSP server stopped".into()));
        }

        let response = rx.await.map_err(|_| ZetaError::Fatal("LSP request cancelled or server crashed".into()))?;
        if let Some(err) = response.get("error") {
            return Err(ZetaError::Fatal(err.to_string()));
        }

        Ok(response.get("result").cloned().unwrap_or(Value::Null))
    }
}





pub async fn get_or_spawn_lsp(
    language: &str,
    state: &State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<Arc<LspServerInstance>, ZetaError> {
    let mut instances = state.lsp_instances.lock().await;
    if let Some(instance) = instances.get(language) {
        return Ok(Arc::clone(instance));
    }

    let (exec_path, mut args) = resolve_lsp_exec_and_args(language).await;
    let extra_path = get_lsp_extra_path(language, state, &mut args).await;
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let spawn_params = LspSpawnParams {
        language,
        exec_path: &exec_path,
        args: &args_ref,
        extra_path,
        app_handle,
    };

    let instance = Arc::new(LspServerInstance::spawn(spawn_params).await?);

    let root_path_guard = state.project_root.lock().await;
    let root_path = root_path_guard.clone().unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")).to_string_lossy().to_string()
    });

    if language == "cpp" {
        let _ = ensure_compile_flags(&root_path, &state.settings_db).await;
    }

    let init_params = serde_json::json!({
        "processId": std::process::id(),
        "rootPath": root_path,
        "rootUri": path_to_uri(&root_path),
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

    let _init_res = instance.send_request("initialize", init_params).await?;
    instance.send_notification("initialized", serde_json::json!({})).await?;

    instances.insert(language.to_string(), Arc::clone(&instance));
    Ok(instance)
}
