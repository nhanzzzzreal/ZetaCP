// src-tauri/src/commands/testcases/types.rs

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
    #[serde(rename = "stressBrutePath")]
    pub stress_brute_path: String,
    #[serde(rename = "stressSolPath")]
    pub stress_sol_path: String,
    #[serde(rename = "stressGenPath")]
    pub stress_gen_path: String,
    #[serde(rename = "stressGenMode")]
    pub stress_gen_mode: String,
    #[serde(rename = "stressGenTimeLimitMs")]
    pub stress_gen_time_limit_ms: i64,
    #[serde(rename = "stressGenMemoryLimitKb")]
    pub stress_gen_memory_limit_kb: i64,
    #[serde(rename = "stressBruteTimeLimitMs")]
    pub stress_brute_time_limit_ms: i64,
    #[serde(rename = "stressBruteMemoryLimitKb")]
    pub stress_brute_memory_limit_kb: i64,
    #[serde(rename = "stressTestCount")]
    pub stress_test_count: i64,
    #[serde(rename = "stressStopCondition")]
    pub stress_stop_condition: String,
    #[serde(rename = "stressAutoExport")]
    pub stress_auto_export: bool,
    #[serde(rename = "blocklyWorkspace")]
    pub blockly_workspace: String,
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
pub struct DbMetaRow {
    pub id: String,
    pub file_path: String,
    pub name: String,
    pub order_index: i32,
    pub subtask_id: Option<String>,
    pub is_active: i32,
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
pub struct DbDataRow {
    pub id: String,
    pub input: String,
    pub expected_output: String,
}

#[derive(sqlx::FromRow)]
pub struct DbResultRow {
    pub id: String,
    pub last_status: Option<String>,
    pub exec_time_ms: Option<f64>,
    pub memory_kb: Option<i64>,
    pub actual_output: Option<String>,
    pub diff_info: Option<String>,
    pub run_at: Option<i64>,
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
pub struct DbSubtaskRow {
    pub id: String,
    pub file_path: String,
    pub name: String,
    pub max_score: i32,
    pub order_index: i32,
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

#[derive(Debug, serde::Serialize, Clone)]
pub struct TestcaseImportedPayload {
    pub meta: TestcaseMeta,
    pub result: TestcaseResult,
}
