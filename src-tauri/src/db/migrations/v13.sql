-- Database migration v13 for ZetaCP
-- Add stress test panel settings & canvas workspace JSON persistence to FileSettings and StressConfig

-- 1. Add columns to FileSettings
ALTER TABLE FileSettings ADD COLUMN stress_test_count INTEGER NOT NULL DEFAULT 100;
ALTER TABLE FileSettings ADD COLUMN stress_stop_condition TEXT NOT NULL DEFAULT 'first_error';
ALTER TABLE FileSettings ADD COLUMN stress_auto_export INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FileSettings ADD COLUMN blockly_workspace TEXT NOT NULL DEFAULT '';

-- 2. Add columns to StressConfig
ALTER TABLE StressConfig ADD COLUMN test_count INTEGER NOT NULL DEFAULT 100;
ALTER TABLE StressConfig ADD COLUMN stop_condition TEXT NOT NULL DEFAULT 'first_error';
ALTER TABLE StressConfig ADD COLUMN auto_export INTEGER NOT NULL DEFAULT 0;
ALTER TABLE StressConfig ADD COLUMN blockly_workspace TEXT NOT NULL DEFAULT '';

-- 3. Drop existing triggers and recreate with new columns
DROP TRIGGER IF EXISTS file_settings_after_insert;
DROP TRIGGER IF EXISTS file_settings_after_update;

CREATE TRIGGER file_settings_after_insert
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
        gen_time_limit_ms, gen_memory_limit_kb, brute_time_limit_ms, brute_memory_limit_kb,
        test_count, stop_condition, auto_export, blockly_workspace
    ) VALUES (
        NEW.file_path, NEW.stress_brute_path, NEW.stress_sol_path, NEW.stress_gen_path, NEW.stress_gen_mode,
        NEW.stress_gen_time_limit_ms, NEW.stress_gen_memory_limit_kb, NEW.stress_brute_time_limit_ms, NEW.stress_brute_memory_limit_kb,
        NEW.stress_test_count, NEW.stress_stop_condition, NEW.stress_auto_export, NEW.blockly_workspace
    )
    ON CONFLICT(file_path) DO UPDATE SET
        brute_path = excluded.brute_path,
        sol_path = excluded.sol_path,
        gen_path = excluded.gen_path,
        gen_mode = excluded.gen_mode,
        gen_time_limit_ms = excluded.gen_time_limit_ms,
        gen_memory_limit_kb = excluded.gen_memory_limit_kb,
        brute_time_limit_ms = excluded.brute_time_limit_ms,
        brute_memory_limit_kb = excluded.brute_memory_limit_kb,
        test_count = excluded.test_count,
        stop_condition = excluded.stop_condition,
        auto_export = excluded.auto_export,
        blockly_workspace = excluded.blockly_workspace;
END;

CREATE TRIGGER file_settings_after_update
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
        gen_time_limit_ms, gen_memory_limit_kb, brute_time_limit_ms, brute_memory_limit_kb,
        test_count, stop_condition, auto_export, blockly_workspace
    ) VALUES (
        NEW.file_path, NEW.stress_brute_path, NEW.stress_sol_path, NEW.stress_gen_path, NEW.stress_gen_mode,
        NEW.stress_gen_time_limit_ms, NEW.stress_gen_memory_limit_kb, NEW.stress_brute_time_limit_ms, NEW.stress_brute_memory_limit_kb,
        NEW.stress_test_count, NEW.stress_stop_condition, NEW.stress_auto_export, NEW.blockly_workspace
    )
    ON CONFLICT(file_path) DO UPDATE SET
        brute_path = excluded.brute_path,
        sol_path = excluded.sol_path,
        gen_path = excluded.gen_path,
        gen_mode = excluded.gen_mode,
        gen_time_limit_ms = excluded.gen_time_limit_ms,
        gen_memory_limit_kb = excluded.gen_memory_limit_kb,
        brute_time_limit_ms = excluded.brute_time_limit_ms,
        brute_memory_limit_kb = excluded.brute_memory_limit_kb,
        test_count = excluded.test_count,
        stop_condition = excluded.stop_condition,
        auto_export = excluded.auto_export,
        blockly_workspace = excluded.blockly_workspace;
END;
