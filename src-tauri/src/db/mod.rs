// src-tauri/src/db/mod.rs

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
use sqlx::SqlitePool;
use crate::errors::ZetaError;

pub async fn open_db(path: &str) -> Result<SqlitePool, ZetaError> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)  // WAL: cho phép đọc song song khi write
        .foreign_keys(true);

    match SqlitePool::connect_with(options).await {
        Ok(pool) => {
            run_migrations(&pool).await?;
            Ok(pool)
        }
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("readonly") || err_str.contains("permission") || err_str.contains("Access is denied") {
                Err(ZetaError::DbReadOnly { path: path.to_string() })
            } else {
                Err(ZetaError::Database(err_str))
            }
        }
    }
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), ZetaError> {
    let mut conn = pool.acquire().await?;
    
    // Đọc PRAGMA user_version
    let current_version: i32 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(&mut *conn)
        .await?;

    tracing::info!("Phiên bản Database hiện tại: {}", current_version);

    // Danh sách các file migration
    let migrations = vec![
        (1, include_str!("migrations/v1.sql")),
        (2, include_str!("migrations/v2.sql")),
        (3, include_str!("migrations/v3.sql")),
        (4, include_str!("migrations/v4.sql")),
    ];

    for (version, sql) in migrations {
        if version > current_version {
            tracing::info!("Đang chạy migration v{}", version);
            
            let mut tx = pool.begin().await?;
            
            // Chạy tập lệnh SQL của migration
            sqlx::query(sql).execute(&mut *tx).await.map_err(|e| {
                ZetaError::Fatal(format!("Migration v{} thất bại: {}", version, e))
            })?;
            
            tx.commit().await?;
            
            // Cập nhật PRAGMA user_version ngoài transaction
            let version_query = format!("PRAGMA user_version = {}", version);
            sqlx::query(&version_query).execute(pool).await.map_err(|e| {
                ZetaError::Fatal(format!("Không thể cập nhật PRAGMA user_version lên {}: {}", version, e))
            })?;
            
            tracing::info!("Migration v{} đã được áp dụng thành công", version);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_migration_runs_cleanly() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let db_path = std::env::temp_dir().join(format!("zetacp_test_{}.db", now));
        let db_path_str = db_path.to_string_lossy().to_string();

        {
            let options = SqliteConnectOptions::new()
                .filename(&db_path_str)
                .create_if_missing(true)
                .journal_mode(SqliteJournalMode::Delete)
                .foreign_keys(true);
            let db = SqlitePool::connect_with(options).await.unwrap();
            run_migrations(&db).await.unwrap();

            // Kiểm tra user_version
            let v: i32 = sqlx::query_scalar("PRAGMA user_version")
                .fetch_one(&db).await.unwrap();
            assert!(v >= 1);
        }

        // Cleanup files
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
    }
}
