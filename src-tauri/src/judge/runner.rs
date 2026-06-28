// src-tauri/src/judge/runner.rs

use std::path::PathBuf;
use crate::judge::sandbox::{run_in_sandbox, ProcessConfig, ProcessOutput};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RunOptions {
    pub exec_path: String,
    pub args: Vec<String>,
    pub working_dir: PathBuf,
    pub io_mode: String,
    pub input: String,
    pub inp_name: String,
    pub out_name: String,
    pub time_limit_ms: u64,
    pub memory_limit_kb: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RunResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exec_time_ms: f64,
    pub memory_kb: i64,
    pub is_timeout: bool,
    pub verdict: String,
}


/// Resolves the execution verdict based on sandbox output and constraints.
/// If `expected_output` is provided, it also performs output comparison.
pub fn resolve_verdict(
    stdout: &str,
    stderr: &str,
    success: bool,
    is_timeout: bool,
    memory_kb: i64,
    memory_limit_kb: i64,
    expected_output: Option<&str>,
    checker_type: Option<&str>,
) -> String {
    if is_timeout {
        return "TLE".to_string();
    }

    let has_memory_error = {
        let is_mem_err = |text: &str| {
            let t = text.to_lowercase();
            t.contains("bad_alloc")
                || t.contains("std::bad_alloc")
                || t.contains("memoryerror")
                || t.contains("outofmemory")
                || t.contains("out of memory")
                || t.contains("allocation failed")
                || t.contains("quota exceeded")
                || t.contains("memory limit exceeded")
        };
        is_mem_err(stdout) || is_mem_err(stderr)
    };

    if memory_kb >= memory_limit_kb || has_memory_error {
        return "MLE".to_string();
    }

    if !success {
        return "RE".to_string();
    }

    if let Some(expected) = expected_output {
        let checker = checker_type.unwrap_or("diff");
        if crate::judge::diff::compare_outputs(stdout, expected, checker).is_some() {
            return "WA".to_string();
        }
    }

    "AC".to_string()
}

/// Executes a single process in the sandbox using the provided options.
pub async fn execute_once(opts: &RunOptions) -> Result<RunResult, std::io::Error> {
    let p_cfg = ProcessConfig {
        exec_path: &opts.exec_path,
        args: &opts.args,
        working_dir: &opts.working_dir,
        io_mode: &opts.io_mode,
        input: &opts.input,
        inp_name: &opts.inp_name,
        out_name: &opts.out_name,
        time_limit_ms: opts.time_limit_ms,
        memory_limit_kb: opts.memory_limit_kb,
    };

    let p_out = run_in_sandbox(p_cfg).await?;

    let verdict = resolve_verdict(
        &p_out.stdout,
        &p_out.stderr,
        p_out.success,
        p_out.is_timeout,
        p_out.memory_kb,
        opts.memory_limit_kb,
        None,
        None,
    );

    Ok(RunResult {
        success: p_out.success,
        stdout: p_out.stdout,
        stderr: p_out.stderr,
        exec_time_ms: p_out.exec_time_ms,
        memory_kb: p_out.memory_kb,
        is_timeout: p_out.is_timeout,
        verdict,
    })
}

/// Sandboxes a custom checker execution.
pub async fn execute_checker(
    checker_binary: &str,
    checker_type: &str,
    inp_file: &std::path::Path,
    out_file: &std::path::Path,
    ans_file: &std::path::Path,
    data_dir: &std::path::Path,
    work_dir: &std::path::Path,
    time_limit_ms: u64,
    memory_limit_kb: i64,
    python_path: Option<&str>,
) -> Result<ProcessOutput, std::io::Error> {
    let is_python = checker_binary.to_lowercase().ends_with(".py");

    let exec_path;
    let mut args = Vec::new();

    if is_python {
        exec_path = python_path.unwrap_or("python");
        args.push(checker_binary.to_string());
    } else {
        exec_path = checker_binary;
    }

    let input_payload;
    if checker_type == "themis_checker" {
        let data_dir_str = data_dir.to_string_lossy().to_string();
        let work_dir_str = work_dir.to_string_lossy().to_string();
        input_payload = format!("{}\r\n{}\r\n", data_dir_str, work_dir_str);
    } else {
        input_payload = String::new();
        let inp_str = inp_file.to_string_lossy().to_string();
        let out_str = out_file.to_string_lossy().to_string();
        let ans_str = ans_file.to_string_lossy().to_string();
        if checker_type == "cms_checker" {
            args.push(inp_str);
            args.push(ans_str);
            args.push(out_str);
        } else {
            args.push(inp_str);
            args.push(out_str);
            args.push(ans_str);
        }
    }

    let p_cfg = ProcessConfig {
        exec_path,
        args: &args,
        working_dir: work_dir,
        io_mode: "stdio",
        input: &input_payload,
        inp_name: "",
        out_name: "",
        time_limit_ms,
        memory_limit_kb,
    };

    run_in_sandbox(p_cfg).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_verdict_tle() {
        let v = resolve_verdict(
            "output",
            "stderr",
            true,
            true, // is_timeout
            1024,
            256 * 1024,
            None,
            None,
        );
        assert_eq!(v, "TLE");
    }

    #[test]
    fn test_resolve_verdict_mle_by_limit() {
        let v = resolve_verdict(
            "output",
            "stderr",
            true,
            false,
            300 * 1024, // memory_kb
            256 * 1024, // memory_limit_kb
            None,
            None,
        );
        assert_eq!(v, "MLE");
    }

    #[test]
    fn test_resolve_verdict_mle_by_keyword() {
        let keywords = [
            "bad_alloc",
            "std::bad_alloc",
            "memoryerror",
            "outofmemory",
            "out of memory",
            "allocation failed",
            "quota exceeded",
            "memory limit exceeded",
        ];
        for kw in keywords {
            let v = resolve_verdict(
                &format!("some prefix {} suffix", kw),
                "stderr",
                true,
                false,
                1024,
                256 * 1024,
                None,
                None,
            );
            assert_eq!(v, "MLE", "Failed on keyword: {}", kw);

            let v_stderr = resolve_verdict(
                "output",
                &format!("error: {}", kw),
                true,
                false,
                1024,
                256 * 1024,
                None,
                None,
            );
            assert_eq!(v_stderr, "MLE", "Failed on keyword in stderr: {}", kw);
        }
    }

    #[test]
    fn test_resolve_verdict_re() {
        let v = resolve_verdict(
            "output",
            "error message",
            false, // success
            false,
            1024,
            256 * 1024,
            None,
            None,
        );
        assert_eq!(v, "RE");
    }

    #[test]
    fn test_resolve_verdict_ac() {
        let v = resolve_verdict(
            "output\n",
            "stderr",
            true,
            false,
            1024,
            256 * 1024,
            Some("output"),
            None,
        );
        assert_eq!(v, "AC");
    }

    #[test]
    fn test_resolve_verdict_wa() {
        let v = resolve_verdict(
            "different output",
            "stderr",
            true,
            false,
            1024,
            256 * 1024,
            Some("expected output"),
            None,
        );
        assert_eq!(v, "WA");
    }
}
