// src-tauri/src/commands/compiler/commands.rs

use std::path::Path;
use std::process::Command;
use tauri::State;
use crate::errors::ZetaError;
use crate::state::AppState;
use super::helper::*;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CompileResult {
    pub success: bool,
    pub stderr: String,
    #[serde(rename = "binaryPath")]
    pub binary_path: String,
    pub cached: bool,
    #[serde(rename = "compilerPath")]
    pub compiler_path: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CompilerInfo {
    pub found: bool,
    pub path: String,
    pub version: String,
}

fn parse_version_output(stdout: &str, stderr: &str, success: bool) -> String {
    let version_output = if success {
        if !stdout.trim().is_empty() { stdout } else { stderr }
    } else {
        if !stderr.trim().is_empty() { stderr } else { stdout }
    };
    version_output.lines().next().unwrap_or("").trim().to_string()
}

#[tauri::command]
pub async fn check_compiler(compiler: String) -> Result<CompilerInfo, ZetaError> {
    let resolved = crate::resolve_portable_path(&compiler);
    let mut cmd = Command::new(&resolved);
    cmd.arg("--version");
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let first_line = parse_version_output(&stdout, &stderr, out.status.success());
            Ok(CompilerInfo {
                found: true,
                path: resolved,
                version: if first_line.is_empty() { "Compiler found".to_string() } else { first_line },
            })
        }
        Err(_) => Ok(CompilerInfo {
            found: false,
            path: resolved,
            version: "Not found in PATH".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn compile_file(
    file_path: String,
    flags: Vec<String>,
    project_root: String,
    state: State<'_, AppState>,
) -> Result<CompileResult, ZetaError> {
    let root = Path::new(&project_root);
    if let Some(early_res) = check_source_and_type(&file_path, root)? {
        return Ok(early_res);
    }

    let src_path = root.join(&file_path);
    let current_hash = get_file_hash(&src_path)
        .map_err(|e| ZetaError::Io(format!("Error reading source file for hashing: {}", e)))?;

    let (_gpp_path, resolved_gpp) = get_compiler_path(&state).await;
    let proj_db = state.get_db_pool(&src_path.to_string_lossy(), true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    if let Some(cached_bin) = query_compile_cache(&file_path, &current_hash, &proj_db, root).await? {
        return Ok(CompileResult {
            success: true,
            stderr: String::new(),
            binary_path: cached_bin,
            cached: true,
            compiler_path: resolved_gpp,
        });
    }

    perform_compilation(&file_path, &current_hash, flags, &proj_db, &state, root).await
}

#[tauri::command]
pub async fn compile_checker(
    checker_path: String,
    checker_type: String,
    project_root: String,
    state: State<'_, AppState>,
) -> Result<CompileResult, ZetaError> {
    let root = Path::new(&project_root);
    let src_path = validate_checker(&checker_path, &checker_type, root)?;

    if !src_path.exists() {
        return Ok(CompileResult {
            success: false,
            stderr: format!("Checker file not found: {}", checker_path),
            binary_path: String::new(),
            cached: false,
            compiler_path: String::new(),
        });
    }

    let bin_dir = prepare_bin_dir(&src_path)?;

    if checker_path.ends_with(".cpp") {
        compile_cpp_checker(&src_path, &bin_dir, root, &state).await
    } else {
        copy_non_cpp_checker(&src_path, &bin_dir, root).await
    }
}
