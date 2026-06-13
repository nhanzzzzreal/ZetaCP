// src-tauri/src/commands/testcases.rs

use tauri::{State, AppHandle, Emitter};
use crate::state::AppState;
use crate::errors::ZetaError;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct TestcaseMeta {
    pub id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub name: String,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
    #[serde(rename = "subtaskId")]
    pub subtask_id: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct TestcaseData {
    pub id: String,
    pub input: String,
    #[serde(rename = "expectedOutput")]
    pub expected_output: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct DiffLine {
    pub line: i32,
    pub expected: String,
    pub actual: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct TestcaseResult {
    pub id: String,
    #[serde(rename = "lastStatus")]
    pub last_status: Option<String>,
    #[serde(rename = "execTimeMs")]
    pub exec_time_ms: Option<f64>,
    #[serde(rename = "memoryKb")]
    pub memory_kb: Option<i64>,
    #[serde(rename = "actualOutput")]
    pub actual_output: Option<String>,
    #[serde(rename = "diffInfo")]
    pub diff_info: Option<Vec<DiffLine>>,
    #[serde(rename = "runAt")]
    pub run_at: Option<i64>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Subtask {
    pub id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub name: String,
    #[serde(rename = "maxScore")]
    pub max_score: i32,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, sqlx::FromRow)]
pub struct FileSettings {
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "compilerFlags")]
    pub compiler_flags: String,
    #[serde(rename = "interpreterFlags")]
    pub interpreter_flags: String,
    #[serde(rename = "ioMode")]
    pub io_mode: String,
    #[serde(rename = "inputFile")]
    pub input_file: String,
    #[serde(rename = "outputFile")]
    pub output_file: String,
    #[serde(rename = "timeLimitMs")]
    pub time_limit_ms: i64,
    #[serde(rename = "memoryLimitKb")]
    pub memory_limit_kb: i64,
    #[serde(rename = "runMode")]
    pub run_mode: String,
    #[serde(rename = "checkerType")]
    pub checker_type: String,
    #[serde(rename = "customCheckerPath")]
    pub custom_checker_path: String,
    #[serde(rename = "customCheckerBinary")]
    pub custom_checker_binary: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileContext {
    pub subtasks: Vec<Subtask>,
    pub metas: Vec<TestcaseMeta>,
    pub results: Vec<TestcaseResult>,
    pub settings: FileSettings,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct JudgeProgress {
    #[serde(rename = "testcaseId")]
    pub testcase_id: String,
    pub status: String, // "running" | "done"
    pub result: Option<TestcaseResult>,
}

// Database Row Structs for safe SQLx mapping
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

// 1. Tauri Commands

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

    let subtasks = match &proj_db_opt {
        Some(pool) => {
            let rows = sqlx::query_as::<_, DbSubtaskRow>(
                "SELECT id, file_path, name, max_score, order_index FROM Subtask WHERE file_path = ? ORDER BY order_index ASC"
            )
            .bind(&file_path)
            .fetch_all(pool)
            .await?;
            rows.into_iter().map(Subtask::from).collect()
        }
        None => Vec::new(),
    };

    let metas = match &proj_db_opt {
        Some(pool) => {
            let rows = sqlx::query_as::<_, DbMetaRow>(
                "SELECT id, file_path, name, order_index, subtask_id, is_active FROM TestcaseMeta WHERE file_path = ? ORDER BY order_index ASC"
            )
            .bind(&file_path)
            .fetch_all(pool)
            .await?;
            rows.into_iter().map(TestcaseMeta::from).collect()
        }
        None => Vec::new(),
    };

    let results = match &proj_db_opt {
        Some(pool) => {
            let rows = sqlx::query_as::<_, DbResultRow>(
                "SELECT r.id, r.last_status, r.exec_time_ms, r.memory_kb, r.actual_output, r.diff_info, r.run_at \
                 FROM TestcaseResult r \
                 JOIN TestcaseMeta m ON r.id = m.id \
                 WHERE m.file_path = ?"
            )
            .bind(&file_path)
            .fetch_all(pool)
            .await?;
            rows.into_iter().map(TestcaseResult::from).collect()
        }
        None => Vec::new(),
    };

    let settings = match &proj_db_opt {
        Some(pool) => {
            let row = sqlx::query_as::<_, FileSettings>(
                "SELECT file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file, time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary \
                 FROM FileSettings WHERE file_path = ?"
            )
            .bind(&file_path)
            .fetch_optional(pool)
            .await?;
            row.unwrap_or_else(|| FileSettings {
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
            })
        }
        None => FileSettings {
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
#[allow(clippy::too_many_arguments)]
pub async fn add_testcase(
    id: String,
    file_path: String,
    name: String,
    order_index: i32,
    input: String,
    expected_output: String,
    subtask_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    sqlx::query(
        "INSERT INTO TestcaseMeta (id, file_path, name, order_index, subtask_id, is_active) VALUES (?, ?, ?, ?, ?, 1)"
    )
    .bind(&id)
    .bind(&file_path)
    .bind(&name)
    .bind(order_index)
    .bind(&subtask_id)
    .execute(&proj_db)
    .await?;

    sqlx::query(
        "INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(&input)
    .bind(&expected_output)
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn delete_testcase(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    sqlx::query("DELETE FROM TestcaseMeta WHERE id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn add_subtask(
    id: String,
    file_path: String,
    name: String,
    max_score: i32,
    order_index: i32,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    sqlx::query(
        "INSERT INTO Subtask (id, file_path, name, max_score, order_index) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&file_path)
    .bind(&name)
    .bind(max_score)
    .bind(order_index)
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn delete_subtask(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    sqlx::query("UPDATE TestcaseMeta SET subtask_id = NULL WHERE subtask_id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    sqlx::query("DELETE FROM Subtask WHERE id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn assign_to_subtask(
    file_path: String,
    testcase_id: String,
    subtask_id: Option<String>,
    order_index: i32,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    sqlx::query("UPDATE TestcaseMeta SET subtask_id = ?, order_index = ? WHERE id = ?")
        .bind(&subtask_id)
        .bind(order_index)
        .bind(&testcase_id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn update_testcase_data(
    file_path: String,
    id: String,
    input: String,
    expected_output: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    sqlx::query(
        "INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET input = excluded.input, expected_output = excluded.expected_output"
    )
    .bind(&id)
    .bind(&input)
    .bind(&expected_output)
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_testcase_active(
    file_path: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    sqlx::query("UPDATE TestcaseMeta SET is_active = 1 - is_active WHERE id = ?")
        .bind(&id)
        .execute(&proj_db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn load_file_settings(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<FileSettings, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => {
            // Default file settings when DB does not exist
            return Ok(FileSettings {
                file_path,
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
            });
        }
    };

    let row = sqlx::query_as::<_, FileSettings>(
        "SELECT file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file, time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary \
         FROM FileSettings WHERE file_path = ?"
    )
    .bind(&file_path)
    .fetch_optional(&proj_db)
    .await?;

    match row {
        Some(settings) => Ok(settings),
        None => {
            // Default file settings
            Ok(FileSettings {
                file_path,
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
            })
        }
    }
}

#[tauri::command]
pub async fn save_file_settings(
    settings: FileSettings,
    state: State<'_, AppState>,
    file_path: Option<String>,
) -> Result<(), ZetaError> {
    let fp = file_path.unwrap_or_else(|| settings.file_path.clone());
    let proj_db = state.get_db_pool(&fp, true).await?.unwrap();

    sqlx::query(
        "INSERT INTO FileSettings (file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file, time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
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
            custom_checker_binary = excluded.custom_checker_binary"
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
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn run_testcases(
    file_path: String,
    testcase_ids: Vec<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    // Clean up any remaining zetacp temp directories from previous runs/aborts
    if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("zetacp-") {
                        let _ = std::fs::remove_dir_all(&path);
                    }
                }
            }
        }
    }

    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    let project_root_guard = state.project_root.lock().await;
    let project_root = project_root_guard.as_ref().ok_or_else(|| {
        ZetaError::Fatal("Project root path not set.".to_string())
    })?.clone();

    // Cancel any active judging run
    let mut judge_guard = state.judge_handle.lock().await;
    if let Some(handle) = judge_guard.take() {
        handle.abort();
    }

    // Load file-specific settings or default if not found
    let settings = sqlx::query_as::<_, FileSettings>(
        "SELECT file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file, time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary \
         FROM FileSettings WHERE file_path = ?"
    )
    .bind(&file_path)
    .fetch_optional(&proj_db)
    .await?
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
    });

    // Resolve Executable configuration
    let is_python = file_path.ends_with(".py");
    let (exec_path, args) = if is_python {
        let python_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.python_path'")
            .fetch_optional(&state.settings_db)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "python".to_string());
        
        let full_src_path = std::path::Path::new(&project_root).join(&file_path);
        
        // Add python custom interpreter flags if defined
        let mut python_args = Vec::new();
        if !settings.interpreter_flags.trim().is_empty() {
            for flag in settings.interpreter_flags.split_whitespace() {
                python_args.push(flag.to_string());
            }
        }
        python_args.push(full_src_path.to_string_lossy().to_string());
        (python_path, python_args)
    } else {
        let binary_relative_path: Option<String> = sqlx::query_scalar(
            "SELECT binary_path FROM CompileCache WHERE file_path = ?"
        )
        .bind(&file_path)
        .fetch_optional(&proj_db)
        .await
        .unwrap_or(None);

        match binary_relative_path {
            Some(rel) => {
                let full_bin = std::path::Path::new(&project_root).join(rel);
                if !full_bin.exists() {
                    return Err(ZetaError::InvalidInput {
                        message: "Không tìm thấy file thực thi. Hãy compile lại.".to_string(),
                    });
                }
                (full_bin.to_string_lossy().to_string(), vec![])
            }
            None => return Err(ZetaError::InvalidInput {
                message: "Vui lòng biên dịch (Compile) file nguồn trước khi chạy testcase.".to_string(),
            }),
        }
    };

    // Calculate concurrency
    let concurrency = if settings.run_mode == "parallel" {
        let threads = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'judge.threads'")
            .fetch_optional(&state.settings_db)
            .await
            .unwrap_or(None)
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(4);
        threads
    } else {
        1
    };

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(concurrency));

    // Resolve I/O Filenames for File I/O redirection
    let full_src_path = std::path::Path::new(&project_root).join(&file_path);
    let run_dir = full_src_path.parent().unwrap_or(std::path::Path::new(&project_root)).to_path_buf();
    
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("solution");
    let base_name = if let Some(idx) = file_name.rfind('.') {
        &file_name[..idx]
    } else {
        file_name
    };

    let inp_name = if settings.input_file.is_empty() {
        format!("{}.inp", base_name)
    } else {
        settings.input_file.clone()
    };

    let out_name = if settings.output_file.is_empty() {
        format!("{}.out", base_name)
    } else {
        settings.output_file.clone()
    };

    // Spawn the async judging task
    let app_handle_clone = app_handle.clone();
    let task = tokio::spawn(async move {
        let mut join_handles = Vec::new();

        for tc_id in testcase_ids {
            let sem = semaphore.clone();
            let app_handle_clone = app_handle_clone.clone();
            let proj_db = proj_db.clone();
            let exec_path = exec_path.clone();
            let args = args.clone();
            let settings = settings.clone();
            let run_dir = run_dir.clone();
            let inp_name = inp_name.clone();
            let out_name = out_name.clone();

            let handle = tokio::spawn(async move {
                // Acquire permit from semaphore ( limits parallel concurrency )
                let _permit = sem.acquire().await.unwrap();

                let _ = crate::judge::engine::judge_testcase(
                    &tc_id,
                    &exec_path,
                    &args,
                    &settings,
                    &run_dir,
                    &inp_name,
                    &out_name,
                    &proj_db,
                    &app_handle_clone,
                ).await;
            });

            if concurrency == 1 {
                let _ = handle.await;
            } else {
                join_handles.push(handle);
            }
        }

        if concurrency > 1 {
            for h in join_handles {
                let _ = h.await;
            }
        }
    });

    *judge_guard = Some(task);
    Ok(())
}

#[tauri::command]
pub async fn stop_testcases(
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let mut judge_guard = state.judge_handle.lock().await;
    if let Some(handle) = judge_guard.take() {
        handle.abort();
    }

    // Also perform cleanup of temp directories when aborting
    if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("zetacp-") {
                        let _ = std::fs::remove_dir_all(&path);
                    }
                }
            }
        }
    }

    Ok(())
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct TestcaseImportedPayload {
    pub meta: TestcaseMeta,
    pub result: TestcaseResult,
}

struct TestcasePair {
    name: String,
    input_path: std::path::PathBuf,
    output_path: std::path::PathBuf,
}

fn scan_dir_for_pairs(
    dir: &std::path::Path,
    root_dir: &std::path::Path,
    pairs: &mut Vec<TestcasePair>,
) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut files = Vec::new();
        let mut subdirs = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                subdirs.push(path);
            } else if path.is_file() {
                files.push(path);
            }
        }

        let mut local_pairs = Vec::new();
        let mut inputs = Vec::new();
        let mut outputs = Vec::new();

        for file in &files {
            let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            let file_name = file.file_name().and_then(|f| f.to_str()).unwrap_or("").to_lowercase();
            
            let is_in = ext == "inp" || ext == "in" || (ext == "txt" && (file_name.contains("input") || file_name.contains("inp") || file_name.contains("in")));
            let is_out = ext == "out" || ext == "ans" || (ext == "txt" && (file_name.contains("output") || file_name.contains("out") || file_name.contains("ans") || file_name.contains("result")));
            
            if is_in {
                inputs.push(file.clone());
            } else if is_out {
                outputs.push(file.clone());
            }
        }

        let is_root = dir == root_dir;
        let dir_name = dir.file_name().and_then(|f| f.to_str()).unwrap_or("test").to_string();
        let relative_name = if is_root {
            String::new()
        } else {
            match dir.strip_prefix(root_dir) {
                Ok(rel_path) => {
                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                    if rel_str.is_empty() {
                        dir_name.clone()
                    } else {
                        rel_str
                    }
                }
                Err(_) => dir_name.clone(),
            }
        };

        // Method A: Match by base name
        for inp in &inputs {
            let inp_base = inp.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            for out in &outputs {
                let out_base = out.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                if inp_base == out_base || (inp_base == "input" && out_base == "output") {
                    let tc_name = if is_root {
                        inp.file_stem().and_then(|s| s.to_str()).unwrap_or("test").to_string()
                    } else {
                        relative_name.clone()
                    };

                    local_pairs.push(TestcasePair {
                        name: tc_name,
                        input_path: inp.clone(),
                        output_path: out.clone(),
                    });
                }
            }
        }

        // Method B: Match by single input and single output in directory
        if local_pairs.is_empty() && inputs.len() == 1 && outputs.len() == 1 {
            let tc_name = if is_root {
                inputs[0].file_stem().and_then(|s| s.to_str()).unwrap_or("test").to_string()
            } else {
                relative_name.clone()
            };

            local_pairs.push(TestcasePair {
                name: tc_name,
                input_path: inputs[0].clone(),
                output_path: outputs[0].clone(),
            });
        }

        pairs.extend(local_pairs);

        // Recurse into subdirectories
        for subdir in subdirs {
            scan_dir_for_pairs(&subdir, root_dir, pairs);
        }
    }
}

#[tauri::command]
pub async fn import_testcases_from_folder(
    folder_path: String,
    file_path: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();


    let scan_path = std::path::Path::new(&folder_path);
    if !scan_path.exists() || !scan_path.is_dir() {
        return Err(ZetaError::InvalidInput {
            message: format!("Thư mục import không tồn tại hoặc không hợp lệ: {}", folder_path),
        });
    }

    let mut pairs = Vec::new();
    scan_dir_for_pairs(scan_path, scan_path, &mut pairs);

    // Sort matched pairs by name to import them in a clean order (e.g. test01, test02...)
    pairs.sort_by(|a, b| a.name.cmp(&b.name));

    for pair in pairs {
        // Read inputs and outputs
        let input = std::fs::read_to_string(&pair.input_path)
            .unwrap_or_else(|_| "".to_string());
        let expected = std::fs::read_to_string(&pair.output_path)
            .unwrap_or_else(|_| "".to_string());

        // Generate UUID using SQLite's hex(randomblob(16)) function
        let id: String = sqlx::query_scalar("SELECT lower(hex(randomblob(16)))")
            .fetch_one(&proj_db)
            .await
            .unwrap_or_else(|_| {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos();
                format!("fallback-{}", now)
            });

        // Query current max orderIndex in DB
        let max_order: i32 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(order_index), -1) FROM TestcaseMeta WHERE file_path = ?"
        )
        .bind(&file_path)
        .fetch_one(&proj_db)
        .await
        .unwrap_or(-1);

        let order_index = max_order + 1;

        // Save to SQLite
        sqlx::query(
            "INSERT INTO TestcaseMeta (id, file_path, name, order_index, subtask_id, is_active) VALUES (?, ?, ?, ?, NULL, 1)"
        )
        .bind(&id)
        .bind(&file_path)
        .bind(&pair.name)
        .bind(order_index)
        .execute(&proj_db)
        .await?;

        sqlx::query(
            "INSERT INTO TestcaseData (id, input, expected_output) VALUES (?, ?, ?)"
        )
        .bind(&id)
        .bind(&input)
        .bind(&expected)
        .execute(&proj_db)
        .await?;

        sqlx::query(
            "INSERT INTO TestcaseResult (id, last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at) \
             VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL)"
        )
        .bind(&id)
        .execute(&proj_db)
        .await?;

        let meta = TestcaseMeta {
            id: id.clone(),
            file_path: file_path.clone(),
            name: pair.name.clone(),
            order_index,
            subtask_id: None,
            is_active: true,
        };

        let result = TestcaseResult {
            id,
            last_status: None,
            exec_time_ms: None,
            memory_kb: None,
            actual_output: None,
            diff_info: None,
            run_at: None,
        };

        // Emit event to frontend in real-time
        app_handle.emit("testcase-imported", TestcaseImportedPayload {
            meta,
            result,
        }).ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn compute_diff(
    expected: String,
    actual: String,
) -> Result<Vec<DiffLine>, ZetaError> {
    // Chỉ chuẩn hóa CRLF → LF để hiển thị đúng trong editor.
    // Giữ nguyên toàn bộ raw data còn lại để diff phản ánh đúng output thực tế.
    let expected_clean = expected.replace("\r\n", "\n");
    let actual_clean   = actual.replace("\r\n", "\n");

    // Dùng split('\n') thay vì .lines() vì:
    //   .lines() tự strip trailing newline → "5\n" và "5" trông giống hệt nhau
    //   split('\n') giữ nguyên: "5\n" → ["5", ""] còn "5" → ["5"]
    //   → trailing newline trở thành dòng rỗng "" có thể nhìn thấy trong diff
    let expected_parts: Vec<&str> = expected_clean.split('\n').collect();
    let actual_parts: Vec<&str>   = actual_clean.split('\n').collect();

    // Phân biệt "dòng rỗng tồn tại" vs "dòng không tồn tại" (do một bên ngắn hơn):
    //   - Some("")  → dòng tồn tại, nội dung rỗng (có thể là trailing newline)
    //   - None      → dòng không tồn tại → hiển thị sentinel "\\ No newline at end"
    //     (cùng ký hiệu với git diff)
    const ABSENT: &str = "\\ No newline at end of file";

    let max_lines = expected_parts.len().max(actual_parts.len());
    let mut details = Vec::new();

    for idx in 0..max_lines {
        let exp = match expected_parts.get(idx).copied() {
            Some(s) => s.to_string(),
            None    => ABSENT.to_string(),
        };
        let act = match actual_parts.get(idx).copied() {
            Some(s) => s.to_string(),
            None    => ABSENT.to_string(),
        };
        details.push(DiffLine {
            line: (idx + 1) as i32,
            expected: exp,
            actual:   act,
        });
    }

    Ok(details)
}

#[tauri::command]
pub async fn export_testcases(
    export_dir: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();

    // Determine problem name from file_path
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("solution");
    let base_name = if let Some(idx) = file_name.rfind('.') {
        &file_name[..idx]
    } else {
        file_name
    };

    let target_root = std::path::Path::new(&export_dir).join(base_name);
    if !target_root.exists() {
        std::fs::create_dir_all(&target_root)
            .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục xuất: {}", e)))?;
    }

    // Fetch all testcases for file_path grouped by subtask order then testcase order
    let testcases: Vec<(String, String)> = sqlx::query_as::<_, (String, String)>(
        "SELECT m.id, m.name FROM TestcaseMeta m \
         LEFT JOIN Subtask s ON m.subtask_id = s.id \
         WHERE m.file_path = ? \
         ORDER BY \
            CASE WHEN m.subtask_id IS NULL THEN 1 ELSE 0 END ASC, \
            s.order_index ASC, \
            m.order_index ASC"
    )
    .bind(&file_path)
    .fetch_all(&proj_db)
    .await
    .unwrap_or_default();

    for (idx, (id, _name)) in testcases.iter().enumerate() {
        // Fetch input & expected output data
        let data: Option<(String, String)> = sqlx::query_as::<_, (String, String)>(
            "SELECT input, expected_output FROM TestcaseData WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&proj_db)
        .await
        .unwrap_or(None);

        if let Some((input, expected)) = data {
            // Form folder name: test01, test02, ..., test10
            let folder_name = format!("test{:02}", idx + 1);
            let test_dir = target_root.join(&folder_name);
            std::fs::create_dir_all(&test_dir)
                .map_err(|e| ZetaError::Io(format!("Không thể tạo thư mục con {}: {}", folder_name, e)))?;

            // Write {name}.inp and {name}.out
            let inp_file = test_dir.join(format!("{}.inp", base_name));
            let out_file = test_dir.join(format!("{}.out", base_name));

            std::fs::write(&inp_file, input)
                .map_err(|e| ZetaError::Io(format!("Lỗi ghi file inp: {}", e)))?;
            std::fs::write(&out_file, expected)
                .map_err(|e| ZetaError::Io(format!("Lỗi ghi file out: {}", e)))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn save_testcases_ce(
    file_path: String,
    testcase_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = state.get_db_pool(&file_path, true).await?.unwrap();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    for tc_id in testcase_ids {
        sqlx::query(
            "INSERT INTO TestcaseResult (id, last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at) \
             VALUES (?, 'CE', NULL, NULL, NULL, NULL, ?) \
             ON CONFLICT(id) DO UPDATE SET \
                last_status = 'CE', \
                exec_time_ms = NULL, \
                memory_kb = NULL, \
                actual_output = NULL, \
                diff_info = NULL, \
                run_at = ?"
        )
        .bind(&tc_id)
        .bind(now)
        .bind(now)
        .execute(&proj_db)
        .await?;
    }

    Ok(())
}
