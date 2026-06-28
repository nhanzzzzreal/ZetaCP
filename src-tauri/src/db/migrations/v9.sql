-- Database migration v9 for ZetaCP
-- Add stress testing custom generator path and mode to FileSettings table

ALTER TABLE FileSettings ADD COLUMN stress_gen_path TEXT NOT NULL DEFAULT '';
ALTER TABLE FileSettings ADD COLUMN stress_gen_mode TEXT NOT NULL DEFAULT 'blockly';
