// src-tauri/src/commands/testcases/load.rs

use tauri::State;
use crate::state::AppState;
use crate::errors::ZetaError;
use super::types::{
    TestcaseMeta, TestcaseData, TestcaseResult, Subtask, FileSettings, FileContext,
    DbMetaRow, DbDataRow, DbResultRow, DbSubtaskRow, ExecutionConfig, StressConfig
};

#[tauri::command]
pub async fn load_testcase_metas(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<TestcaseMeta>, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => return Ok(Vec::new()),
    };

    let rows = sqlx::query_as::<_, DbMetaRow>(
        "SELECT id, file_path, name, order_index, subtask_id, is_active FROM TestcaseMeta WHERE file_path = ? ORDER BY order_index ASC"
    )
    .bind(&file_path)
    .fetch_all(&proj_db)
    .await?;

    Ok(rows.into_iter().map(TestcaseMeta::from).collect())
}

#[tauri::command]
pub async fn load_testcase_data(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<TestcaseData, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => return Ok(TestcaseData { id, input: "".to_string(), expected_output: "".to_string() }),
    };

    let row = sqlx::query_as::<_, DbDataRow>(
        "SELECT id, input, expected_output FROM TestcaseData WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&proj_db)
    .await?;

    match row {
        Some(r) => Ok(TestcaseData {
            id: r.id,
            input: r.input,
            expected_output: r.expected_output,
        }),
        None => Ok(TestcaseData {
            id,
            input: "".to_string(),
            expected_output: "".to_string(),
        })
    }
}

#[tauri::command]
pub async fn load_testcase_results(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<TestcaseResult>, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => return Ok(Vec::new()),
    };

    let rows = sqlx::query_as::<_, DbResultRow>(
        "SELECT r.id, r.last_status, r.exec_time_ms, r.memory_kb, r.actual_output, r.diff_info, r.run_at \
         FROM TestcaseResult r \
         JOIN TestcaseMeta m ON r.id = m.id \
         WHERE m.file_path = ?"
    )
    .bind(&file_path)
    .fetch_all(&proj_db)
    .await?;

    Ok(rows.into_iter().map(TestcaseResult::from).collect())
}

#[tauri::command]
pub async fn load_subtasks(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<Subtask>, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => return Ok(Vec::new()),
    };

    let rows = sqlx::query_as::<_, DbSubtaskRow>(
        "SELECT id, file_path, name, max_score, order_index FROM Subtask WHERE file_path = ? ORDER BY order_index ASC"
    )
    .bind(&file_path)
    .fetch_all(&proj_db)
    .await?;

    Ok(rows.into_iter().map(Subtask::from).collect())
}

#[tauri::command]
pub async fn load_file_context(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<FileContext, ZetaError> {
    let proj_db_opt = state.get_db_pool(&file_path, false).await?;

    let (subtasks, metas, results, settings) = match &proj_db_opt {
        Some(pool) => {
            let tc_repo = crate::db::repository::TestcaseRepository::new(pool);
            let config_repo = crate::db::repository::ConfigRepository::new(pool);
            
            // Map types manually to intermediate or use direct repository calls if they match.
            // Wait, does the repository return our original TestcaseMeta/Result/Subtask?
            // Let's verify what types repository returns by looking at how they were converted in original load_file_context.
            // In the original:
            // let subtasks = tc_repo.get_subtasks(&file_path).await?;
            // let metas = tc_repo.get_metas(&file_path).await?;
            // let results = tc_repo.get_results(&file_path).await?;
            // Wait! Since repository uses structs from crate::commands::testcases, let's verify if they match.
            // In mod.rs we will re-export TestcaseMeta, TestcaseResult, Subtask, FileSettings.
            // So if `crate::db::repository` returns those structs, they will be the exact same struct paths.
            // Let's see: standard rust imports will resolve them.
            let subtasks = tc_repo.get_subtasks(&file_path).await?;
            let metas = tc_repo.get_metas(&file_path).await?;
            let results = tc_repo.get_results(&file_path).await?;
            let settings = config_repo.get_file_settings(&file_path).await?
                .unwrap_or_else(|| FileSettings {
                    file_path: file_path.clone(),
                    compiler_flags: "-O2 -std=c++17".to_string(),
                    interpreter_flags: "".to_string(),
                    io_mode: "stdio".to_string(),
                    input_file: "".to_string(),
                    output_file: "".to_string(),
                    time_limit_ms: 1000,
                    memory_limit_kb: 262144, // 256MB
                    run_mode: "parallel".to_string(),
                    checker_type: "ignore_trailing_space".to_string(),
                    custom_checker_path: "".to_string(),
                    custom_checker_binary: "".to_string(),
                    stress_brute_path: "".to_string(),
                    stress_sol_path: "".to_string(),
                    stress_gen_path: "".to_string(),
                    stress_gen_mode: "blockly".to_string(),
                    stress_gen_time_limit_ms: 2000,
                    stress_gen_memory_limit_kb: 262144,
                    stress_brute_time_limit_ms: 2000,
                    stress_brute_memory_limit_kb: 262144,
                    stress_test_count: 100,
                    stress_stop_condition: "first_error".to_string(),
                    stress_auto_export: false,
                    blockly_workspace: "".to_string(),
                });
            (subtasks, metas, results, settings)
        }
        None => {
            let default_settings = FileSettings {
                file_path: file_path.clone(),
                compiler_flags: "-O2 -std=c++17".to_string(),
                interpreter_flags: "".to_string(),
                io_mode: "stdio".to_string(),
                input_file: "".to_string(),
                output_file: "".to_string(),
                time_limit_ms: 1000,
                memory_limit_kb: 262144, // 256MB
                run_mode: "parallel".to_string(),
                checker_type: "ignore_trailing_space".to_string(),
                custom_checker_path: "".to_string(),
                custom_checker_binary: "".to_string(),
                stress_brute_path: "".to_string(),
                stress_sol_path: "".to_string(),
                stress_gen_path: "".to_string(),
                stress_gen_mode: "blockly".to_string(),
                stress_gen_time_limit_ms: 2000,
                stress_gen_memory_limit_kb: 262144,
                stress_brute_time_limit_ms: 2000,
                stress_brute_memory_limit_kb: 262144,
                stress_test_count: 100,
                stress_stop_condition: "first_error".to_string(),
                stress_auto_export: false,
                blockly_workspace: "".to_string(),
            };
            (Vec::new(), Vec::new(), Vec::new(), default_settings)
        }
    };

    Ok(FileContext {
        subtasks,
        metas,
        results,
        settings,
    })
}

#[tauri::command]
pub async fn load_file_settings(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<FileSettings, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => {
            return Ok(FileSettings {
                file_path,
                compiler_flags: "-O2 -std=c++17".to_string(),
                interpreter_flags: "".to_string(),
                io_mode: "stdio".to_string(),
                input_file: "".to_string(),
                output_file: "".to_string(),
                time_limit_ms: 1000,
                memory_limit_kb: 262144,
                run_mode: "parallel".to_string(),
                checker_type: "ignore_trailing_space".to_string(),
                custom_checker_path: "".to_string(),
                custom_checker_binary: "".to_string(),
                stress_brute_path: "".to_string(),
                stress_sol_path: "".to_string(),
                stress_gen_path: "".to_string(),
                stress_gen_mode: "blockly".to_string(),
                stress_gen_time_limit_ms: 2000,
                stress_gen_memory_limit_kb: 262144,
                stress_brute_time_limit_ms: 2000,
                stress_brute_memory_limit_kb: 262144,
                stress_test_count: 100,
                stress_stop_condition: "first_error".to_string(),
                stress_auto_export: false,
                blockly_workspace: "".to_string(),
            });
        }
    };

    let config_repo = crate::db::repository::ConfigRepository::new(&proj_db);
    let row = config_repo.get_file_settings(&file_path).await?;

    match row {
        Some(settings) => Ok(settings),
        None => {
            Ok(FileSettings {
                file_path,
                compiler_flags: "-O2 -std=c++17".to_string(),
                interpreter_flags: "".to_string(),
                io_mode: "stdio".to_string(),
                input_file: "".to_string(),
                output_file: "".to_string(),
                time_limit_ms: 1000,
                memory_limit_kb: 262144,
                run_mode: "parallel".to_string(),
                checker_type: "ignore_trailing_space".to_string(),
                custom_checker_path: "".to_string(),
                custom_checker_binary: "".to_string(),
                stress_brute_path: "".to_string(),
                stress_sol_path: "".to_string(),
                stress_gen_path: "".to_string(),
                stress_gen_mode: "blockly".to_string(),
                stress_gen_time_limit_ms: 2000,
                stress_gen_memory_limit_kb: 262144,
                stress_brute_time_limit_ms: 2000,
                stress_brute_memory_limit_kb: 262144,
                stress_test_count: 100,
                stress_stop_condition: "first_error".to_string(),
                stress_auto_export: false,
                blockly_workspace: "".to_string(),
            })
        }
    }
}

#[tauri::command]
pub async fn save_file_settings(
    settings: ExecutionConfig,
    state: State<'_, AppState>,
    file_path: Option<String>,
) -> Result<(), ZetaError> {
    let fp = file_path.unwrap_or_else(|| settings.file_path.clone());
    let proj_db = state.get_db_pool(&fp, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    let config_repo = crate::db::repository::ConfigRepository::new(&proj_db);
    config_repo.save_file_settings(&settings).await?;
    Ok(())
}

#[tauri::command]
pub async fn save_stress_settings(
    settings: StressConfig,
    state: State<'_, AppState>,
    file_path: Option<String>,
) -> Result<(), ZetaError> {
    let fp = file_path.unwrap_or_else(|| settings.file_path.clone());
    let proj_db = state.get_db_pool(&fp, true).await?.ok_or_else(|| {
        ZetaError::Database("Không thể khởi tạo database pool".to_string())
    })?;

    let config_repo = crate::db::repository::ConfigRepository::new(&proj_db);
    config_repo.save_stress_settings(&settings).await?;
    Ok(())
}

