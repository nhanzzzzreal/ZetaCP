// src-tauri/src/db/global_repo.rs

use sqlx::SqlitePool;
use crate::errors::ZetaError;

// --- Settings Repository ---
pub struct SettingsRepository<'a> {
    pub pool: &'a SqlitePool,
}

impl<'a> SettingsRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, ZetaError> {
        let val: Option<String> = sqlx::query_scalar("SELECT value FROM Settings WHERE key = ?")
            .bind(key)
            .fetch_optional(self.pool)
            .await?;
        Ok(val)
    }

    pub async fn get_gpp_path(&self) -> String {
        self.get_setting("compiler.gpp_path")
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| crate::get_default_gpp())
    }

    pub async fn get_python_path(&self) -> String {
        self.get_setting("compiler.python_path")
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| crate::get_default_python())
    }

    pub async fn get_default_flags(&self) -> String {
        self.get_setting("compiler.default_flags")
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "-O2 -std=c++17".to_string())
    }

    pub async fn get_judge_threads(&self) -> usize {
        self.get_setting("judge.threads")
            .await
            .unwrap_or(None)
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(4)
    }

    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), ZetaError> {
        sqlx::query("INSERT INTO Settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
            .bind(key)
            .bind(value)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}

// --- Runs Repository ---
pub struct RunRecord {
    pub id: String,
    pub run_type: String,
    pub parent_id: Option<String>,
    pub file_path: String,
    pub verdict: Option<String>,
    pub exec_time_ms: f64,
    pub memory_kb: i64,
    pub actual_output: Option<String>,
    pub diff_info: Option<String>,
    pub run_at: i64,
    pub extra_json: Option<String>,
}

pub struct RunsRepository<'a> {
    pub pool: &'a SqlitePool,
}

impl<'a> RunsRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn insert_run(&self, run: &RunRecord) -> Result<(), ZetaError> {
        sqlx::query(
            "INSERT INTO Runs (id, run_type, parent_id, file_path, verdict, exec_time_ms, memory_kb, actual_output, diff_info, run_at, extra_json) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&run.id)
        .bind(&run.run_type)
        .bind(&run.parent_id)
        .bind(&run.file_path)
        .bind(&run.verdict)
        .bind(run.exec_time_ms)
        .bind(run.memory_kb)
        .bind(&run.actual_output)
        .bind(&run.diff_info)
        .bind(run.run_at)
        .bind(&run.extra_json)
        .execute(self.pool)
        .await?;
        Ok(())
    }
}
