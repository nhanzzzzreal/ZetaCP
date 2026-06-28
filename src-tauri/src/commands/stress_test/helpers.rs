// src-tauri/src/commands/stress_test/helpers.rs

use std::path::Path;
use tauri::Emitter;
use crate::errors::ZetaError;
use super::types::StressTestPayload;

pub async fn resolve_executable(
    proj_db: &sqlx::SqlitePool,
    state: &crate::state::AppState,
    app_handle: &tauri::AppHandle,
    project_root: &str,
    raw_file_path: &str,
) -> Result<(String, Vec<String>), ZetaError> {
    let root_path = Path::new(project_root);
    let src_path_abs = if Path::new(raw_file_path).is_absolute() {
        Path::new(raw_file_path).to_path_buf()
    } else {
        root_path.join(raw_file_path)
    };
    let file_path = match src_path_abs.strip_prefix(root_path) {
        Ok(rel) => rel.to_string_lossy().to_string().replace('\\', "/"),
        Err(_) => raw_file_path.replace('\\', "/"),
    };

    let is_python = file_path.ends_with(".py");
    if is_python {
        let python_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.python_path'")
            .fetch_optional(&state.settings_db)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| crate::get_default_python());
        let resolved_python = crate::resolve_portable_path(&python_path);

        let full_src_path = Path::new(project_root).join(&file_path);
        
        let interpreter_flags: Option<String> = sqlx::query_scalar(
            "SELECT interpreter_flags FROM FileSettings WHERE file_path = ?"
        )
        .bind(&file_path)
        .fetch_optional(proj_db)
        .await
        .unwrap_or(None);

        let mut args = Vec::new();
        if let Some(flags) = interpreter_flags {
            for flag in flags.split_whitespace() {
                args.push(flag.to_string());
            }
        }
        args.push(full_src_path.to_string_lossy().to_string());
        Ok((resolved_python, args))
    } else if file_path.ends_with(".cpp") {
        // Notify compiling status to UI
        let _ = app_handle.emit("stress-test-progress", StressTestPayload::Compiling {
            message: format!("Compiling {}...", file_path.split('/').last().unwrap_or(&file_path)),
        });

        use tauri::Manager;
        let compile_res = crate::commands::compiler::compile_file(
            file_path.clone(),
            vec![], // compile_file will load compiler_flags internally if empty
            project_root.to_string(),
            app_handle.state::<crate::state::AppState>(),
        ).await?;

        if !compile_res.success {
            return Err(ZetaError::Fatal(format!("Lỗi biên dịch cho file {}:\n{}", file_path, compile_res.stderr)));
        }

        let full_bin = Path::new(project_root).join(&compile_res.binary_path);
        Ok((full_bin.to_string_lossy().to_string(), vec![]))
    } else {
        let full_path = Path::new(project_root).join(&file_path);
        if full_path.exists() {
            Ok((full_path.to_string_lossy().to_string(), vec![]))
        } else {
            Err(ZetaError::InvalidInput {
                message: format!("Định dạng file không hỗ trợ hoặc không tìm thấy file: {}", file_path),
            })
        }
    }
}
pub fn normalize_relative_path(root_path: &Path, raw_path: &str) -> String {
    if raw_path.trim().is_empty() {
        return "".to_string();
    }
    let abs_path = if Path::new(raw_path).is_absolute() {
        Path::new(raw_path).to_path_buf()
    } else {
        root_path.join(raw_path)
    };
    match abs_path.strip_prefix(root_path) {
        Ok(rel) => rel.to_string_lossy().to_string().replace('\\', "/"),
        Err(_) => raw_path.replace('\\', "/"),
    }
}


pub async fn download_testlib(zetacp_dir: &std::path::Path) -> Result<std::path::PathBuf, ZetaError> {
    let testlib_path = zetacp_dir.join("testlib.h");
    if !testlib_path.exists() {
        // Try curl first
        let mut curl_cmd = std::process::Command::new("curl");
        curl_cmd.args(&[
            "-L",
            "-s",
            "-o",
            &testlib_path.to_string_lossy(),
            "https://raw.githubusercontent.com/MikeMirzayanov/testlib/master/testlib.h",
        ]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            curl_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let curl_ok = curl_cmd.status().map(|s| s.success()).unwrap_or(false);

        if !curl_ok {
            // Fallback to powershell with TLS 1.2 set explicitly
            let mut powershell_cmd = std::process::Command::new("powershell");
            powershell_cmd.args(&[
                "-NoProfile",
                "-Command",
                &format!(
                    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/MikeMirzayanov/testlib/master/testlib.h' -OutFile '{}'",
                    testlib_path.to_string_lossy()
                )
            ]);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                powershell_cmd.creation_flags(0x08000000);
            }
            let _ = powershell_cmd.output();
        }
    }

    if !testlib_path.exists() {
        return Err(ZetaError::Io(
            "Failed to download testlib.h. Please check your network connection or download it manually into the project folder.".to_string()
        ));
    }
    Ok(testlib_path)
}

use sha2::{Sha256, Digest};

pub async fn resolve_generator(
    state: &crate::state::AppState,
    app_handle: &tauri::AppHandle,
    project_root: &str,
    gen_path: &str,
    gen_lang: &str,
    gen_code: &str,
    zetacp_dir: &std::path::Path,
    temp_dir: &std::path::Path,
    testlib_path: &std::path::Path,
) -> Result<(String, Vec<String>), ZetaError> {
    if !gen_path.trim().is_empty() {
        let proj_db = state.get_db_pool(gen_path, true).await?.ok_or_else(|| {
            ZetaError::Database("Không thể khởi tạo database pool".to_string())
        })?;
        resolve_executable(&proj_db, state, app_handle, project_root, gen_path).await
    } else if gen_lang == "cpp" {
        let mut hasher = Sha256::new();
        hasher.update(gen_code.as_bytes());
        let gen_hash = format!("{:x}", hasher.finalize());

        let cache_dir = zetacp_dir.join("generator_cache");
        if !cache_dir.exists() {
            let _ = std::fs::create_dir_all(&cache_dir);
        }

        let mut bin_path = cache_dir.join(format!("generator_{}", &gen_hash[..16]));
        #[cfg(target_os = "windows")]
        bin_path.set_extension("exe");

        if bin_path.exists() {
            Ok((bin_path.to_string_lossy().to_string(), vec![]))
        } else {
            // Write generator source to cache dir for persistence
            let src_path = cache_dir.join(format!("generator_{}.cpp", &gen_hash[..16]));
            std::fs::write(&src_path, gen_code).map_err(|e| {
                ZetaError::Io(format!("Không thể lưu code sinh bộ test generator.cpp: {}", e))
            })?;

            // Copy testlib.h to cache dir so #include "testlib.h" works
            let cache_testlib = cache_dir.join("testlib.h");
            if !cache_testlib.exists() {
                let _ = std::fs::copy(testlib_path, &cache_testlib);
            }

            // Notify compiling status to UI
            let _ = app_handle.emit("stress-test-progress", StressTestPayload::Compiling {
                message: "Compiling generator.cpp...".to_string(),
            });

            let flags = vec!["-O2".to_string(), "-std=c++17".to_string()];
            crate::judge::compiler::compile_cpp(state, &src_path, &bin_path, &flags, true).await.map_err(|err| {
                ZetaError::Fatal(format!("Không thể compile file sinh test generator.cpp:\n{}", err))
            })?;

            Ok((bin_path.to_string_lossy().to_string(), vec![]))
        }
    } else {
        let src_path = temp_dir.join("generator.py");
        std::fs::write(&src_path, gen_code).map_err(|e| {
            ZetaError::Io(format!("Không thể lưu script sinh bộ test generator.py: {}", e))
        })?;

        let repo = crate::db::repository::SettingsRepository::new(&state.settings_db);
        let python_path = repo.get_python_path().await;
        let resolved_python = crate::resolve_portable_path(&python_path);

        Ok((resolved_python, vec![src_path.to_string_lossy().to_string()]))
    }
}


