// src-tauri/src/judge/verdict.rs

use crate::commands::testcases::FileSettings;
use crate::judge::sandbox::{run_in_sandbox, ProcessConfig, ProcessOutput};
use crate::errors::ZetaError;
use crate::judge::diff::compare_outputs;

pub struct VerdictParams<'a> {
    pub tc_id: &'a str,
    pub settings: &'a FileSettings,
    pub p_out: &'a ProcessOutput,
    pub input: &'a str,
    pub expected: &'a str,
    pub inp_name: &'a str,
    pub out_name: &'a str,
    pub actual_output: &'a str,
    pub app_handle: &'a tauri::AppHandle,
}

fn is_mem_err(text: &str) -> bool {
    let t = text.to_lowercase();
    t.contains("bad_alloc")
        || t.contains("memoryerror")
        || t.contains("out of memory")
        || t.contains("allocation failed")
        || t.contains("quota exceeded")
        || t.contains("memory limit exceeded")
        || t.contains("std::bad_alloc")
}

pub fn has_memory_error(stdout: &str, stderr: &str) -> bool {
    is_mem_err(stdout) || is_mem_err(stderr)
}

pub fn is_custom_checker(checker_type: &str) -> bool {
    matches!(
        checker_type,
        "custom"
            | "themis_checker"
            | "testlib_checker"
            | "cms_checker"
            | "coci_checker"
            | "peg_checker"
            | "dmoj_checker"
    )
}

async fn write_file_silent(path: std::path::PathBuf, content: &str) {
    let _ = tokio::fs::write(path, content).await;
}

async fn setup_checker_variations(
    params: &VerdictParams<'_>,
    data_dir: &std::path::Path,
    work_dir: &std::path::Path,
) {
    let inp_lower = params.inp_name.to_lowercase();
    let inp_upper = params.inp_name.to_uppercase();
    let out_lower = params.out_name.to_lowercase();
    let out_upper = params.out_name.to_uppercase();

    write_file_silent(data_dir.join(&inp_lower), params.input).await;
    write_file_silent(data_dir.join(&inp_upper), params.input).await;
    write_file_silent(data_dir.join(&out_lower), params.expected).await;
    write_file_silent(data_dir.join(&out_upper), params.expected).await;

    write_file_silent(work_dir.join(&out_lower), params.actual_output).await;
    write_file_silent(work_dir.join(&out_upper), params.actual_output).await;

    if let Some(idx) = params.out_name.rfind('.') {
        let base = &params.out_name[..idx];
        write_file_silent(data_dir.join(format!("{}.ans", base.to_lowercase())), params.expected).await;
        write_file_silent(data_dir.join(format!("{}.ANS", base.to_uppercase())), params.expected).await;
    }
}

async fn setup_checker_dir(
    params: &VerdictParams<'_>,
    temp_dir: &std::path::Path,
) -> Result<(), ZetaError> {
    let data_dir = temp_dir.join("data");
    let work_dir = temp_dir.join("work");
    tokio::fs::create_dir_all(&data_dir).await.map_err(|e| ZetaError::Io(e.to_string()))?;
    tokio::fs::create_dir_all(&work_dir).await.map_err(|e| ZetaError::Io(e.to_string()))?;

    write_file_silent(temp_dir.join("input.txt"), params.input).await;
    write_file_silent(temp_dir.join("actual.txt"), params.actual_output).await;
    write_file_silent(temp_dir.join("expected.txt"), params.expected).await;

    write_file_silent(data_dir.join("input.txt"), params.input).await;
    write_file_silent(data_dir.join("expected.txt"), params.expected).await;
    write_file_silent(work_dir.join("output.txt"), params.actual_output).await;

    write_file_silent(data_dir.join(params.inp_name), params.input).await;
    write_file_silent(data_dir.join(params.out_name), params.expected).await;
    write_file_silent(work_dir.join(params.out_name), params.actual_output).await;

    setup_checker_variations(params, &data_dir, &work_dir).await;
    Ok(())
}

async fn run_non_themis_checker(
    params: &VerdictParams<'_>,
    abs_checker: &std::path::Path,
    work_dir: &std::path::Path,
    temp_dir: &std::path::Path,
    state: &crate::state::AppState,
) -> Result<ProcessOutput, ZetaError> {
    let mut checker_args = Vec::new();
    let exec_path = if params.settings.custom_checker_binary.ends_with(".py") {
        let python_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.python_path'")
            .fetch_optional(&state.settings_db)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| crate::get_default_python());
        let resolved_python = crate::resolve_portable_path(&python_path);
        checker_args.push(abs_checker.to_string_lossy().to_string());
        resolved_python
    } else {
        abs_checker.to_string_lossy().to_string()
    };

    let inp_file = temp_dir.join("input.txt").to_string_lossy().to_string();
    let act_file = temp_dir.join("actual.txt").to_string_lossy().to_string();
    let exp_file = temp_dir.join("expected.txt").to_string_lossy().to_string();

    if params.settings.checker_type == "cms_checker" {
        checker_args.extend(vec![inp_file, exp_file, act_file]);
    } else {
        checker_args.extend(vec![inp_file, act_file, exp_file]);
    }

    let cfg = ProcessConfig {
        exec_path: &exec_path,
        args: &checker_args,
        working_dir: work_dir,
        io_mode: "stdio",
        input: "",
        inp_name: "",
        out_name: "",
        time_limit_ms: 10000,
        memory_limit_kb: 256 * 1024,
    };
    run_in_sandbox(cfg).await.map_err(|e| ZetaError::Io(e.to_string()))
}

async fn run_custom_checker(
    params: &VerdictParams<'_>,
    temp_dir: &std::path::Path,
) -> Result<ProcessOutput, ZetaError> {
    use tauri::Manager;
    let state = params.app_handle.state::<crate::state::AppState>();
    let project_root = {
        let guard = state.project_root.lock().await;
        guard.as_ref().cloned().unwrap_or_default()
    };
    let abs_checker = std::path::Path::new(&project_root).join(&params.settings.custom_checker_binary);
    let work_dir = temp_dir.join("work");

    if params.settings.checker_type == "themis_checker" {
        let stdin = format!("{}\r\n{}\r\n", temp_dir.join("data").to_string_lossy(), work_dir.to_string_lossy());
        let cfg = ProcessConfig {
            exec_path: &abs_checker.to_string_lossy(),
            args: &[],
            working_dir: &work_dir,
            io_mode: "stdio",
            input: &stdin,
            inp_name: "",
            out_name: "",
            time_limit_ms: 10000,
            memory_limit_kb: 256 * 1024,
        };
        run_in_sandbox(cfg).await.map_err(|e| ZetaError::Io(e.to_string()))
    } else {
        run_non_themis_checker(params, &abs_checker, &work_dir, temp_dir, &state).await
    }
}

fn parse_themis_score(stdout_str: &str, stderr_str: &str) -> (bool, String) {
    let mut lines: Vec<&str> = stdout_str.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();
    let score_str = lines.pop().unwrap_or("0.0");
    let score = score_str.parse::<f64>().unwrap_or(0.0);
    let ac = score >= 1.0 - 1e-7;
    let feedback = if !lines.is_empty() {
        lines.join("\n")
    } else if !stderr_str.is_empty() {
        stderr_str.to_string()
    } else {
        format!("Điểm số: {}", score)
    };
    (ac, feedback)
}

fn parse_testlib_result(success: bool, stdout_str: &str, stderr_str: &str) -> (bool, String) {
    let feedback = if !stderr_str.is_empty() {
        stderr_str.to_string()
    } else if !stdout_str.is_empty() {
        stdout_str.to_string()
    } else if success {
        "Testlib: Correct".to_string()
    } else {
        "Testlib: Wrong Answer".to_string()
    };
    (success, feedback)
}

fn parse_generic_checker_result(success: bool, stdout_str: &str, stderr_str: &str) -> (bool, String) {
    let feedback = if !stdout_str.is_empty() {
        stdout_str.to_string()
    } else if !stderr_str.is_empty() {
        stderr_str.to_string()
    } else if success {
        "Correct".to_string()
    } else {
        "Wrong Answer".to_string()
    };
    (success, feedback)
}

pub fn parse_checker_output(checker_type: &str, output: &ProcessOutput) -> (bool, String) {
    let stdout_str = output.stdout.trim();
    let stderr_str = output.stderr.trim();
    if checker_type == "themis_checker" {
        parse_themis_score(stdout_str, stderr_str)
    } else if checker_type == "testlib_checker" {
        parse_testlib_result(output.success, stdout_str, stderr_str)
    } else {
        parse_generic_checker_result(output.success, stdout_str, stderr_str)
    }
}

pub async fn evaluate_custom_checker(params: &VerdictParams<'_>) -> Result<(String, String), ZetaError> {
    let temp_dir = std::env::temp_dir().join(format!("zetacp-checker-{}", params.tc_id));
    setup_checker_dir(params, &temp_dir).await?;

    let run_res = run_custom_checker(params, &temp_dir).await;
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    match run_res {
        Ok(output) => {
            let (is_ac, _msg) = parse_checker_output(&params.settings.checker_type, &output);
            let verdict = if is_ac { "AC".to_string() } else { "WA".to_string() };
            Ok((verdict, params.actual_output.to_string()))
        }
        Err(_) => Ok(("WA".to_string(), params.actual_output.to_string())),
    }
}

pub async fn resolve_verdict(params: VerdictParams<'_>) -> Result<(String, String), ZetaError> {
    if params.p_out.is_timeout {
        return Ok(("TLE".to_string(), String::new()));
    }
    if params.p_out.memory_kb >= params.settings.memory_limit_kb || has_memory_error(params.actual_output, &params.p_out.stderr) {
        return Ok(("MLE".to_string(), String::new()));
    }
    if !params.p_out.success {
        return Ok(("RE".to_string(), params.p_out.stderr.clone()));
    }

    if is_custom_checker(&params.settings.checker_type) {
        return evaluate_custom_checker(&params).await;
    }

    let has_diff = compare_outputs(params.actual_output, params.expected, &params.settings.checker_type).is_some();
    let verdict = if has_diff { "WA".to_string() } else { "AC".to_string() };
    Ok((verdict, params.actual_output.to_string()))
}
