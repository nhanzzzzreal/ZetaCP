// src-tauri/src/judge/engine.rs

use tauri::Emitter;
use crate::errors::ZetaError;
use crate::commands::testcases::{TestcaseResult, FileSettings, JudgeProgress};
use crate::judge::diff::compare_outputs;
use crate::judge::sandbox::{run_in_sandbox, ProcessConfig};

#[allow(clippy::too_many_arguments)]
pub async fn judge_testcase(
    tc_id: &str,
    exec_path: &str,
    args: &[String],
    settings: &FileSettings,
    run_dir: &std::path::Path,
    inp_name: &str,
    out_name: &str,
    proj_db: &sqlx::SqlitePool,
    app_handle: &tauri::AppHandle,
) -> Result<TestcaseResult, ZetaError> {
    // 1. Emit "running" status progress
    let _ = app_handle.emit("judge-progress", JudgeProgress {
        testcase_id: tc_id.to_string(),
        status: "running".to_string(),
        result: None,
    });

    // 2. Fetch testcase input & expected output
    let data: Option<(String, String)> = sqlx::query_as::<_, (String, String)>(
        "SELECT input, expected_output FROM TestcaseData WHERE id = ?"
    )
    .bind(tc_id)
    .fetch_optional(proj_db)
    .await
    .unwrap_or(None);

    let (input, expected) = data.unwrap_or_else(|| ("".to_string(), "".to_string()));

    // 3. Set up directory
    let working_dir = if settings.io_mode == "file" {
        let u_dir = std::env::temp_dir().join(format!("zetacp-{}", tc_id));
        let _ = tokio::fs::create_dir_all(&u_dir).await;
        u_dir
    } else {
        run_dir.to_path_buf()
    };

    // 4. Run process config
    let p_cfg = ProcessConfig {
        exec_path,
        args,
        working_dir: &working_dir,
        io_mode: &settings.io_mode,
        input: &input,
        inp_name,
        out_name,
        time_limit_ms: settings.time_limit_ms as u64,
        memory_limit_kb: settings.memory_limit_kb,
    };

    let p_out = run_in_sandbox(p_cfg).await.map_err(|e| {
        ZetaError::Io(format!("Lỗi khi chạy sandbox: {}", e))
    })?;

    // 5. Clean up temporary I/O files/directories
    if settings.io_mode == "file" {
        let _ = tokio::fs::remove_dir_all(&working_dir).await;
    }

    // 6. Resolve verdict
    let mut verdict = "AC".to_string();
    let mut actual_output = p_out.stdout;

    let has_memory_error = {
        let is_mem_err = |text: &str| {
            let t = text.to_lowercase();
            t.contains("bad_alloc")
                || t.contains("memoryerror")
                || t.contains("out of memory")
                || t.contains("allocation failed")
                || t.contains("quota exceeded")
                || t.contains("memory limit exceeded")
                || t.contains("std::bad_alloc")
        };
        is_mem_err(&actual_output) || is_mem_err(&p_out.stderr)
    };

    if p_out.is_timeout {
        verdict = "TLE".to_string();
        actual_output = String::new();
    } else if p_out.memory_kb >= settings.memory_limit_kb || has_memory_error {
        verdict = "MLE".to_string();
        actual_output = String::new();
    } else if !p_out.success {
        verdict = "RE".to_string();
        actual_output = p_out.stderr;
    } else if settings.checker_type == "custom"
        || settings.checker_type == "themis_checker"
        || settings.checker_type == "testlib_checker"
        || settings.checker_type == "cms_checker"
        || settings.checker_type == "coci_checker"
        || settings.checker_type == "peg_checker"
        || settings.checker_type == "dmoj_checker"
    {
        // Custom checker evaluation
        let temp_dir = std::env::temp_dir().join(format!("zetacp-checker-{}", tc_id));
        let _ = tokio::fs::create_dir_all(&temp_dir).await;

        // --- Themis C7External checker protocol ---
        // For Themis checkers, we create two separate directories:
        //   data_dir/  - contains the original test data (input.txt, expected.txt)
        //   work_dir/  - acts as the contestant working directory (output.txt = actual output)
        // The checker receives via stdin:
        //   Line 1: UTF-8 encoded path to data_dir
        //   Line 2: UTF-8 encoded path to work_dir
        // And outputs to stdout:
        //   Feedback message (optional lines)
        //   Last line: score (float, 0.0–1.0)
        let data_dir = temp_dir.join("data");
        let work_dir = temp_dir.join("work");
        let _ = tokio::fs::create_dir_all(&data_dir).await;
        let _ = tokio::fs::create_dir_all(&work_dir).await;

        let inp_file = temp_dir.join("input.txt");
        let act_file = temp_dir.join("actual.txt");
        let exp_file = temp_dir.join("expected.txt");
        
        let _ = tokio::fs::write(&inp_file, &input).await;
        let _ = tokio::fs::write(&act_file, &actual_output).await;
        let _ = tokio::fs::write(&exp_file, &expected).await;

        // For Themis, also place files in the protocol directories using standard names
        let _ = tokio::fs::write(data_dir.join("input.txt"), &input).await;
        let _ = tokio::fs::write(data_dir.join("expected.txt"), &expected).await;
        let _ = tokio::fs::write(work_dir.join("output.txt"), &actual_output).await;

        // Write custom setting names (e.g. ABC.inp / ABC.out)
        let _ = tokio::fs::write(data_dir.join(inp_name), &input).await;
        let _ = tokio::fs::write(data_dir.join(out_name), &expected).await;
        let _ = tokio::fs::write(work_dir.join(out_name), &actual_output).await;

        // Write common variations (uppercase/lowercase)
        let inp_lower = inp_name.to_lowercase();
        let inp_upper = inp_name.to_uppercase();
        let out_lower = out_name.to_lowercase();
        let out_upper = out_name.to_uppercase();

        let _ = tokio::fs::write(data_dir.join(&inp_lower), &input).await;
        let _ = tokio::fs::write(data_dir.join(&inp_upper), &input).await;
        let _ = tokio::fs::write(data_dir.join(&out_lower), &expected).await;
        let _ = tokio::fs::write(data_dir.join(&out_upper), &expected).await;

        let _ = tokio::fs::write(work_dir.join(&out_lower), &actual_output).await;
        let _ = tokio::fs::write(work_dir.join(&out_upper), &actual_output).await;

        // Also write .ans and .ANS variations for expected output in data_dir
        if let Some(idx) = out_name.rfind('.') {
            let base = &out_name[..idx];
            let ans_lower = format!("{}.ans", base.to_lowercase());
            let ans_upper = format!("{}.ANS", base.to_uppercase());
            let _ = tokio::fs::write(data_dir.join(&ans_lower), &expected).await;
            let _ = tokio::fs::write(data_dir.join(&ans_upper), &expected).await;
        }
        
        let run_result = {
            use tauri::Manager;
            let state = app_handle.state::<crate::state::AppState>();
            let project_root = {
                let guard = state.project_root.lock().await;
                guard.as_ref().cloned().unwrap_or_default()
            };
            
            let abs_checker_path = std::path::Path::new(&project_root).join(&settings.custom_checker_binary);

            if settings.checker_type == "themis_checker" {
                // Themis C7External protocol: pass two directory paths via stdin
                use tokio::io::AsyncWriteExt;
                use std::process::Stdio;

                let data_dir_str = data_dir.to_string_lossy().to_string();
                let work_dir_str = work_dir.to_string_lossy().to_string();
                let stdin_payload = format!("{}\r\n{}\r\n", data_dir_str, work_dir_str);

                let mut cmd = tokio::process::Command::new(&abs_checker_path);
                #[cfg(target_os = "windows")]
                {
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }
                cmd.stdin(Stdio::piped())
                   .stdout(Stdio::piped())
                   .stderr(Stdio::piped())
                   .current_dir(&work_dir);

                match cmd.spawn() {
                    Ok(mut child) => {
                        if let Some(mut stdin_pipe) = child.stdin.take() {
                            let _ = stdin_pipe.write_all(stdin_payload.as_bytes()).await;
                            drop(stdin_pipe);
                        }
                        child.wait_with_output().await
                    }
                    Err(e) => Err(e),
                }
            } else {
                let mut cmd = if settings.custom_checker_binary.ends_with(".py") {
                    let python_path = sqlx::query_scalar::<_, String>("SELECT value FROM Settings WHERE key = 'compiler.python_path'")
                        .fetch_optional(&state.settings_db)
                        .await
                        .unwrap_or(None)
                        .unwrap_or_else(|| "python".to_string());
                    let mut c = tokio::process::Command::new(python_path);
                    c.arg(&abs_checker_path);
                    c
                } else {
                    tokio::process::Command::new(&abs_checker_path)
                };
                
                #[cfg(target_os = "windows")]
                {
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }
                
                // CMS checker: input, expected, actual
                // Others: input, actual, expected
                if settings.checker_type == "cms_checker" {
                    cmd.arg(&inp_file)
                       .arg(&exp_file)
                       .arg(&act_file);
                } else {
                    cmd.arg(&inp_file)
                       .arg(&act_file)
                       .arg(&exp_file);
                }
                
                cmd.output().await
            }
        };
        
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
        
        match run_result {
            Ok(output) => {
                let stdout_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr_str = String::from_utf8_lossy(&output.stderr).trim().to_string();

                let (is_ac, _msg) = if settings.checker_type == "themis_checker" {
                    // Themis checker: last line of stdout is the score.
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
                        stderr_str
                    } else {
                        format!("Điểm số: {}", score)
                    };
                    (ac, feedback)
                } else if settings.checker_type == "testlib_checker" {
                    // Testlib checker: exit code 0 is AC. Feedback is in stderr
                    let ac = output.status.success();
                    let feedback = if !stderr_str.is_empty() {
                        stderr_str
                    } else if !stdout_str.is_empty() {
                        stdout_str
                    } else if ac {
                        "Testlib: Correct".to_string()
                    } else {
                        "Testlib: Wrong Answer".to_string()
                    };
                    (ac, feedback)
                } else {
                    // CMS, COCI, PEG, DMOJ, Custom: exit code 0 is AC. Feedback is stdout (if not empty) or stderr
                    let ac = output.status.success();
                    let feedback = if !stdout_str.is_empty() {
                        stdout_str
                    } else if !stderr_str.is_empty() {
                        stderr_str
                    } else if ac {
                        "Correct".to_string()
                    } else {
                        "Wrong Answer".to_string()
                    };
                    (ac, feedback)
                };

                if is_ac {
                    verdict = "AC".to_string();
                } else {
                    verdict = "WA".to_string();
                }
            }
            Err(_) => {
                verdict = "WA".to_string();
            }
        }
    } else {
        // Normal evaluation: check output
        if compare_outputs(&actual_output, &expected, &settings.checker_type).is_some() {
            verdict = "WA".to_string();
        }
    }

    // 7. Save results to DB
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
    .bind(&verdict)
    .bind(p_out.exec_time_ms)
    .bind(p_out.memory_kb)
    .bind(&actual_output)
    .bind(None::<String>)
    .bind(now)
    .execute(proj_db)
    .await
    .ok();

    let result = TestcaseResult {
        id: tc_id.to_string(),
        last_status: Some(verdict),
        exec_time_ms: Some(p_out.exec_time_ms),
        memory_kb: Some(p_out.memory_kb),
        actual_output: Some(actual_output),
        diff_info: None,
        run_at: Some(now),
    };

    // 8. Emit "done" status progress
    let _ = app_handle.emit("judge-progress", JudgeProgress {
        testcase_id: tc_id.to_string(),
        status: "done".to_string(),
        result: Some(result.clone()),
    });

    Ok(result)
}
