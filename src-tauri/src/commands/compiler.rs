// src-tauri/src/commands/compiler.rs

use std::path::Path;
use std::process::Command;
use tauri::State;
use sha2::{Sha256, Digest};
use crate::errors::ZetaError;
use crate::state::AppState;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CompileResult {
    pub success: bool,
    pub stderr: String,
    #[serde(rename = "binaryPath")]
    pub binary_path: String, // Relative path to binary
    pub cached: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CompilerInfo {
    pub found: bool,
    pub path: String,
    pub version: String,
}

fn get_file_hash(path: &Path) -> Result<String, std::io::Error> {
    let content = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    Ok(format!("{:x}", hasher.finalize()))
}

#[tauri::command]
pub async fn check_compiler(compiler: String) -> Result<CompilerInfo, ZetaError> {
    let check_arg = "--version";
    let mut cmd = Command::new(&compiler);
    cmd.arg(check_arg);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let output = cmd.output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let version_output = if out.status.success() {
                if !stdout.trim().is_empty() { stdout } else { stderr }
            } else {
                if !stderr.trim().is_empty() { stderr } else { stdout }
            };

            let first_line = version_output.lines().next().unwrap_or("").trim().to_string();
            Ok(CompilerInfo {
                found: true,
                path: compiler,
                version: if first_line.is_empty() { "Compiler found".to_string() } else { first_line },
            })
        }
        Err(_) => {
            Ok(CompilerInfo {
                found: false,
                path: compiler,
                version: "Not found in PATH".to_string(),
            })
        }
    }
}

#[tauri::command]
pub async fn compile_file(
    file_path: String,      // Relative path from project root
    flags: Vec<String>,
    project_root: String,
    state: State<'_, AppState>,
) -> Result<CompileResult, ZetaError> {
    let root = Path::new(&project_root);
    let src_path = root.join(&file_path);

    if !src_path.exists() {
        return Err(ZetaError::InvalidInput {
            message: format!("Source file not found: {}", file_path),
        });
    }

    // If Python file, no compilation needed
    if file_path.ends_with(".py") {
        return Ok(CompileResult {
            success: true,
            stderr: String::new(),
            binary_path: file_path,
            cached: true,
        });
    }

    // Only support C++ (.cpp) compilation
    if !file_path.ends_with(".cpp") {
        return Err(ZetaError::InvalidInput {
            message: "The application only supports compiling .cpp files".to_string(),
        });
    }

    // Calculate SHA-256 hash of the source file
    let current_hash = get_file_hash(&src_path)
        .map_err(|e| ZetaError::Io(format!("Error reading source file for hashing: {}", e)))?;

    // Get current project database from AppState
    let proj_db = state.get_db_pool(&src_path.to_string_lossy(), true).await?.unwrap();

    // 1. Check CompileCache (Cache Hit)
    let cache_query: Option<(String, String)> = sqlx::query_as(
        "SELECT source_hash, binary_path FROM CompileCache WHERE file_path = ?"
    )
    .bind(&file_path)
    .fetch_optional(&proj_db)
    .await
    .unwrap_or(None);

    if let Some((cached_hash, cached_bin_path)) = cache_query {
        if cached_hash == current_hash {
            let full_bin_path = root.join(&cached_bin_path);
            if full_bin_path.exists() {
                tracing::info!("Cache hit for file: {}, using existing binary", file_path);
                return Ok(CompileResult {
                    success: true,
                    stderr: String::new(),
                    binary_path: cached_bin_path,
                    cached: true,
                });
            }
        }
    }

    // 2. Cache Miss -> Perform compilation
    // Read compiler path from global settings
    let gpp_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.gpp_path'")
        .fetch_optional(&state.settings_db)
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| "g++".to_string());

    // Configure output directory in parent directory (.ZetaCP/)
    let src_parent = src_path.parent().ok_or_else(|| ZetaError::InvalidInput {
        message: format!("Cannot determine parent directory of file: {}", file_path),
    })?;
    let bin_dir = src_parent.join(".ZetaCP");
    if !bin_dir.exists() {
        std::fs::create_dir_all(&bin_dir)
            .map_err(|e| ZetaError::Io(format!("Cannot create directory for binary cache: {}", e)))?;
    }

    // Unique binary file name
    let mut hasher = Sha256::new();
    hasher.update(file_path.as_bytes());
    let path_hash = format!("{:x}", hasher.finalize());
    let bin_name = format!("zetacp_{}", &path_hash[..16]);
    let mut bin_path = bin_dir.join(&bin_name);
    
    #[cfg(target_os = "windows")]
    bin_path.set_extension("exe");

    let rel_bin_path = bin_path.strip_prefix(root)
        .unwrap_or(&bin_path)
        .to_string_lossy()
        .to_string()
        .replace('\\', "/");

    // Build compilation command
    let mut cmd = Command::new(&gpp_path);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    // Add compilation flags
    if flags.is_empty() {
        // Read flags from FileSettings or default settings
        let mut resolved_flags = String::new();
        if let Ok(Some(custom_flags)) = sqlx::query_scalar::<_, String>(
            "SELECT compiler_flags FROM FileSettings WHERE file_path = ?"
        )
        .bind(&file_path)
        .fetch_optional(&proj_db)
        .await {
            resolved_flags = custom_flags;
        }

        if resolved_flags.trim().is_empty() {
            resolved_flags = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.default_flags'")
                .fetch_optional(&state.settings_db)
                .await
                .unwrap_or(None)
                .unwrap_or_else(|| "-O2 -std=c++17".to_string());
        }

        for flag in resolved_flags.split_whitespace() {
            cmd.arg(flag);
        }
    } else {
        for flag in flags {
            cmd.arg(flag);
        }
    }

    // Specify source file and output
    cmd.arg("-o").arg(&bin_path).arg(&src_path);

    tracing::info!("Compiling: {:?}", cmd);
    let output = cmd.output();

    match output {
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                // Save compilation result to cache DB
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                sqlx::query(
                    "INSERT INTO CompileCache (file_path, source_hash, binary_path, compiled_at) \
                     VALUES (?, ?, ?, ?) \
                     ON CONFLICT(file_path) DO UPDATE SET \
                        source_hash = excluded.source_hash, \
                        binary_path = excluded.binary_path, \
                        compiled_at = excluded.compiled_at"
                )
                .bind(&file_path)
                .bind(&current_hash)
                .bind(&rel_bin_path)
                .bind(now)
                .execute(&proj_db)
                .await
                .ok(); // Ignore cache write error to let the main thread continue

                Ok(CompileResult {
                    success: true,
                    stderr,
                    binary_path: rel_bin_path,
                    cached: false,
                })
            } else {
                Ok(CompileResult {
                    success: false,
                    stderr,
                    binary_path: String::new(),
                    cached: false,
                })
            }
        }
        Err(e) => {
            Ok(CompileResult {
                success: false,
                stderr: format!("Cannot invoke compiler '{}': {}", gpp_path, e),
                binary_path: String::new(),
                cached: false,
            })
        }
    }
}

#[tauri::command]
pub async fn compile_checker(
    checker_path: String,
    checker_type: String,
    project_root: String,
    state: State<'_, AppState>,
) -> Result<CompileResult, ZetaError> {
    let is_exe = checker_path.to_lowercase().ends_with(".exe");
    if is_exe && checker_type != "themis_checker" {
        return Err(ZetaError::InvalidInput {
            message: "Only Themis Checker accepts .exe files".to_string(),
        });
    }
    let root = Path::new(&project_root);
    let src_path = if Path::new(&checker_path).is_absolute() {
        Path::new(&checker_path).to_path_buf()
    } else {
        root.join(&checker_path)
    };

    if !src_path.exists() {
        return Ok(CompileResult {
            success: false,
            stderr: format!("Checker file not found: {}", checker_path),
            binary_path: String::new(),
            cached: false,
        });
    }

    let parent = src_path.parent().ok_or_else(|| ZetaError::InvalidInput {
        message: format!("Cannot determine parent directory of checker: {}", checker_path),
    })?;
    let bin_dir = parent.join(".ZetaCP");
    if !bin_dir.exists() {
        std::fs::create_dir_all(&bin_dir)
            .map_err(|e| ZetaError::Io(format!("Cannot create .ZetaCP directory: {}", e)))?;
    }

    let is_cpp = checker_path.ends_with(".cpp");

    if is_cpp {
        let mut bin_path = bin_dir.join("custom_checker");
        #[cfg(target_os = "windows")]
        bin_path.set_extension("exe");

        let rel_bin_path = bin_path.strip_prefix(root)
            .unwrap_or(&bin_path)
            .to_string_lossy()
            .to_string()
            .replace('\\', "/");

        let gpp_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.gpp_path'")
            .fetch_optional(&state.settings_db)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "g++".to_string());

        let resolved_flags = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.default_flags'")
            .fetch_optional(&state.settings_db)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "-O2 -std=c++17".to_string());

        let mut cmd = Command::new(&gpp_path);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        for flag in resolved_flags.split_whitespace() {
            cmd.arg(flag);
        }
        cmd.arg("-o").arg(&bin_path).arg(&src_path);

        tracing::info!("Compiling C++ checker: {:?}", cmd);
        let output = cmd.output();

        match output {
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                if out.status.success() {
                    Ok(CompileResult {
                        success: true,
                        stderr,
                        binary_path: rel_bin_path,
                        cached: false,
                    })
                } else {
                    Ok(CompileResult {
                        success: false,
                        stderr,
                        binary_path: String::new(),
                        cached: false,
                    })
                }
            }
            Err(e) => {
                Ok(CompileResult {
                    success: false,
                    stderr: format!("Cannot invoke compiler '{}': {}", gpp_path, e),
                    binary_path: String::new(),
                    cached: false,
                })
            }
        }
    } else {
        // .py or .exe file (or any other file) -> copy to .ZetaCP/
        let bin_name = src_path.file_name().ok_or_else(|| ZetaError::InvalidInput {
            message: "Invalid checker file name".to_string(),
        })?;
        let dest_bin_path = bin_dir.join(bin_name);

        if src_path != dest_bin_path {
            std::fs::copy(&src_path, &dest_bin_path)
                .map_err(|e| ZetaError::Io(format!("Error copying checker: {}", e)))?;
        }

        let rel_bin_path = dest_bin_path.strip_prefix(root)
            .unwrap_or(&dest_bin_path)
            .to_string_lossy()
            .to_string()
            .replace('\\', "/");

        Ok(CompileResult {
            success: true,
            stderr: String::new(),
            binary_path: rel_bin_path,
            cached: false,
        })
    }
}
