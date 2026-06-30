// src-tauri/src/lib.rs

pub mod errors;
pub mod state;
pub mod db;
pub mod judge;
pub mod commands;

pub fn resolve_portable_path(path_str: &str) -> String {
    let path = std::path::Path::new(path_str);
    if path.is_absolute() {
        return path_str.to_string();
    }

    if path_str == "python" {
        if let Ok(mut exe_dir) = std::env::current_exe() {
            exe_dir.pop();
            let portable = exe_dir.join("python-3.12.7").join("python.exe");
            if portable.exists() {
                return portable.to_string_lossy().to_string();
            }
        }
    }

    if path_str == "g++" {
        if let Ok(mut exe_dir) = std::env::current_exe() {
            exe_dir.pop();
            let portable = exe_dir.join("w64devkit").join("bin").join("g++.exe");
            if portable.exists() {
                return portable.to_string_lossy().to_string();
            }
        }
    }

    if !path_str.contains('/') && !path_str.contains('\\') {
        return path_str.to_string();
    }
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        return exe_dir.join(path).to_string_lossy().to_string();
    }
    path_str.to_string()
}

pub fn get_default_gpp() -> String {
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        if exe_dir.join("w64devkit").join("bin").join("g++.exe").exists() {
            "w64devkit/bin/g++.exe".to_string()
        } else {
            "g++".to_string()
        }
    } else {
        "g++".to_string()
    }
}

pub fn get_default_python() -> String {
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        if exe_dir.join("python-3.12.7").join("python.exe").exists() {
            "python-3.12.7/python.exe".to_string()
        } else {
            "python".to_string()
        }
    } else {
        "python".to_string()
    }
}


use tauri::Manager;
use tokio::sync::Mutex;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .try_init();

    if let Err(e) = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .register_uri_scheme_protocol("docs", crate::commands::docs::docs_protocol_handler)
        .setup(|app| {
            // Xác định đường dẫn file settings DB cạnh .exe
            let mut db_dir = std::env::current_exe()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            db_dir.pop();
            let settings_db_path = db_dir.join("zetacp-settings.db");
            let settings_db_str = settings_db_path.to_string_lossy().to_string();

            // Khởi tạo database settings bất đồng bộ
            let pool = tauri::async_runtime::block_on(async {
                match crate::db::open_db(&settings_db_str).await {
                    Ok(p) => {
                        tracing::info!("Đã mở settings DB thành công tại: {}", settings_db_str);
                        Ok(p)
                    }
                    Err(e) => {
                        tracing::error!("Không thể mở settings DB: {}. Chuyển sang RAM-only DB.", e);
                        // Fallback sang in-memory DB
                        let options = sqlx::sqlite::SqliteConnectOptions::new()
                            .filename(":memory:")
                            .journal_mode(sqlx::sqlite::SqliteJournalMode::Memory)
                            .foreign_keys(true);
                        sqlx::SqlitePool::connect_with(options)
                            .await
                            .map_err(|err| Box::new(err) as Box<dyn std::error::Error>)
                    }
                }
            })?;

            // Đưa AppState vào quản lý của Tauri
            app.manage(AppState {
                settings_db: pool,
                project_dbs: Mutex::new(std::collections::HashMap::new()),
                project_root: Mutex::new(None),
                judge_handle: Mutex::new(None),
                stress_handle: Mutex::new(None),
                file_watcher: Mutex::new(None),
                lsp_instances: Mutex::new(std::collections::HashMap::new()),
                stress_pause_notify: Mutex::new(None),
                stress_paused: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
                stress_cancel: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
                companion_handle: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::commands::settings::load_settings,
            crate::commands::settings::save_settings,
            crate::commands::snippets::load_snippets,
            crate::commands::snippets::save_snippet,
            crate::commands::snippets::delete_snippet,
            crate::commands::file_system::open_project,
            crate::commands::file_system::scan_directory,
            crate::commands::compiler::check_compiler,
            crate::commands::compiler::compile_file,
            crate::commands::compiler::compile_checker,
            crate::commands::file_system::read_text_file,
            crate::commands::file_system::write_text_file,
            crate::commands::file_system::select_project_folder,
            crate::commands::file_system::select_checker_file,
            crate::commands::file_system::create_file,
            crate::commands::file_system::create_directory,
            crate::commands::file_system::rename_item,
            crate::commands::file_system::delete_item,
            crate::commands::file_system::reveal_in_explorer,
            crate::commands::file_system::start_file_watcher,
            crate::commands::file_system::stop_file_watcher,
            crate::commands::session::save_session,
            crate::commands::session::load_session,
            crate::commands::testcases::load_testcase_metas,
            crate::commands::testcases::load_testcase_data,
            crate::commands::testcases::load_testcase_results,
            crate::commands::testcases::load_subtasks,
            crate::commands::testcases::load_file_context,
            crate::commands::testcases::add_testcase,
            crate::commands::testcases::delete_testcase,
            crate::commands::testcases::add_subtask,
            crate::commands::testcases::delete_subtask,
            crate::commands::testcases::assign_to_subtask,
            crate::commands::testcases::update_testcase_data,
            crate::commands::testcases::toggle_testcase_active,
            crate::commands::testcases::run_testcases,
            crate::commands::testcases::stop_testcases,
            crate::commands::testcases::load_file_settings,
            crate::commands::testcases::save_file_settings,
            crate::commands::testcases::save_stress_settings,
            crate::commands::testcases::import_testcases_from_folder,
            crate::commands::testcases::export_testcases,
            crate::commands::testcases::compute_diff,
            crate::commands::testcases::save_testcases_ce,
            crate::commands::overlay::load_overlays,
            crate::commands::overlay::save_overlays,
            crate::commands::overlay::delete_overlay,
            crate::commands::overlay::create_overlay_window,
            crate::commands::overlay::create_diff_window,
            crate::commands::lsp::lsp_initialize,
            crate::commands::lsp::lsp_did_open,
            crate::commands::lsp::lsp_did_change,
            crate::commands::lsp::lsp_get_completions,
            crate::commands::lsp::lsp_get_hover,
            crate::commands::lsp::lsp_get_definition,
            crate::commands::docs::open_docs_window,
            crate::commands::docs::get_docs_path,
            crate::commands::stress_test::run_stress_test,
            crate::commands::stress_test::stop_stress_test,
            crate::commands::stress_test::resume_stress_test,
            crate::commands::stress_test::install_testlib,
            crate::commands::calculator::eval_cp_expr,
            crate::commands::companion::start_companion_listener,
            crate::commands::companion::stop_companion_listener,
            crate::commands::companion::is_companion_listener_running,
            crate::commands::companion::overwrite_testcases
        ])
        .run(tauri::generate_context!())
    {
        tracing::error!("gặp lỗi khi khởi động ứng dụng tauri: {}", e);
        std::process::exit(1);
    }
}
