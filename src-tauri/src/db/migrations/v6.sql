-- Database migration v6 for ZetaCP
-- Add is_default column to Snippets table
ALTER TABLE Snippets ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
