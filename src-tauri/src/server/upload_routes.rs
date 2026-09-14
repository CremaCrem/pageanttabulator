use crate::db::AppState;
use axum::{
    extract::{Multipart, State},
    Json,
};
use image::{imageops::FilterType, ImageFormat};
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::Cursor;
use uuid::Uuid;

pub async fn upload_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let mut image_data = None;

    while let Some(field) = multipart.next_field().await.map_err(|err| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("Error reading multipart field: {}", err),
        )
    })? {
        if field.name() == Some("file") {
            let data = field.bytes().await.map_err(|err| {
                (
                    axum::http::StatusCode::BAD_REQUEST,
                    format!("Error reading file data: {}", err),
                )
            })?;
            image_data = Some(data);
            break;
        }
    }

    let image_data = image_data.ok_or((
        axum::http::StatusCode::BAD_REQUEST,
        "No file field found".to_string(),
    ))?;

    // Load the image
    let img = image::load_from_memory(&image_data).map_err(|err| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("Invalid image file: {}", err),
        )
    })?;

    // Resize if width > 800px
    let img = if img.width() > 800 {
        let new_height = (800.0 * (img.height() as f32) / (img.width() as f32)) as u32;
        img.resize_exact(800, new_height, FilterType::Lanczos3)
    } else {
        img
    };

    // Encode as JPEG
    let mut compressed_bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut compressed_bytes);
    
    img.write_to(&mut cursor, ImageFormat::Jpeg)
        .map_err(|err| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to encode image: {}", err),
            )
        })?;

    // Generate unique filename
    let filename = format!("{}.jpg", Uuid::new_v4());

    // Get the app data dir
    let app_dir = {
        let db_lock = state.db.lock().unwrap();
        let path = db_lock.path().unwrap();
        std::path::Path::new(path).parent().unwrap().to_path_buf()
    };
    
    let uploads_dir = app_dir.join("uploads");
    std::fs::create_dir_all(&uploads_dir).map_err(|err| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create uploads directory: {}", err),
        )
    })?;

    let file_path = uploads_dir.join(&filename);
    std::fs::write(&file_path, compressed_bytes).map_err(|err| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write file to disk: {}", err),
        )
    })?;

    // Return the relative URL
    Ok(Json(json!({
        "url": format!("/uploads/{}", filename)
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPayload {
    pub pin: String,
}

pub async fn cleanup_orphans(
    State(state): State<AppState>,
    Json(payload): Json<CleanupPayload>,
) -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let conn = state.db.lock().unwrap();

    let config = crate::db::event::get(&conn).map_err(|_| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to load event config".to_string(),
        )
    })?;

    if let Some(config) = config {
        let is_valid = payload.pin == config.admin_pin;
        if !is_valid {
            return Err((axum::http::StatusCode::FORBIDDEN, "Invalid PIN".to_string()));
        }
    } else {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "Event not configured".to_string(),
        ));
    }

    let app_dir = std::path::Path::new(conn.path().unwrap()).parent().unwrap().to_path_buf();
    let uploads_dir = app_dir.join("uploads");

    if !uploads_dir.exists() {
        return Ok(Json(json!({ "status": "success", "deletedCount": 0 })));
    }

    let mut valid_paths = std::collections::HashSet::new();

    if let Ok(judges) = crate::db::judges::get_all(&conn) {
        for j in judges {
            if let Some(path) = j.photo_path {
                if let Some(filename) = path.split('/').next_back() {
                    valid_paths.insert(filename.to_string());
                }
            }
        }
    }

    if let Ok(candidates) = crate::db::candidates::get_all(&conn) {
        for c in candidates {
            if let Some(path) = c.photo_path {
                if let Some(filename) = path.split('/').next_back() {
                    valid_paths.insert(filename.to_string());
                }
            }
        }
    }

    let mut deleted_count = 0;

    if let Ok(entries) = std::fs::read_dir(&uploads_dir) {
        for entry in entries.flatten() {
            if let Ok(file_name) = entry.file_name().into_string() {
                if !valid_paths.contains(&file_name)
                    && std::fs::remove_file(entry.path()).is_ok() {
                        deleted_count += 1;
                    }
            }
        }
    }

    Ok(Json(json!({
        "status": "success",
        "deletedCount": deleted_count
    })))
}
