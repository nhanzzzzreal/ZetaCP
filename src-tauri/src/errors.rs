// src-tauri/src/errors.rs

use serde::ser::SerializeStruct;

#[derive(Debug, thiserror::Error)]
pub enum ZetaError {
    #[error("COMPILER_NOT_FOUND: {path}")]
    CompilerNotFound { path: String },
    
    #[error("DB_READONLY: {path}")]
    DbReadOnly { path: String },

    #[error("INVALID_INPUT: {message}")]
    InvalidInput { message: String },

    #[error("IO_ERROR: {0}")]
    Io(String),

    #[error("DB_ERROR: {0}")]
    Database(String),

    #[error("FATAL: {0}")]
    Fatal(String),
}

impl serde::Serialize for ZetaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut state = serializer.serialize_struct("ZetaError", 3)?;
        let (code, message, hint) = match self {
            ZetaError::CompilerNotFound { path } => (
                "COMPILER_NOT_FOUND",
                format!("Không tìm thấy trình biên dịch tại: {}", path),
                "Thêm g++/python vào biến môi trường PATH hoặc cấu hình thủ công trong Settings.",
            ),
            ZetaError::DbReadOnly { path } => (
                "DB_READONLY",
                format!("Database ở chế độ chỉ đọc: {}", path),
                "Hãy kiểm tra lại quyền ghi của USB hoặc thư mục chứa project.",
            ),
            ZetaError::InvalidInput { message } => (
                "INVALID_INPUT",
                message.clone(),
                "Vui lòng kiểm tra lại tính hợp lệ của dữ liệu nhập vào.",
            ),
            ZetaError::Io(err) => (
                "IO_ERROR",
                err.clone(),
                "Kiểm tra lại quyền đọc/ghi file hoặc kết nối ổ đĩa.",
            ),
            ZetaError::Database(err) => (
                "DB_ERROR",
                err.clone(),
                "Lỗi truy vấn cơ sở dữ liệu SQLite. Hãy chắc chắn file DB không bị chiếm dụng.",
            ),
            ZetaError::Fatal(err) => (
                "FATAL",
                err.clone(),
                "Lỗi hệ thống nghiêm trọng. Vui lòng bấm 'Copy logs' và gửi lại cho nhà phát triển.",
            ),
        };

        state.serialize_field("code", code)?;
        state.serialize_field("message", &message)?;
        state.serialize_field("hint", hint)?;
        state.end()
    }
}

// Implement standard From traits for easy error conversion using `?` operator
impl From<std::io::Error> for ZetaError {
    fn from(err: std::io::Error) -> Self {
        ZetaError::Io(err.to_string())
    }
}

impl From<sqlx::Error> for ZetaError {
    fn from(err: sqlx::Error) -> Self {
        ZetaError::Database(err.to_string())
    }
}
