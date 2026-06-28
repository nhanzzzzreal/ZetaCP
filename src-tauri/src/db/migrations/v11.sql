-- Database migration v11 for ZetaCP
-- Create the new Runs table as specified in the audit report schema (B.4)

CREATE TABLE IF NOT EXISTS Runs (
    id            TEXT PRIMARY KEY,
    run_type      TEXT NOT NULL,   -- 'testcase_judge' | 'stress_sol' | 'stress_brute' | 'stress_gen' | 'contest'
    parent_id     TEXT,            -- FK to TestcaseMeta.id (for judge) or stress_session_id
    file_path     TEXT NOT NULL,   -- source file related
    verdict       TEXT,            -- 'AC'|'WA'|'TLE'|'MLE'|'RE'|'CE'|'PENDING'
    exec_time_ms  REAL,
    memory_kb     INTEGER,
    actual_output TEXT,            -- nullable, only saved when diff is needed
    diff_info     TEXT,            -- JSON, nullable
    run_at        INTEGER NOT NULL, -- Unix timestamp
    extra_json    TEXT             -- extensible: {"iteration": 5, "gen_seed": 42, ...}
);

CREATE INDEX IF NOT EXISTS idx_runs_parent ON Runs(parent_id);
CREATE INDEX IF NOT EXISTS idx_runs_file_type ON Runs(file_path, run_type, run_at DESC);
