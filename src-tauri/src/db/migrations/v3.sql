-- Database migration v3 for ZetaCP
-- Add checker settings columns to FileSettings table

ALTER TABLE FileSettings ADD COLUMN checker_type TEXT NOT NULL DEFAULT 'ignore_trailing_space';
ALTER TABLE FileSettings ADD COLUMN custom_checker_path TEXT NOT NULL DEFAULT '';
ALTER TABLE FileSettings ADD COLUMN custom_checker_binary TEXT NOT NULL DEFAULT '';
