-- Database migration v14 for ZetaCP
-- Create CodeforcesConfig table to store Codeforces problem configurations linked to source files

CREATE TABLE IF NOT EXISTS CodeforcesConfig (
    file_path TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    contest_id INTEGER NOT NULL,
    problem_index TEXT NOT NULL,
    problem_url TEXT NOT NULL,
    parsed_data TEXT NOT NULL
);
