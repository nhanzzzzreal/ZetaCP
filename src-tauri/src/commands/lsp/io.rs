// src-tauri/src/commands/lsp/io.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot, mpsc};
use serde_json::Value;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};

pub fn spawn_stdin_writer(mut stdin: tokio::process::ChildStdin, mut stdin_rx: mpsc::Receiver<String>) {
    tokio::spawn(async move {
        while let Some(msg) = stdin_rx.recv().await {
            let payload = format!("Content-Length: {}\r\n\r\n{}", msg.len(), msg);
            if stdin.write_all(payload.as_bytes()).await.is_err() {
                break;
            }
            if stdin.flush().await.is_err() {
                break;
            }
        }
    });
}

pub fn spawn_stderr_logger(language: &str, mut stderr: tokio::process::ChildStderr) {
    let language_log = language.to_string();
    tokio::spawn(async move {
        let mut reader = BufReader::new(&mut stderr);
        let mut buf = vec![0u8; 1024];
        while let Ok(n) = reader.read(&mut buf).await {
            if n == 0 {
                break;
            }
            let log_str = String::from_utf8_lossy(&buf[..n]);
            tracing::debug!("[LSP Stderr - {}] {}", language_log, log_str);
        }
    });
}

pub async fn read_message<R: AsyncReadExt + Unpin>(reader: &mut R) -> Result<String, std::io::Error> {
    let mut content_length = 0;
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
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Zero content length"));
    }

    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body).await?;
    let body_str = String::from_utf8(body).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    Ok(body_str)
}

pub fn spawn_stdout_reader(
    language: &str,
    stdout: tokio::process::ChildStdout,
    pending_requests: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    app_handle: AppHandle,
    mut child: tokio::process::Child,
) -> tokio::task::JoinHandle<()> {
    let lang = language.to_string();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        while let Ok(body_str) = read_message(&mut reader).await {
            if let Ok(msg) = serde_json::from_str::<Value>(&body_str) {
                super::handle_stdout_message(msg, &lang, &pending_requests, &app_handle).await;
            }
        }
        let _ = child.kill().await;
    })
}
