-- Database migration v12 for ZetaCP
-- Split FileSettings into ExecutionConfig and StressConfig tables

-- 1. Create ExecutionConfig table
CREATE TABLE IF NOT EXISTS ExecutionConfig (
    file_path             TEXT PRIMARY KEY,
    compiler_flags        TEXT NOT NULL DEFAULT '-O2 -std=c++17',
    interpreter_flags     TEXT NOT NULL DEFAULT '',
    io_mode               TEXT NOT NULL DEFAULT 'stdio',       -- 'stdio' | 'file'
    input_file            TEXT NOT NULL DEFAULT '',            -- empty means default (basename.inp)
    output_file           TEXT NOT NULL DEFAULT '',            -- empty means default (basename.out)
    time_limit_ms         INTEGER NOT NULL DEFAULT 1000,       -- default: 1s
    memory_limit_kb       INTEGER NOT NULL DEFAULT 262144,     -- default: 256MB
    run_mode              TEXT NOT NULL DEFAULT 'parallel',    -- 'parallel' | 'sequential'
    checker_type          TEXT NOT NULL DEFAULT 'ignore_trailing_space',
    custom_checker_path   TEXT NOT NULL DEFAULT '',
    custom_checker_binary TEXT NOT NULL DEFAULT ''
);

-- 2. Create StressConfig table
CREATE TABLE IF NOT EXISTS StressConfig (
    file_path                     TEXT PRIMARY KEY REFERENCES ExecutionConfig(file_path) ON DELETE CASCADE,
    brute_path                    TEXT NOT NULL DEFAULT '',
    sol_path                      TEXT NOT NULL DEFAULT '',
    gen_path                      TEXT NOT NULL DEFAULT '',
    gen_mode                      TEXT NOT NULL DEFAULT 'blockly',
    gen_time_limit_ms             INTEGER NOT NULL DEFAULT 2000,
    gen_memory_limit_kb           INTEGER NOT NULL DEFAULT 262144,
    brute_time_limit_ms           INTEGER NOT NULL DEFAULT 2000,
    brute_memory_limit_kb         INTEGER NOT NULL DEFAULT 262144
);

-- 3. Backfill data from FileSettings to ExecutionConfig and StressConfig
INSERT OR IGNORE INTO ExecutionConfig (
    file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file,
    time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary
)
SELECT
    file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file,
    time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary
FROM FileSettings;

INSERT OR IGNORE INTO StressConfig (
    file_path, brute_path, sol_path, gen_path, gen_mode,
    gen_time_limit_ms, gen_memory_limit_kb, brute_time_limit_ms, brute_memory_limit_kb
)
SELECT
    file_path, stress_brute_path, stress_sol_path, stress_gen_path, stress_gen_mode,
    stress_gen_time_limit_ms, stress_gen_memory_limit_kb, stress_brute_time_limit_ms, stress_brute_memory_limit_kb
FROM FileSettings;

-- 4. Create Triggers to sync FileSettings to ExecutionConfig and StressConfig (for backward compatibility / rollback capability)
CREATE TRIGGER IF NOT EXISTS file_settings_after_insert
AFTER INSERT ON FileSettings
FOR EACH ROW
BEGIN
    INSERT INTO ExecutionConfig (
        file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file,
        time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary
    ) VALUES (
        NEW.file_path, NEW.compiler_flags, NEW.interpreter_flags, NEW.io_mode, NEW.input_file, NEW.output_file,
        NEW.time_limit_ms, NEW.memory_limit_kb, NEW.run_mode, NEW.checker_type, NEW.custom_checker_path, NEW.custom_checker_binary
    )
    ON CONFLICT(file_path) DO UPDATE SET
        compiler_flags = excluded.compiler_flags,
        interpreter_flags = excluded.interpreter_flags,
        io_mode = excluded.io_mode,
        input_file = excluded.input_file,
        output_file = excluded.output_file,
        time_limit_ms = excluded.time_limit_ms,
        memory_limit_kb = excluded.memory_limit_kb,
        run_mode = excluded.run_mode,
        checker_type = excluded.checker_type,
        custom_checker_path = excluded.custom_checker_path,
        custom_checker_binary = excluded.custom_checker_binary;

    INSERT INTO StressConfig (
        file_path, brute_path, sol_path, gen_path, gen_mode,
        gen_time_limit_ms, gen_memory_limit_kb, brute_time_limit_ms, brute_memory_limit_kb
    ) VALUES (
        NEW.file_path, NEW.stress_brute_path, NEW.stress_sol_path, NEW.stress_gen_path, NEW.stress_gen_mode,
        NEW.stress_gen_time_limit_ms, NEW.stress_gen_memory_limit_kb, NEW.stress_brute_time_limit_ms, NEW.stress_brute_memory_limit_kb
    )
    ON CONFLICT(file_path) DO UPDATE SET
        brute_path = excluded.brute_path,
        sol_path = excluded.sol_path,
        gen_path = excluded.gen_path,
        gen_mode = excluded.gen_mode,
        gen_time_limit_ms = excluded.gen_time_limit_ms,
        gen_memory_limit_kb = excluded.gen_memory_limit_kb,
        brute_time_limit_ms = excluded.brute_time_limit_ms,
        brute_memory_limit_kb = excluded.brute_memory_limit_kb;
END;

CREATE TRIGGER IF NOT EXISTS file_settings_after_update
AFTER UPDATE ON FileSettings
FOR EACH ROW
BEGIN
    INSERT INTO ExecutionConfig (
        file_path, compiler_flags, interpreter_flags, io_mode, input_file, output_file,
        time_limit_ms, memory_limit_kb, run_mode, checker_type, custom_checker_path, custom_checker_binary
    ) VALUES (
        NEW.file_path, NEW.compiler_flags, NEW.interpreter_flags, NEW.io_mode, NEW.input_file, NEW.output_file,
        NEW.time_limit_ms, NEW.memory_limit_kb, NEW.run_mode, NEW.checker_type, NEW.custom_checker_path, NEW.custom_checker_binary
    )
    ON CONFLICT(file_path) DO UPDATE SET
        compiler_flags = excluded.compiler_flags,
        interpreter_flags = excluded.interpreter_flags,
        io_mode = excluded.io_mode,
        input_file = excluded.input_file,
        output_file = excluded.output_file,
        time_limit_ms = excluded.time_limit_ms,
        memory_limit_kb = excluded.memory_limit_kb,
        run_mode = excluded.run_mode,
        checker_type = excluded.checker_type,
        custom_checker_path = excluded.custom_checker_path,
        custom_checker_binary = excluded.custom_checker_binary;

    INSERT INTO StressConfig (
        file_path, brute_path, sol_path, gen_path, gen_mode,
        gen_time_limit_ms, gen_memory_limit_kb, brute_time_limit_ms, brute_memory_limit_kb
    ) VALUES (
        NEW.file_path, NEW.stress_brute_path, NEW.stress_sol_path, NEW.stress_gen_path, NEW.stress_gen_mode,
        NEW.stress_gen_time_limit_ms, NEW.stress_gen_memory_limit_kb, NEW.stress_brute_time_limit_ms, NEW.stress_brute_memory_limit_kb
    )
    ON CONFLICT(file_path) DO UPDATE SET
        brute_path = excluded.brute_path,
        sol_path = excluded.sol_path,
        gen_path = excluded.gen_path,
        gen_mode = excluded.gen_mode,
        gen_time_limit_ms = excluded.gen_time_limit_ms,
        gen_memory_limit_kb = excluded.gen_memory_limit_kb,
        brute_time_limit_ms = excluded.brute_time_limit_ms,
        brute_memory_limit_kb = excluded.brute_memory_limit_kb;
END;

CREATE TRIGGER IF NOT EXISTS file_settings_after_delete
AFTER DELETE ON FileSettings
FOR EACH ROW
BEGIN
    DELETE FROM ExecutionConfig WHERE file_path = OLD.file_path;
    DELETE FROM StressConfig WHERE file_path = OLD.file_path;
END;
