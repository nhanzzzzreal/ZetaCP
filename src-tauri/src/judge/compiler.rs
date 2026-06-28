// src-tauri/src/judge/compiler.rs

use std::path::Path;
use std::process::Command;
use crate::state::AppState;

pub async fn compile_cpp(
    state: &AppState,
    src_path: &Path,
    bin_path: &Path,
    flags: &[String],
    include_parent: bool,
) -> Result<String, String> {
    // Read compiler path from global settings
    let repo = crate::db::repository::SettingsRepository::new(&state.settings_db);
    let gpp_path = repo.get_gpp_path().await;
    let resolved_gpp = crate::resolve_portable_path(&gpp_path);

    let mut cmd = Command::new(&resolved_gpp);
    
    // Add g++ directory to PATH so it can find cc1plus, as, ld
    if let Some(parent) = Path::new(&resolved_gpp).parent() {
        let mut paths = vec![parent.to_path_buf()];
        if let Ok(current_path) = std::env::var("PATH") {
            paths.extend(std::env::split_paths(&current_path));
        }
        if let Ok(new_path) = std::env::join_paths(paths) {
            cmd.env("PATH", new_path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    for flag in flags {
        cmd.arg(flag);
    }

    if include_parent {
        if let Some(parent) = bin_path.parent() {
            cmd.arg("-I").arg(parent);
        }
    }

    cmd.arg("-o").arg(bin_path).arg(src_path);

    tracing::info!("Compiling C++: {:?}", cmd);
    let output = cmd.output();

    match output {
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stderr)
            } else {
                Err(stderr)
            }
        }
        Err(e) => Err(format!("Cannot invoke compiler '{}': {}", gpp_path, e)),
    }
}
