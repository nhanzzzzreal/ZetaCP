// src-tauri/src/commands/docs.rs

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::http::{Response, Request, StatusCode};
use crate::errors::ZetaError;
use std::borrow::Cow;

#[tauri::command]
pub async fn open_docs_window(
    docs_type: String,
    app: AppHandle,
) -> Result<(), ZetaError> {
    let title = match docs_type.as_str() {
        "cp-algorithms" => "CP Algorithms Reference",
        "cppreference" => "C++ Reference",
        _ => "Reference",
    };

    let label = format!("docs-window-{}", docs_type);

    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_focus();
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(1020.0, 720.0)
        .resizable(true)
        .decorations(false)
        .always_on_top(false);

    let _win = builder.build().map_err(|e| ZetaError::Fatal(e.to_string()))?;

    Ok(())
}

fn percent_decode(s: &str) -> String {
    let mut res = String::new();
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            if let Ok(val) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                res.push(val as char);
            }
        } else {
            res.push(c);
        }
    }
    res
}

pub fn docs_protocol_handler<R: tauri::Runtime>(
    _ctx: tauri::UriSchemeContext<R>,
    request: Request<Vec<u8>>,
) -> Response<Cow<'static, [u8]>> {
    let mut exe_dir = match std::env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            return Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .header("content-type", "text/plain")
                .body(Cow::Owned(format!("Failed to locate executable: {}", e).into_bytes()))
                .unwrap();
        }
    };
    exe_dir.pop();

    let uri_path = request.uri().path();
    let decoded_path = percent_decode(uri_path);
    let clean_path = if decoded_path.starts_with('/') {
        &decoded_path[1..]
    } else {
        &decoded_path
    };

    let file_path = exe_dir.join(clean_path);

    if !file_path.exists() || !file_path.is_file() {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header("content-type", "text/plain")
            .body(Cow::Borrowed(&b"Not Found"[..]))
            .unwrap();
    }

    let body = match std::fs::read(&file_path) {
        Ok(data) => data,
        Err(e) => {
            return Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .header("content-type", "text/plain")
                .body(Cow::Owned(format!("Failed to read file: {}", e).into_bytes()))
                .unwrap();
        }
    };

    let mime_type = match file_path.extension().and_then(|s| s.to_str()) {
        Some("html") | Some("htm") => "text/html",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("json") => "application/json",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        _ => "application/octet-stream",
    };

    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", mime_type)
        .body(Cow::Owned(body))
        .unwrap()
}

#[tauri::command]
pub fn get_docs_path(docs_type: String) -> Result<String, ZetaError> {
    let mut exe_dir = std::env::current_exe()
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
    exe_dir.pop();

    let relative_path = match docs_type.as_str() {
        "cp-algorithms" => "cp-algorithms/index.html",
        "cppreference" => "cppreference/reference/en/index.html",
        _ => "index.html",
    };

    let full_path = exe_dir.join(relative_path);
    
    if !full_path.exists() {
        return Err(ZetaError::Fatal(format!(
            "Offline documentation file not found. Expected path: {}",
            full_path.display()
        )));
    }

    let path_str = full_path.to_string_lossy().into_owned();
    let clean_path = if path_str.starts_with(r"\\?\") {
        path_str[4..].to_string()
    } else {
        path_str
    };

    Ok(clean_path.replace('\\', "/"))
}
