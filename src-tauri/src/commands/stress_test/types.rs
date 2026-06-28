// src-tauri/src/commands/stress_test/types.rs

#[derive(serde::Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "lowercase")]
pub enum StressTestPayload {
    Compiling {
        message: String,
    },
    Progress {
        iteration: i32,
        status: String, // "passed" | "failed"
        input: String,
        #[serde(rename = "solOutput")]
        sol_output: String,
        #[serde(rename = "bruteOutput")]
        brute_output: String,
        verdict: String,
        #[serde(rename = "timeMs")]
        time_ms: f64,
        #[serde(rename = "memoryKb")]
        memory_kb: i64,
    },
    StateUpdate {
        iteration: i32,
        #[serde(rename = "generatorStatus")]
        generator_status: String, // "queue" | "running" | "done"
        #[serde(rename = "solutionStatus")]
        solution_status: String,  // "queue" | "running" | "done"
        #[serde(rename = "bruteStatus")]
        brute_status: String,     // "queue" | "running" | "done"
    },
    Complete {
        message: String,
    },
    Error {
        message: String,
    },
    Paused {
        iteration: i32,
    },
    Resumed {
        iteration: i32,
    },
}
