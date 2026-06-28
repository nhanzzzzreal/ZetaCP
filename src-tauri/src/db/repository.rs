// src-tauri/src/db/repository.rs

use sqlx::SqlitePool;
use crate::errors::ZetaError;
use crate::commands::testcases::{
    FileSettings, TestcaseMeta, TestcaseData, TestcaseResult, Subtask, DiffLine
};

pub use super::global_repo::{SettingsRepository, RunRecord, RunsRepository};

// --- Config Repository ---
pub struct ConfigRepository<'a> {
    pub pool: &'a SqlitePool,
}

impl<'a> ConfigRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_file_settings(&self, file_path: &str) -> Result<Option<FileSettings>, ZetaError> {
        let settings = sqlx::query_as::<_, FileSettings>(
            "SELECT file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file, time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary, \
             stress_brute_path, stress_sol_path, stress_gen_path, stress_gen_mode, stress_gen_time_limit_ms, stress_gen_memory_limit_kb, stress_brute_time_limit_ms, stress_brute_memory_limit_kb, \
             stress_test_count, stress_stop_condition, stress_auto_export, blockly_workspace \
             FROM FileSettings WHERE file_path = ?"
        )
        .bind(file_path)
        .fetch_optional(self.pool)
        .await?;
        Ok(settings)
    }

    pub async fn save_file_settings(&self, settings: &FileSettings) -> Result<(), ZetaError> {
        sqlx::query(
            "INSERT INTO FileSettings (file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file, time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary, \
             stress_brute_path, stress_sol_path, stress_gen_path, stress_gen_mode, stress_gen_time_limit_ms, stress_gen_memory_limit_kb, stress_brute_time_limit_ms, stress_brute_memory_limit_kb, \
             stress_test_count, stress_stop_condition, stress_auto_export, blockly_workspace) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
             ON CONFLICT(file_path) DO UPDATE SET \
                compiler_flags = excluded.compiler_flags, \
                interpreter_flags = excluded.interpreter_flags, \
                io_mode = excluded.io_mode, \
                input_file = excluded.input_file, \
                output_file = excluded.output_file, \
                time_limit_ms = excluded.time_limit_ms, \
                memory_limit_kb = excluded.memory_limit_kb, \
                run_mode = excluded.run_mode, \
                checker_type = excluded.checker_type, \
                custom_checker_path = excluded.custom_checker_path, \
                custom_checker_binary = excluded.custom_checker_binary, \
                stress_brute_path = excluded.stress_brute_path, \
                stress_sol_path = excluded.stress_sol_path, \
                stress_gen_path = excluded.stress_gen_path, \
                stress_gen_mode = excluded.stress_gen_mode, \
                stress_gen_time_limit_ms = excluded.stress_gen_time_limit_ms, \
                stress_gen_memory_limit_kb = excluded.stress_gen_memory_limit_kb, \
                stress_brute_time_limit_ms = excluded.stress_brute_time_limit_ms, \
                stress_brute_memory_limit_kb = excluded.stress_brute_memory_limit_kb, \
                stress_test_count = excluded.stress_test_count, \
                stress_stop_condition = excluded.stress_stop_condition, \
                stress_auto_export = excluded.stress_auto_export, \
                blockly_workspace = excluded.blockly_workspace"
        )
        .bind(&settings.file_path)
        .bind(&settings.compiler_flags)
        .bind(&settings.interpreter_flags)
        .bind(&settings.io_mode)
        .bind(&settings.input_file)
        .bind(&settings.output_file)
        .bind(settings.time_limit_ms)
        .bind(settings.memory_limit_kb)
        .bind(&settings.run_mode)
        .bind(&settings.checker_type)
        .bind(&settings.custom_checker_path)
        .bind(&settings.custom_checker_binary)
        .bind(&settings.stress_brute_path)
        .bind(&settings.stress_sol_path)
        .bind(&settings.stress_gen_path)
        .bind(&settings.stress_gen_mode)
        .bind(settings.stress_gen_time_limit_ms)
        .bind(settings.stress_gen_memory_limit_kb)
        .bind(settings.stress_brute_time_limit_ms)
        .bind(settings.stress_brute_memory_limit_kb)
        .bind(settings.stress_test_count)
        .bind(&settings.stress_stop_condition)
        .bind(settings.stress_auto_export)
        .bind(&settings.blockly_workspace)
        .execute(self.pool)
        .await?;
        Ok(())
    }
}

// --- Testcase Repository ---
#[derive(sqlx::FromRow)]
struct DbMetaRow {
    id: String,
    file_path: String,
    name: String,
    order_index: i32,
    subtask_id: Option<String>,
    is_active: i32,
}

impl From<DbMetaRow> for TestcaseMeta {
    fn from(row: DbMetaRow) -> Self {
        Self {
            id: row.id,
            file_path: row.file_path,
            name: row.name,
            order_index: row.order_index,
            subtask_id: row.subtask_id,
            is_active: row.is_active != 0,
        }
    }
}

#[derive(sqlx::FromRow)]
struct DbDataRow {
    id: String,
    input: String,
    expected_output: String,
}

#[derive(sqlx::FromRow)]
struct DbResultRow {
    id: String,
    last_status: Option<String>,
    exec_time_ms: Option<f64>,
    memory_kb: Option<i64>,
    actual_output: Option<String>,
    diff_info: Option<String>,
    run_at: Option<i64>,
}

impl From<DbResultRow> for TestcaseResult {
    fn from(row: DbResultRow) -> Self {
        let diff_info = row.diff_info.and_then(|json_str| {
            serde_json::from_str::<Vec<DiffLine>>(&json_str).ok()
        });
        Self {
            id: row.id,
            last_status: row.last_status,
            exec_time_ms: row.exec_time_ms,
            memory_kb: row.memory_kb,
            actual_output: row.actual_output,
            diff_info,
            run_at: row.run_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct DbSubtaskRow {
    id: String,
    file_path: String,
    name: String,
    max_score: i32,
    order_index: i32,
}

impl From<DbSubtaskRow> for Subtask {
    fn from(row: DbSubtaskRow) -> Self {
        Self {
            id: row.id,
            file_path: row.file_path,
            name: row.name,
            max_score: row.max_score,
            order_index: row.order_index,
        }
    }
}

pub struct TestcaseRepository<'a> {
    pub pool: &'a SqlitePool,
}

impl<'a> TestcaseRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_metas(&self, file_path: &str) -> Result<Vec<TestcaseMeta>, ZetaError> {
        let rows = sqlx::query_as::<_, DbMetaRow>(
            "SELECT id, file_path, name, order_index, subtask_id, is_active FROM TestcaseMeta WHERE file_path = ? ORDER BY order_index ASC"
        )
        .bind(file_path)
        .fetch_all(self.pool)
        .await?;
        Ok(rows.into_iter().map(TestcaseMeta::from).collect())
    }

    pub async fn get_data(&self, tc_id: &str) -> Result<Option<TestcaseData>, ZetaError> {
        let row = sqlx::query_as::<_, DbDataRow>(
            "SELECT id, input, expected_output FROM TestcaseData WHERE id = ?"
        )
        .bind(tc_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row.map(|r| TestcaseData {
            id: r.id,
            input: r.input,
            expected_output: r.expected_output,
        }))
    }

    pub async fn get_results(&self, file_path: &str) -> Result<Vec<TestcaseResult>, ZetaError> {
        let rows = sqlx::query_as::<_, DbResultRow>(
            "SELECT id, last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at \
             FROM TestcaseResult WHERE id IN (SELECT id FROM TestcaseMeta WHERE file_path = ?)"
        )
        .bind(file_path)
        .fetch_all(self.pool)
        .await?;
        Ok(rows.into_iter().map(TestcaseResult::from).collect())
    }

    pub async fn get_subtasks(&self, file_path: &str) -> Result<Vec<Subtask>, ZetaError> {
        let rows = sqlx::query_as::<_, DbSubtaskRow>(
            "SELECT id, file_path, name, max_score, order_index FROM Subtask WHERE file_path = ? ORDER BY order_index ASC"
        )
        .bind(file_path)
        .fetch_all(self.pool)
        .await?;
        Ok(rows.into_iter().map(Subtask::from).collect())
    }
}
