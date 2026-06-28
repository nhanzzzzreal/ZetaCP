// src-tauri/src/commands/compiler/helper.rs

use std::path::{Path, PathBuf};
use sha2::{Sha256, Digest};
use crate::errors::ZetaError;
use crate::state::AppState;
use super::CompileResult;

pub fn get_file_hash(path: &Path) -> Result<String, std::io::Error> {
    let content = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn check_source_and_type(file_path: &str, root: &Path) -> Result<Option<CompileResult>, ZetaError> {
    let src_path = root.join(file_path);
    if !src_path.exists() {
        return Err(ZetaError::InvalidInput {
            message: format!("Source file not found: {}", file_path),
        });
    }

    if file_path.ends_with(".py") {
        return Ok(Some(CompileResult {
            success: true,
            stderr: String::new(),
            binary_path: file_path.to_string(),
            cached: true,
            compiler_path: String::new(),
        }));
    }

    if !file_path.ends_with(".cpp") {
        return Err(ZetaError::InvalidInput {
            message: "The application only supports compiling .cpp files".to_string(),
        });
    }

    Ok(None)
}

pub async fn get_compiler_path(state: &AppState) -> (String, String) {
    let gpp_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.gpp_path'")
        .fetch_optional(&state.settings_db)
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| crate::get_default_gpp());
    let resolved_gpp = crate::resolve_portable_path(&gpp_path);
    (gpp_path, resolved_gpp)
}

pub async fn query_compile_cache(
    file_path: &str,
    current_hash: &str,
    proj_db: &sqlx::SqlitePool,
    root: &Path,
) -> Result<Option<String>, ZetaError> {
    let cache_query: Option<(String, String)> = sqlx::query_as(
        "SELECT source_hash, binary_path FROM CompileCache WHERE file_path = ?"
    )
    .bind(file_path)
    .fetch_optional(proj_db)
    .await
    .unwrap_or(None);

    if let Some((cached_hash, cached_bin_path)) = cache_query {
        if cached_hash == current_hash && root.join(&cached_bin_path).exists() {
            return Ok(Some(cached_bin_path));
        }
    }
    Ok(None)
}

pub fn get_binary_output_path(file_path: &str, root: &Path) -> Result<(PathBuf, String), ZetaError> {
    let src_path = root.join(file_path);
    let src_parent = src_path.parent().ok_or_else(|| ZetaError::InvalidInput {
        message: format!("Cannot determine parent directory of file: {}", file_path),
    })?;
    let bin_dir = src_parent.join(".ZetaCP");
    if !bin_dir.exists() {
        std::fs::create_dir_all(&bin_dir)
            .map_err(|e| ZetaError::Io(format!("Cannot create directory for binary cache: {}", e)))?;
    }

    let mut hasher = Sha256::new();
    hasher.update(file_path.as_bytes());
    let path_hash = format!("{:x}", hasher.finalize());
    let mut bin_path = bin_dir.join(format!("zetacp_{}", &path_hash[..16]));
    
    #[cfg(target_os = "windows")]
    bin_path.set_extension("exe");

    let rel_bin_path = bin_path.strip_prefix(root)
        .unwrap_or(&bin_path)
        .to_string_lossy()
        .to_string()
        .replace('\\', "/");

    Ok((bin_path, rel_bin_path))
}

pub async fn resolve_compiler_flags(
    file_path: &str,
    flags: Vec<String>,
    proj_db: &sqlx::SqlitePool,
    state: &AppState,
) -> Result<Vec<String>, ZetaError> {
    if !flags.is_empty() {
        return Ok(flags);
    }

    let mut resolved_flags = String::new();
    if let Ok(Some(custom_flags)) = sqlx::query_scalar::<_, String>(
        "SELECT compiler_flags FROM FileSettings WHERE file_path = ?"
    )
    .bind(file_path)
    .fetch_optional(proj_db)
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

    Ok(resolved_flags.split_whitespace().map(|s| s.to_string()).collect())
}

pub async fn save_compile_cache(
    file_path: &str,
    source_hash: &str,
    rel_bin_path: &str,
    proj_db: &sqlx::SqlitePool,
) {
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
    .bind(file_path)
    .bind(source_hash)
    .bind(rel_bin_path)
    .bind(now)
    .execute(proj_db)
    .await
    .ok();
}

pub fn validate_checker(checker_path: &str, checker_type: &str, root: &Path) -> Result<PathBuf, ZetaError> {
    let is_exe = checker_path.to_lowercase().ends_with(".exe");
    if is_exe && checker_type != "themis_checker" {
        return Err(ZetaError::InvalidInput {
            message: "Only Themis Checker accepts .exe files".to_string(),
        });
    }
    let src_path = if Path::new(checker_path).is_absolute() {
        Path::new(checker_path).to_path_buf()
    } else {
        root.join(checker_path)
    };
    Ok(src_path)
}

pub fn prepare_bin_dir(src_path: &Path) -> Result<PathBuf, ZetaError> {
    let parent = src_path.parent().ok_or_else(|| ZetaError::InvalidInput {
        message: format!("Cannot determine parent directory of checker: {:?}", src_path),
    })?;
    let bin_dir = parent.join(".ZetaCP");
    if !bin_dir.exists() {
        std::fs::create_dir_all(&bin_dir)
            .map_err(|e| ZetaError::Io(format!("Cannot create .ZetaCP directory: {}", e)))?;
    }
    Ok(bin_dir)
}

pub async fn compile_cpp_checker(
    src_path: &Path,
    bin_dir: &Path,
    root: &Path,
    state: &AppState,
) -> Result<CompileResult, ZetaError> {
    let mut bin_path = bin_dir.join("custom_checker");
    #[cfg(target_os = "windows")]
    bin_path.set_extension("exe");

    let rel_bin_path = bin_path.strip_prefix(root)
        .unwrap_or(&bin_path)
        .to_string_lossy()
        .to_string()
        .replace('\\', "/");

    let (_gpp_path, resolved_gpp) = get_compiler_path(state).await;
    let resolved_flags = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.default_flags'")
        .fetch_optional(&state.settings_db)
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| "-O2 -std=c++17".to_string());

    let flags = resolved_flags.split_whitespace().map(|s| s.to_string()).collect::<Vec<String>>();

    match crate::judge::compiler::compile_cpp(state, src_path, &bin_path, &flags, false).await {
        Ok(stderr) => Ok(CompileResult { success: true, stderr, binary_path: rel_bin_path, cached: false, compiler_path: resolved_gpp }),
        Err(stderr) => Ok(CompileResult { success: false, stderr, binary_path: String::new(), cached: false, compiler_path: resolved_gpp }),
    }
}

pub async fn copy_non_cpp_checker(
    src_path: &Path,
    bin_dir: &Path,
    root: &Path,
) -> Result<CompileResult, ZetaError> {
    let bin_name = src_path.file_name().ok_or_else(|| ZetaError::InvalidInput {
        message: "Invalid checker file name".to_string(),
    })?;
    let dest_bin_path = bin_dir.join(bin_name);

    if src_path != dest_bin_path {
        std::fs::copy(src_path, &dest_bin_path)
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
        compiler_path: String::new(),
    })
}

pub async fn perform_compilation(
    file_path: &str,
    current_hash: &str,
    flags: Vec<String>,
    proj_db: &sqlx::SqlitePool,
    state: &AppState,
    root: &Path,
) -> Result<CompileResult, ZetaError> {
    let src_path = root.join(file_path);
    let (bin_path, rel_bin_path) = get_binary_output_path(file_path, root)?;
    let resolved_flags = resolve_compiler_flags(file_path, flags, proj_db, state).await?;
    let (_gpp, resolved_gpp) = get_compiler_path(state).await;

    match crate::judge::compiler::compile_cpp(state, &src_path, &bin_path, &resolved_flags, false).await {
        Ok(stderr) => {
            save_compile_cache(file_path, current_hash, &rel_bin_path, proj_db).await;
            Ok(CompileResult {
                success: true,
                stderr,
                binary_path: rel_bin_path,
                cached: false,
                compiler_path: resolved_gpp,
            })
        }
        Err(stderr) => {
            Ok(CompileResult {
                success: false,
                stderr,
                binary_path: String::new(),
                cached: false,
                compiler_path: resolved_gpp,
            })
        }
    }
}
