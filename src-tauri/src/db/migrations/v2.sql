-- Database migration v2 for ZetaCP
-- Create FileSettings table to store per-file options

CREATE TABLE IF NOT EXISTS FileSettings (
    file_path         TEXT PRIMARY KEY,
    compiler_flags    TEXT NOT NULL DEFAULT '-O2 -std=c++17',
    interpreter_flags TEXT NOT NULL DEFAULT '',
    io_mode           TEXT NOT NULL DEFAULT 'stdio',       -- 'stdio' | 'file'
    input_file        TEXT NOT NULL DEFAULT '',            -- empty means default (basename.inp)
    output_file       TEXT NOT NULL DEFAULT '',            -- empty means default (basename.out)
    time_limit_ms     INTEGER NOT NULL DEFAULT 1000,       -- default: 1s
    memory_limit_kb   INTEGER NOT NULL DEFAULT 262144,     -- default: 256MB
    run_mode          TEXT NOT NULL DEFAULT 'parallel'     -- 'parallel' | 'sequential'
);
