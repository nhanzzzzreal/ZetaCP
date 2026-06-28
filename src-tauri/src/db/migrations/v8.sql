-- Database migration v8 for ZetaCP
-- Add stress testing configuration columns to FileSettings table

ALTER TABLE FileSettings ADD COLUMN stress_brute_path TEXT NOT NULL DEFAULT '';
ALTER TABLE FileSettings ADD COLUMN stress_gen_time_limit_ms INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE FileSettings ADD COLUMN stress_gen_memory_limit_kb INTEGER NOT NULL DEFAULT 262144;
ALTER TABLE FileSettings ADD COLUMN stress_brute_time_limit_ms INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE FileSettings ADD COLUMN stress_brute_memory_limit_kb INTEGER NOT NULL DEFAULT 262144;
