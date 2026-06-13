// src-tauri/src/lib.rs

pub mod errors;
pub mod state;
pub mod db;
pub mod judge;
pub mod commands;

use tauri::Manager;
use tokio::sync::Mutex;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
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
                        p
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
                            .expect("Không thể tạo RAM-only DB fallback")
                    }
                }
            });

            // Đưa AppState vào quản lý của Tauri
            app.manage(AppState {
                settings_db: pool,
                project_dbs: Mutex::new(std::collections::HashMap::new()),
                project_root: Mutex::new(None),
                judge_handle: Mutex::new(None),
                file_watcher: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::commands::settings::load_settings,
            crate::commands::settings::save_settings,
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
            crate::commands::testcases::import_testcases_from_folder,
            crate::commands::testcases::export_testcases,
            crate::commands::testcases::compute_diff,
            crate::commands::testcases::save_testcases_ce,
            crate::commands::overlay::load_overlays,
            crate::commands::overlay::save_overlays,
            crate::commands::overlay::delete_overlay,
            crate::commands::overlay::create_overlay_window,
            crate::commands::overlay::create_diff_window
        ])
        .run(tauri::generate_context!())
        .expect("gặp lỗi khi khởi động ứng dụng tauri");
}
