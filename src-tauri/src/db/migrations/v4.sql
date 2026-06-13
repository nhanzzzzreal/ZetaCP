-- Database migration v4 for ZetaCP
-- Create OverlayState table

CREATE TABLE IF NOT EXISTS OverlayState (
    id             TEXT PRIMARY KEY,
    file_path      TEXT NOT NULL,
    type           TEXT NOT NULL,
    title          TEXT NOT NULL,
    content        TEXT NOT NULL DEFAULT '',
    x              REAL NOT NULL DEFAULT 100.0,
    y              REAL NOT NULL DEFAULT 100.0,
    width          REAL NOT NULL DEFAULT 400.0,
    height         REAL NOT NULL DEFAULT 300.0,
    is_minimized   INTEGER NOT NULL DEFAULT 0,
    is_pinned      INTEGER NOT NULL DEFAULT 0,
    opacity        REAL NOT NULL DEFAULT 1.0,
    is_visible     INTEGER NOT NULL DEFAULT 1,
    z_index        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_overlay_file ON OverlayState(file_path);
