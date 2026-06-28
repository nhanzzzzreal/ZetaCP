// src-tauri/src/commands/lsp/setup.rs

use std::path::{Path, PathBuf};
use std::process::Stdio;
use crate::errors::ZetaError;
use crate::state::AppState;
use super::LspSpawnParams;

pub fn setup_lsp_path_env(cmd: &mut tokio::process::Command, path_dir: &str) {
    let mut paths = vec![PathBuf::from(path_dir)];
    if let Ok(current_path) = std::env::var("PATH") {
        paths.extend(std::env::split_paths(&current_path));
    }
    if let Ok(new_path) = std::env::join_paths(paths) {
        cmd.env("PATH", new_path);
    }
}

pub fn setup_python_env(cmd: &mut tokio::process::Command) {
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

pub fn build_lsp_command(params: &LspSpawnParams<'_>) -> Result<tokio::process::Command, ZetaError> {
    let mut cmd = tokio::process::Command::new(params.exec_path);
    cmd.args(params.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(ref path_dir) = params.extra_path {
        setup_lsp_path_env(&mut cmd, path_dir);
    }
    if params.language == "python" {
        setup_python_env(&mut cmd);
    }
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    Ok(cmd)
}

pub fn path_to_uri(path: &str) -> String {
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

pub async fn ensure_compile_flags(project_root: &str, settings_db: &sqlx::SqlitePool) -> Result<(), std::io::Error> {
    let path = Path::new(project_root).join("compile_flags.txt");
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

pub fn configure_cpp_args(exe_dir: &Path, args: &mut Vec<String>) {
    args.push("--query-driver=**".to_string());
    args.push("--background-index".to_string());
    
    let resource_dir_18 = exe_dir.join("lib").join("clang").join("18");
    let resource_dir_18_1_3 = exe_dir.join("lib").join("clang").join("18.1.3");
    if resource_dir_18.exists() {
        args.push(format!("--resource-dir={}", resource_dir_18.to_string_lossy()));
    } else if resource_dir_18_1_3.exists() {
        args.push(format!("--resource-dir={}", resource_dir_18_1_3.to_string_lossy()));
    }
}

pub async fn resolve_lsp_exec_and_args(
    language: &str,
) -> (String, Vec<String>) {
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
            configure_cpp_args(&exe_dir, &mut args);
        } else if language == "python" {
            exec_path = crate::resolve_portable_path(&crate::get_default_python());
            args.push("-m".to_string());
            args.push("pylsp".to_string());
        }
    }
    (exec_path, args)
}

pub async fn get_cpp_extra_path(state: &AppState, args: &mut [String]) -> Option<String> {
    let pool = &state.settings_db;
    let gpp_val = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.gpp_path'")
        .fetch_optional(pool)
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| crate::get_default_gpp());

    let resolved_gpp = crate::resolve_portable_path(&gpp_val);
    let resolved_path = Path::new(&resolved_gpp);

    let mut extra_path = None;
    if let Some(parent) = resolved_path.parent() {
        let parent_str = parent.to_string_lossy();
        if !parent_str.is_empty() && parent_str != "." {
            extra_path = Some(parent_str.to_string());
        }
    }

    if let Some(pos) = args.iter().position(|a| a.starts_with("--query-driver=")) {
        args[pos] = format!("--query-driver={}", resolved_gpp);
    }
    extra_path
}

pub async fn get_lsp_extra_path(language: &str, state: &AppState, args: &mut [String]) -> Option<String> {
    if language == "cpp" {
        get_cpp_extra_path(state, args).await
    } else if language == "python" {
        if let Ok(mut exe_dir) = std::env::current_exe() {
            exe_dir.pop();
            let python_dir = exe_dir.join("python-3.12.7");
            if python_dir.exists() {
                return Some(python_dir.to_string_lossy().to_string());
            }
        }
        None
    } else {
        None
    }
}
