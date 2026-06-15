-- Database migration v5 for ZetaCP
-- Create Snippets table
CREATE TABLE IF NOT EXISTS Snippets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger     TEXT NOT NULL,
    description TEXT NOT NULL,
    code        TEXT NOT NULL,
    language    TEXT NOT NULL,
    UNIQUE(trigger, language)
);
