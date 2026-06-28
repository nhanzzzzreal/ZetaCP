// src-tauri/src/judge/engine.rs

use tauri::Emitter;
use crate::errors::ZetaError;
use crate::commands::testcases::{TestcaseResult, FileSettings, JudgeProgress};

pub struct JudgeParams<'a> {
    pub tc_id: &'a str,
    pub exec_path: &'a str,
    pub args: &'a [String],
    pub settings: &'a FileSettings,
    pub run_dir: &'a std::path::Path,
    pub inp_name: &'a str,
    pub out_name: &'a str,
    pub proj_db: &'a sqlx::SqlitePool,
    pub app_handle: &'a tauri::AppHandle,
}

async fn fetch_testcase_data(
    tc_id: &str,
    proj_db: &sqlx::SqlitePool,
) -> (String, String) {
    let data: Option<(String, String)> = sqlx::query_as::<_, (String, String)>(
        "SELECT input, expected_output FROM TestcaseData WHERE id = ?"
    )
    .bind(tc_id)
    .fetch_optional(proj_db)
    .await
    .unwrap_or(None);

    data.unwrap_or_else(|| ("".to_string(), "".to_string()))
}

fn prepare_working_dir(tc_id: &str, io_mode: &str, run_dir: &std::path::Path) -> std::path::PathBuf {
    if io_mode == "file" {
        let u_dir = std::env::temp_dir().join(format!("zetacp-{}", tc_id));
        let _ = std::fs::create_dir_all(&u_dir);
        u_dir
    } else {
        run_dir.to_path_buf()
    }
}

async fn run_sandbox_for_testcase(
    params: &JudgeParams<'_>,
    input: &str,
    working_dir: &std::path::Path,
) -> Result<crate::judge::sandbox::ProcessOutput, ZetaError> {
    let p_cfg = crate::judge::sandbox::ProcessConfig {
        exec_path: params.exec_path,
        args: params.args,
        working_dir,
        io_mode: &params.settings.io_mode,
        input,
        inp_name: params.inp_name,
        out_name: params.out_name,
        time_limit_ms: params.settings.time_limit_ms as u64,
        memory_limit_kb: params.settings.memory_limit_kb,
    };

    crate::judge::sandbox::run_in_sandbox(p_cfg)
        .await
        .map_err(|e| ZetaError::Io(format!("Lỗi khi chạy sandbox: {}", e)))
}

async fn save_testcase_result(
    tc_id: &str,
    verdict: &str,
    details: (&crate::judge::sandbox::ProcessOutput, &str),
    proj_db: &sqlx::SqlitePool,
) {
    let (p_out, actual_output) = details;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    sqlx::query(
        "INSERT INTO TestcaseResult (id, last_status, exec_time_ms, memory_kb, actual_output, diff_info, run_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET \
            last_status = excluded.last_status, \
            exec_time_ms = excluded.exec_time_ms, \
            memory_kb = excluded.memory_kb, \
            actual_output = excluded.actual_output, \
            diff_info = excluded.diff_info, \
            run_at = excluded.run_at"
    )
    .bind(tc_id)
    .bind(verdict)
    .bind(p_out.exec_time_ms)
    .bind(p_out.memory_kb)
    .bind(actual_output)
    .bind(None::<String>)
    .bind(now)
    .execute(proj_db)
    .await
    .ok();
}

async fn execute_and_resolve(
    params: &JudgeParams<'_>,
    working_dir: &std::path::Path,
    data: (&str, &str),
) -> Result<TestcaseResult, ZetaError> {
    let (input, expected) = data;
    let p_out = run_sandbox_for_testcase(params, input, working_dir).await?;

    if params.settings.io_mode == "file" {
        let _ = tokio::fs::remove_dir_all(working_dir).await;
    }

    let v_params = crate::judge::verdict::VerdictParams {
        tc_id: params.tc_id,
        settings: params.settings,
        p_out: &p_out,
        input,
        expected,
        inp_name: params.inp_name,
        out_name: params.out_name,
        actual_output: &p_out.stdout,
        app_handle: params.app_handle,
    };

    let (verdict, actual_output) = crate::judge::verdict::resolve_verdict(v_params).await?;
    save_testcase_result(params.tc_id, &verdict, (&p_out, &actual_output), params.proj_db).await;

    let run_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    Ok(TestcaseResult {
        id: params.tc_id.to_string(),
        last_status: Some(verdict),
        exec_time_ms: Some(p_out.exec_time_ms),
        memory_kb: Some(p_out.memory_kb),
        actual_output: Some(actual_output),
        diff_info: None,
        run_at: Some(run_at),
    })
}

pub async fn judge_testcase(
    params: JudgeParams<'_>,
) -> Result<TestcaseResult, ZetaError> {
    let _ = params.app_handle.emit("judge-progress", JudgeProgress {
        testcase_id: params.tc_id.to_string(),
        status: "running".to_string(),
        result: None,
    });

    let (input, expected) = fetch_testcase_data(params.tc_id, params.proj_db).await;
    let working_dir = prepare_working_dir(params.tc_id, &params.settings.io_mode, params.run_dir);
    let result = execute_and_resolve(&params, &working_dir, (&input, &expected)).await?;

    let _ = params.app_handle.emit("judge-progress", JudgeProgress {
        testcase_id: params.tc_id.to_string(),
        status: "done".to_string(),
        result: Some(result.clone()),
    });

    Ok(result)
}
