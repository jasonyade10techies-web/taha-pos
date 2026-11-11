use crate::desktop::{main_only, now, Desktop};
use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};
use tauri::WebviewWindow;
#[tauri::command]
pub fn desktop_image(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
    id: String,
    data: Option<String>,
    kind: Option<String>,
    cloud_path: Option<String>,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    uuid::Uuid::parse_str(&id).map_err(|_| "Invalid image reference")?;
    let mut db = state.db.lock().map_err(|_| "Local database unavailable")?;
    if let Some(data) = data {
        let bytes = STANDARD.decode(data).map_err(|_| "Invalid photo")?;
        if bytes.len() > 10 * 1024 * 1024
            || bytes.len() < 16
            || !(bytes.starts_with(&[0xff, 0xd8, 0xff])
                || bytes.starts_with(b"\x89PNG\r\n\x1a\n")
                || (bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP")))
        {
            return Err("Choose a JPEG, PNG or WebP photo under 10 MB.".into());
        }
        let tx = db.transaction().map_err(|_| "Cannot queue photo")?;
        if let Some((old_scope, old_path)) = tx
            .query_row(
                "SELECT scope,path FROM pending_images WHERE id=?1",
                [&id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|_| "Cannot inspect queued photo")?
        {
            if old_scope != scope
                || std::fs::read(old_path).map_err(|_| "Cannot read queued photo")? != bytes
            {
                return Err("This photo reference was already used. Create a new capture.".into());
            }
            return Ok(json!({"id":id}));
        }
        let total: i64 = tx
            .query_row(
                "SELECT coalesce(sum(size),0) FROM pending_images WHERE cloud_path IS NULL",
                [],
                |r| r.get(0),
            )
            .map_err(|_| "Cannot check pending photos")?;
        if total + bytes.len() as i64 > 64 * 1024 * 1024 {
            return Err(
                "Pending photos reached 64 MB. Synchronize before taking more photos.".into(),
            );
        }
        let kind = kind.ok_or("Choose the photo purpose")?;
        if ![
            "product", "proof", "device", "repair", "profile", "customer", "damage", "document",
        ]
        .contains(&kind.as_str())
        {
            return Err("Invalid photo purpose".into());
        }
        let directory = state.directory.join("pending-images");
        std::fs::create_dir_all(&directory).map_err(|_| "Cannot prepare local photo storage")?;
        let file = directory.join(format!("{id}.image"));
        use std::io::Write;
        let mut output = std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&file)
            .map_err(|_| "Cannot preserve photo")?;
        output
            .write_all(&bytes)
            .and_then(|_| output.sync_all())
            .map_err(|_| "Cannot preserve photo")?;
        tx.execute(
            "INSERT INTO pending_images VALUES(?1,?2,?3,?4,NULL,?5)",
            params![id, scope, file.to_string_lossy(), bytes.len(), now()],
        )
        .map_err(|_| "Cannot preserve photo reference")?;
        tx.execute("INSERT INTO outbox(id,scope,type,payload,idempotency_key,created_at) VALUES(?1,?2,'IMAGE_UPLOAD',?3,?1,?4)",params![id,scope,json!({"imageId":id,"kind":kind}).to_string(),now()]).map_err(|_|"Cannot queue photo")?;
        tx.commit().map_err(|_| "Cannot commit photo queue")?;
        return Ok(json!({"id":id}));
    }
    if let Some(path) = cloud_path {
        db.execute(
            "UPDATE pending_images SET cloud_path=?1 WHERE id=?2 AND scope=?3",
            params![path, id, scope],
        )
        .map_err(|_| "Cannot acknowledge uploaded photo")?;
        return Ok(json!({"path":path}));
    }
    let (path, cloud): (String, Option<String>) = db
        .query_row(
            "SELECT path,cloud_path FROM pending_images WHERE id=?1 AND scope=?2",
            params![id, scope],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "This photo is unavailable on the current employee account")?;
    if let Some(path) = cloud {
        return Ok(json!({"path":path}));
    }
    let bytes = std::fs::read(path).map_err(|_| "The queued photo could not be read")?;
    let mime = if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(b"RIFF") {
        "image/webp"
    } else {
        "image/jpeg"
    };
    Ok(json!({"body":STANDARD.encode(bytes),"mime":mime}))
}
