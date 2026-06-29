// src-tauri/src/commands/settings.rs

use tauri::State;
use sqlx::SqlitePool;
use crate::errors::ZetaError;
use crate::state::AppState;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct CompilerSettings {
    #[serde(rename = "gppPath")]
    pub gpp_path: String,
    #[serde(rename = "pythonPath")]
    pub python_path: String,
    #[serde(rename = "defaultFlags")]
    pub default_flags: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct FontSettings {
    pub editor: String,
    pub size: u32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct JudgeSettings {
    pub threads: usize,
    #[serde(rename = "defaultTimeLimitMs")]
    pub default_time_limit_ms: u64,
    #[serde(rename = "defaultMemoryLimitKb")]
    pub default_memory_limit_kb: u64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct DiffSettings {
    pub layout: String, // "horizontal" | "vertical"
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct FileFilterSettings {
    pub show: Vec<String>,
    pub hide: Vec<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PanelLayoutSettings {
    pub right_tabs: Vec<String>,
    pub active_right_tab: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct GlobalSettings {
    pub compiler: CompilerSettings,
    pub theme: String, // "dark" | "light" | "system"
    pub font: FontSettings,
    pub judge: JudgeSettings,
    pub diff: DiffSettings,
    #[serde(rename = "fileFilter")]
    pub file_filter: FileFilterSettings,
    pub shortcuts: std::collections::HashMap<String, String>,
    #[serde(rename = "panelLayout")]
    pub panel_layout: PanelLayoutSettings,
}

async fn get_setting(pool: &SqlitePool, key: &str, default: &str) -> String {
    sqlx::query_scalar("SELECT value FROM Settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| default.to_string())
}

async fn save_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO Settings (key, value) VALUES (?, ?) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn load_settings(state: State<'_, AppState>) -> Result<GlobalSettings, ZetaError> {
    let pool = &state.settings_db;

    let default_gpp = crate::get_default_gpp();
    let default_python = crate::get_default_python();

    let gpp_path = get_setting(pool, "compiler.gpp_path", &default_gpp).await;
    let python_path = get_setting(pool, "compiler.python_path", &default_python).await;
    let default_flags = get_setting(pool, "compiler.default_flags", "-O2 -std=c++17").await;
    let theme = get_setting(pool, "theme", "dark").await;
    let font_editor = get_setting(pool, "font.editor", "Consolas").await;
    let font_size_str = get_setting(pool, "font.size", "14").await;
    let judge_threads_str = get_setting(pool, "judge.threads", "4").await;
    let time_limit_str = get_setting(pool, "judge.default_time_limit_ms", "1000").await;
    let memory_limit_str = get_setting(pool, "judge.default_memory_limit_kb", "262144").await; // 256MB
    let diff_layout = get_setting(pool, "diff.layout", "horizontal").await;
    let filter_show_str = get_setting(pool, "file_filter.show", ".cpp,.py").await;
    let filter_hide_str = get_setting(pool, "file_filter.hide", ".exe,.db,.o").await;
    let shortcuts_str = get_setting(pool, "shortcuts.bindings", "").await;
    let right_tabs_str = get_setting(pool, "panel_layout.right_tabs", "testcase").await;
    let active_right_tab = get_setting(pool, "panel_layout.active_right_tab", "testcase").await;

    let font_size = font_size_str.parse().unwrap_or(14);
    let judge_threads = judge_threads_str.parse().unwrap_or(4);
    let default_time_limit_ms = time_limit_str.parse().unwrap_or(1000);
    let default_memory_limit_kb = memory_limit_str.parse().unwrap_or(262144);

    let show = filter_show_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let hide = filter_hide_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let right_tabs = right_tabs_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();

    let shortcuts: std::collections::HashMap<String, String> = if shortcuts_str.is_empty() {
        let mut default_map = std::collections::HashMap::new();
        default_map.insert("run_tests".to_string(), "f5".to_string());
        default_map.insert("stop_judge".to_string(), "f9".to_string());
        default_map.insert("new_testcase".to_string(), "ctrl+n".to_string());
        default_map.insert("open_settings".to_string(), "ctrl+shift+s".to_string());
        default_map
    } else {
        serde_json::from_str(&shortcuts_str).unwrap_or_else(|_| {
            let mut default_map = std::collections::HashMap::new();
            default_map.insert("run_tests".to_string(), "f5".to_string());
            default_map.insert("stop_judge".to_string(), "f9".to_string());
            default_map.insert("new_testcase".to_string(), "ctrl+n".to_string());
            default_map.insert("open_settings".to_string(), "ctrl+shift+s".to_string());
            default_map
        })
    };

    Ok(GlobalSettings {
        compiler: CompilerSettings {
            gpp_path,
            python_path,
            default_flags,
        },
        theme,
        font: FontSettings {
            editor: font_editor,
            size: font_size,
        },
        judge: JudgeSettings {
            threads: judge_threads,
            default_time_limit_ms,
            default_memory_limit_kb,
        },
        diff: DiffSettings {
            layout: diff_layout,
        },
        file_filter: FileFilterSettings {
            show,
            hide,
        },
        shortcuts,
        panel_layout: PanelLayoutSettings {
            right_tabs,
            active_right_tab,
        },
    })
}

#[tauri::command]
pub async fn save_settings(
    settings: GlobalSettings,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let pool = &state.settings_db;

    save_setting(pool, "compiler.gpp_path", &settings.compiler.gpp_path).await?;
    save_setting(pool, "compiler.python_path", &settings.compiler.python_path).await?;
    save_setting(pool, "compiler.default_flags", &settings.compiler.default_flags).await?;
    save_setting(pool, "theme", &settings.theme).await?;
    save_setting(pool, "font.editor", &settings.font.editor).await?;
    save_setting(pool, "font.size", &settings.font.size.to_string()).await?;
    save_setting(pool, "judge.threads", &settings.judge.threads.to_string()).await?;
    save_setting(pool, "judge.default_time_limit_ms", &settings.judge.default_time_limit_ms.to_string()).await?;
    save_setting(pool, "judge.default_memory_limit_kb", &settings.judge.default_memory_limit_kb.to_string()).await?;
    save_setting(pool, "diff.layout", &settings.diff.layout).await?;

    let show_str = settings.file_filter.show.join(",");
    let hide_str = settings.file_filter.hide.join(",");
    save_setting(pool, "file_filter.show", &show_str).await?;
    save_setting(pool, "file_filter.hide", &hide_str).await?;

    let right_tabs_str = settings.panel_layout.right_tabs.join(",");
    save_setting(pool, "panel_layout.right_tabs", &right_tabs_str).await?;
    save_setting(pool, "panel_layout.active_right_tab", &settings.panel_layout.active_right_tab).await?;

    let shortcuts_json = serde_json::to_string(&settings.shortcuts)
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
    save_setting(pool, "shortcuts.bindings", &shortcuts_json).await?;

    Ok(())
}
