// src-tauri/src/commands/snippets.rs

use tauri::State;
use crate::state::AppState;
use crate::errors::ZetaError;

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Snippet {
    pub id: i64,
    pub trigger: String,
    pub description: String,
    pub code: String,
    pub language: String,
    pub is_default: i64,
}

#[tauri::command]
pub async fn load_snippets(state: State<'_, AppState>) -> Result<Vec<Snippet>, ZetaError> {
    let pool = &state.settings_db;
    let snippets = sqlx::query_as::<_, Snippet>("SELECT id, trigger, description, code, language, is_default FROM Snippets")
        .fetch_all(pool)
        .await
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
    Ok(snippets)
}

#[derive(Debug, serde::Deserialize)]
pub struct SaveSnippetArg {
    pub id: Option<i64>,
    pub trigger: String,
    pub description: String,
    pub code: String,
    pub language: String,
    pub is_default: i64,
}

#[tauri::command]
pub async fn save_snippet(
    snippet: SaveSnippetArg,
    state: State<'_, AppState>,
) -> Result<i64, ZetaError> {
    let pool = &state.settings_db;

    // If setting this snippet as default, clear default for other snippets of the same language
    if snippet.is_default == 1 {
        sqlx::query("UPDATE Snippets SET is_default = 0 WHERE language = ?")
            .bind(&snippet.language)
            .execute(pool)
            .await
            .map_err(|e| ZetaError::Fatal(e.to_string()))?;
    }

    if let Some(id) = snippet.id {
        sqlx::query(
            "UPDATE Snippets SET trigger = ?, description = ?, code = ?, language = ?, is_default = ? WHERE id = ?"
        )
        .bind(&snippet.trigger)
        .bind(&snippet.description)
        .bind(&snippet.code)
        .bind(&snippet.language)
        .bind(snippet.is_default)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
        Ok(id)
    } else {
        let res = sqlx::query(
            "INSERT INTO Snippets (trigger, description, code, language, is_default) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&snippet.trigger)
        .bind(&snippet.description)
        .bind(&snippet.code)
        .bind(&snippet.language)
        .bind(snippet.is_default)
        .execute(pool)
        .await
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
        Ok(res.last_insert_rowid())
    }
}

#[tauri::command]
pub async fn delete_snippet(
    id: i64,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let pool = &state.settings_db;
    sqlx::query("DELETE FROM Snippets WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
    Ok(())
}

