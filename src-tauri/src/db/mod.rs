// src-tauri/src/db/mod.rs

pub mod repository;
pub mod global_repo;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::SqlitePool;
use crate::errors::ZetaError;
use std::time::Duration;

pub async fn open_db(path: &str) -> Result<SqlitePool, ZetaError> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)  // WAL: cho phép đọc song song khi write
        .synchronous(SqliteSynchronous::Normal) // Safe & performant in WAL mode
        .busy_timeout(Duration::from_secs(10))  // Wait up to 10s on lock contention
        .foreign_keys(true);

    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_slow_threshold(Duration::from_secs(60))
        .connect_with(options)
        .await
        .map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("readonly") || err_str.contains("permission") || err_str.contains("Access is denied") {
                ZetaError::DbReadOnly { path: path.to_string() }
            } else {
                ZetaError::Database(err_str)
            }
        })?;

    run_migrations(&pool).await?;
    Ok(pool)
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
        (5, include_str!("migrations/v5.sql")),
        (6, include_str!("migrations/v6.sql")),
        (7, include_str!("migrations/v7.sql")),
        (8, include_str!("migrations/v8.sql")),
        (9, include_str!("migrations/v9.sql")),
        (10, include_str!("migrations/v10.sql")),
        (11, include_str!("migrations/v11.sql")),
        (12, include_str!("migrations/v12.sql")),
        (13, include_str!("migrations/v13.sql")),
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
