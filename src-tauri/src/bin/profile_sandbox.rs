// src-tauri/src/bin/profile_sandbox.rs

use std::path::Path;
use std::time::Instant;
use zetacp_lib::judge::sandbox::{run_in_sandbox, ProcessConfig};

#[tokio::main]
async fn main() {
    println!("=== PROFILING RUST SANDBOX EXECUTION ===");

    // Find compiled binary in C:\ZetaCP2\Zexample\.ZetaCP
    let bin_dir = Path::new(r"C:\ZetaCP2\Zexample\.ZetaCP");
    let mut exe_path = None;
    if bin_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(bin_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with("zetacp_") && name.ends_with(".exe") {
                            exe_path = Some(p.to_string_lossy().to_string());
                            break;
                        }
                    }
                }
            }
        }
    }

    let exec = match exe_path {
        Some(path) => path,
        None => {
            println!("No C++ binary found in .ZetaCP directory!");
            return;
        }
    };

    println!("Target executable: {}", exec);

    let working_dir = Path::new(r"C:\ZetaCP2\Zexample");
    let input = "10 20\n";
    let args = vec![];

    let mut times = vec![];
    for i in 1..=10 {
        let cfg = ProcessConfig {
            exec_path: &exec,
            args: &args,
            working_dir,
            io_mode: "stdio",
            input,
            inp_name: "",
            out_name: "",
            time_limit_ms: 1000,
            memory_limit_kb: 262144, // 256MB
        };

        let start = Instant::now();
        let res = run_in_sandbox(cfg).await;
        let elapsed = start.elapsed().as_secs_f64();
        times.push(elapsed);

        match res {
            Ok(out) => {
                println!(
                    "Run #{}: Time: {:.4}s (Sandbox reported time: {:.2}ms, success: {}, stdout: {})",
                    i, elapsed, out.exec_time_ms, out.success, out.stdout.trim()
                );
            }
            Err(e) => {
                println!("Run #{}: Failed to run in sandbox: {}", i, e);
            }
        }
    }

    let avg: f64 = times.iter().sum::<f64>() / times.len() as f64;
    println!("Average run_in_sandbox elapsed time: {:.4}s", avg);
}
