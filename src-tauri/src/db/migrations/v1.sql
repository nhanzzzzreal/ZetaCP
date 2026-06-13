-- Database schema v1 for ZetaCP settings and project DB

-- 1. Global Settings & Recent Projects (for zetacp-settings.db)
CREATE TABLE IF NOT EXISTS Settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS RecentProjects (
    path       TEXT PRIMARY KEY,
    last_open  INTEGER NOT NULL  -- Unix timestamp
);

-- 2. Project Meta & Data (for ZetaCP.db)
CREATE TABLE IF NOT EXISTS TestcaseMeta (
    id          TEXT PRIMARY KEY,
    file_path   TEXT    NOT NULL,  -- Relative path of the source file (.cpp/.py)
    name        TEXT    NOT NULL,
    order_index INTEGER NOT NULL,
    subtask_id  TEXT,              -- NULL if not in a subtask
    is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_meta_file_order 
    ON TestcaseMeta(file_path, order_index);

CREATE TABLE IF NOT EXISTS TestcaseData (
    id              TEXT PRIMARY KEY REFERENCES TestcaseMeta(id) ON DELETE CASCADE,
    input           TEXT    NOT NULL DEFAULT '',
    expected_output TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS TestcaseResult (
    id             TEXT PRIMARY KEY REFERENCES TestcaseMeta(id) ON DELETE CASCADE,
    last_status    TEXT,     -- 'AC'|'WA'|'TLE'|'MLE'|'RE'|'OLE'|'PENDING'
    exec_time_ms   REAL,
    memory_kb      INTEGER,
    actual_output  TEXT,
    diff_info      TEXT,     -- JSON: [{line, expected, actual}]
    run_at         INTEGER   -- Unix timestamp (NULL = not run yet)
);

CREATE TABLE IF NOT EXISTS Subtask (
    id          TEXT PRIMARY KEY,
    file_path   TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    max_score   INTEGER NOT NULL DEFAULT 100,
    order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS CompileCache (
    file_path    TEXT PRIMARY KEY,  -- Relative path from project root
    source_hash  TEXT NOT NULL,     -- SHA-256 source hash
    binary_path  TEXT NOT NULL,     -- Relative path to compiled binary
    compiled_at  INTEGER NOT NULL   -- Unix timestamp
);

-- Set user version to 1
PRAGMA user_version = 1;
