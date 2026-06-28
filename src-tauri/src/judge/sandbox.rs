// src-tauri/src/judge/sandbox.rs

use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::process::Command;
use tokio::io::AsyncWriteExt;
use tokio::time::timeout;

#[cfg(target_os = "windows")]
use windows::Win32::System::JobObjects::{
    CreateJobObjectW, AssignProcessToJobObject, SetInformationJobObject, QueryInformationJobObject,
    JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, JOB_OBJECT_LIMIT_PROCESS_MEMORY, JOB_OBJECT_LIMIT_JOB_MEMORY,
};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HANDLE;

#[cfg(target_os = "windows")]
struct SendHandle(HANDLE);
#[cfg(target_os = "windows")]
unsafe impl Send for SendHandle {}
#[cfg(target_os = "windows")]
unsafe impl Sync for SendHandle {}

#[cfg(target_os = "windows")]
impl Drop for SendHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

pub struct ProcessConfig<'a> {
    pub exec_path: &'a str,
    pub args: &'a [String],
    pub working_dir: &'a std::path::Path,
    pub io_mode: &'a str,
    pub input: &'a str,
    pub inp_name: &'a str,
    pub out_name: &'a str,
    pub time_limit_ms: u64,
    pub memory_limit_kb: i64,
}

pub struct ProcessOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exec_time_ms: f64,
    pub memory_kb: i64,
    pub is_timeout: bool,
}

pub async fn run_in_sandbox(cfg: ProcessConfig<'_>) -> Result<ProcessOutput, std::io::Error> {
    let inp_file_path = cfg.working_dir.join(cfg.inp_name);
    let out_file_path = cfg.working_dir.join(cfg.out_name);

    if cfg.io_mode == "file" {
        tokio::fs::write(&inp_file_path, cfg.input).await?;
    }

    // --- Windows Job Object setup ---
    #[cfg(target_os = "windows")]
    let job_handle = unsafe {
        match CreateJobObjectW(None, None) {
            Ok(handle) => {
                let mut limit_info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
                limit_info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

                let is_python_exec = cfg.exec_path.to_lowercase().contains("python");
                if cfg.memory_limit_kb > 0 && !is_python_exec {
                    limit_info.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_JOB_MEMORY;
                    let limit_bytes = cfg.memory_limit_kb as usize * 1024;
                    limit_info.ProcessMemoryLimit = limit_bytes;
                    limit_info.JobMemoryLimit = limit_bytes;
                }

                let set_res = SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &limit_info as *const _ as *const _,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                
                if let Err(e) = set_res {
                    let _ = windows::Win32::Foundation::CloseHandle(handle);
                    return Err(std::io::Error::other(
                        format!("Failed to set Job Object information: {:?}", e)
                    ));
                }
                Some(SendHandle(handle))
            }
            Err(e) => {
                return Err(std::io::Error::other(
                    format!("Failed to create Job Object: {:?}", e)
                ));
            }
        }
    };

    let mut cmd = Command::new(cfg.exec_path);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.kill_on_drop(true);
    cmd.current_dir(cfg.working_dir);
    for arg in cfg.args {
        cmd.arg(arg);
    }

    if cfg.io_mode == "stdio" {
        cmd.stdin(Stdio::piped())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());
    } else {
        cmd.stdin(Stdio::null())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());
    }

    let start_time = Instant::now();
    let mut child = cmd.spawn()?;

    // --- Windows: Assign spawned process to Job Object ---
    #[cfg(target_os = "windows")]
    if let Some(ref sh) = job_handle {
        if let Some(raw_proc_handle) = child.raw_handle() {
            let proc_handle = HANDLE(raw_proc_handle as *mut _);
            unsafe {
                if let Err(e) = AssignProcessToJobObject(sh.0, proc_handle) {
                    let _ = child.kill().await;
                    return Err(std::io::Error::other(
                        format!("Failed to assign process to Job Object: {:?}", e)
                    ));
                }
            }
        }
    }

    if cfg.io_mode == "stdio" {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(cfg.input.as_bytes()).await;
        }
    }

    let wait_result = timeout(Duration::from_millis(cfg.time_limit_ms), child.wait_with_output()).await;
    let exec_time_ms = start_time.elapsed().as_secs_f64() * 1000.0;
    
    // --- Windows: Query memory usage from Job Object ---
    #[cfg(target_os = "windows")]
    let memory_kb = if let Some(ref sh) = job_handle {
        unsafe {
            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            let query_res = QueryInformationJobObject(
                sh.0,
                JobObjectExtendedLimitInformation,
                &mut info as *mut _ as *mut _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                None,
            );
            
            if query_res.is_ok() {
                // PeakJobMemoryUsed is in bytes, convert to KB
                (info.PeakJobMemoryUsed / 1024) as i64
            } else {
                1024
            }
        }
    } else {
        1024
    };

    #[cfg(not(target_os = "windows"))]
    let memory_kb = 1024; // Fallback for non-Windows platforms

    match wait_result {
        Ok(Ok(output)) => {
            let success = output.status.success();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let stdout = if cfg.io_mode == "stdio" {
                String::from_utf8_lossy(&output.stdout).to_string()
            } else {
                if out_file_path.exists() {
                    tokio::fs::read_to_string(&out_file_path).await.unwrap_or_else(|e| {
                        format!("Không thể đọc file output (.out): {}", e)
                    })
                } else {
                    "Không tìm thấy file output sinh ra bởi chương trình (.out)".to_string()
                }
            };

            Ok(ProcessOutput {
                success,
                stdout,
                stderr,
                exec_time_ms,
                memory_kb,
                is_timeout: false,
            })
        }
        Ok(Err(e)) => Err(e),
        Err(_) => {
            Ok(ProcessOutput {
                success: false,
                stdout: String::new(),
                stderr: "Time Limit Exceeded".to_string(),
                exec_time_ms,
                memory_kb,
                is_timeout: true,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[tokio::test]
    async fn test_sandbox_stdio_echo() {
        let temp_dir = env::temp_dir();
        let cmd_name = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
        let args = if cfg!(target_os = "windows") {
            vec!["/C".to_string(), "echo hello".to_string()]
        } else {
            vec!["-c".to_string(), "echo hello".to_string()]
        };

        let cfg = ProcessConfig {
            exec_path: cmd_name,
            args: &args,
            working_dir: &temp_dir,
            io_mode: "stdio",
            input: "",
            inp_name: "",
            out_name: "",
            time_limit_ms: 1000,
            memory_limit_kb: 256 * 1024,
        };

        let output = run_in_sandbox(cfg).await.unwrap();
        assert!(output.success);
        assert!(output.stdout.trim().contains("hello"));
        assert!(!output.is_timeout);
    }
}
