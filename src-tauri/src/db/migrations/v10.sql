-- Database migration v10 for ZetaCP
-- Add stress testing custom solution path to FileSettings table

ALTER TABLE FileSettings ADD COLUMN stress_sol_path TEXT NOT NULL DEFAULT '';
