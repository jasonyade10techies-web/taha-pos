use crate::desktop::{main_only, Desktop};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{fs, time::Duration};
use tauri::{AppHandle, WebviewWindow};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const MAX_BYTES: u64 = 256 * 1024 * 1024;
const MAX_METADATA: usize = 32768;
fn pending_work(db: &rusqlite::Connection, scope: &str) -> Result<i64, String> {
    db.query_row("SELECT (SELECT count(*) FROM outbox WHERE status!='SYNCED') + (SELECT count(*) FROM drafts WHERE scope=?1 AND json_array_length(value,'$.items')>0)", [scope], |r| r.get(0)).map_err(|_| "Cannot verify pending counter work".into())
}
fn secure_url(value: &Url, origin: &Url, prefix: &str) -> Result<(), String> {
    if value.scheme() != "https"
        || value.origin() != origin.origin()
        || !value.username().is_empty()
        || value.password().is_some()
        || value.query().is_some()
        || value.fragment().is_some()
        || !value.path().starts_with(prefix)
    {
        return Err("Update address does not belong to this shop's secure release channel.".into());
    }
    Ok(())
}
fn safety(state: &Desktop) -> Result<(), String> {
    let vault = state.vault.lock().map_err(|_| "Session unavailable")?;
    let context = vault
        .context
        .as_ref()
        .ok_or("Sign in as owner to manage updates.")?;
    if context["profile"]["role"] != "owner" || context["profile"]["status"] != "active" {
        return Err("Only the owner can install application updates.".into());
    }
    let scope = format!(
        "{}|{}|{}",
        state
            .backend
            .lock()
            .map_err(|_| "Configuration unavailable")?,
        context["store"]["id"].as_str().ok_or("Shop unavailable")?,
        context["profile"]["id"]
            .as_str()
            .ok_or("Owner unavailable")?
    );
    drop(vault);
    let db = state.db.lock().map_err(|_| "Database unavailable")?;
    // Inactive staff drafts remain recoverable in SQLite; they are not current
    // counter work. Unresolved paid operations/photos still block globally.
    let pending = pending_work(&db, &scope)?;
    if pending > 0 {
        return Err(
            "Finish or clear active carts and synchronize all pending changes before updating."
                .into(),
        );
    }
    Ok(())
}
fn updater(
    app: &AppHandle,
    state: &Desktop,
) -> Result<(tauri_plugin_updater::Updater, Url), String> {
    // Staging keys and AppData must never silently become production identity.
    if app.config().identifier != "com.tahamobiles.pos.staging" {
        return Err("This installation has no approved production update channel.".into());
    }
    let backend = state
        .backend
        .lock()
        .map_err(|_| "Configuration unavailable")?
        .clone();
    let origin = Url::parse(&backend).map_err(|_| "Configure the shop backend first.")?;
    let endpoint = origin
        .join("/downloads/taha-pos/updates/staging.json")
        .map_err(|_| "Invalid release address")?;
    secure_url(&endpoint, &origin, "/downloads/taha-pos/updates/")?;
    let value = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|_| "Invalid release address")?
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|_| "Signed update configuration is unavailable")?;
    Ok((value, origin))
}
fn details(update: &tauri_plugin_updater::Update, origin: &Url) -> Result<(u64, String), String> {
    secure_url(
        &update.download_url,
        origin,
        &format!("/downloads/taha-pos/windows/staging/{}/", update.version),
    )?;
    let platform = &update.raw_json["platforms"]["windows-x86_64"];
    let size = platform["sizeBytes"]
        .as_u64()
        .filter(|n| *n > 0 && *n <= MAX_BYTES)
        .ok_or("Release size is missing or exceeds the supported limit.")?;
    let sha = platform["sha256"]
        .as_str()
        .filter(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        })
        .ok_or("Release checksum is missing.")?
        .to_owned();
    Ok((size, sha))
}
fn metadata(bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() > MAX_METADATA {
        return Err("Update metadata exceeds its size limit.".into());
    }
    serde_json::from_slice(bytes)
        .map_err(|_| "The release service returned invalid metadata.".into())
}
async fn check_update(
    updater: &tauri_plugin_updater::Updater,
    origin: &Url,
) -> Result<Option<tauri_plugin_updater::Update>, String> {
    let endpoint = origin
        .join("/downloads/taha-pos/updates/staging.json")
        .map_err(|_| "Invalid release address")?;
    secure_url(&endpoint, origin, "/downloads/taha-pos/updates/")?;
    let client = reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|_| "Cannot prepare release check")?;
    let mut response = client
        .get(endpoint)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| "The release service could not be reached. Try again later.")?;
    if response.status() == reqwest::StatusCode::NO_CONTENT {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err("No approved release is available from the shop update service.".into());
    }
    if response
        .content_length()
        .is_some_and(|n| n > MAX_METADATA as u64)
    {
        return Err("Update metadata exceeds its size limit.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Release check was interrupted")?
    {
        if bytes.len() + chunk.len() > MAX_METADATA {
            return Err("Update metadata exceeds its size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    updater
        .restore_update(metadata(&bytes)?)
        .map_err(|_| "Release metadata is invalid or lacks authenticated version support.".into())
}
#[tauri::command]
pub async fn desktop_update_check(
    window: WebviewWindow,
    app: AppHandle,
    state: tauri::State<'_, Desktop>,
) -> Result<Value, String> {
    main_only(&window)?;
    let (updater, origin) = updater(&app, &state)?;
    match check_update(&updater, &origin).await? {
        None => Ok(json!({"available": false})),
        Some(update) => {
            let (size, _) = details(&update, &origin)?;
            Ok(
                json!({"available":true,"version":update.version,"notes":update.body,"sizeBytes":size}),
            )
        }
    }
}
#[tauri::command]
pub async fn desktop_update_download(
    window: WebviewWindow,
    app: AppHandle,
    state: tauri::State<'_, Desktop>,
) -> Result<Value, String> {
    main_only(&window)?;
    safety(&state)?;
    let (updater, origin) = updater(&app, &state)?;
    let update = check_update(&updater, &origin)
        .await?
        .ok_or("No newer approved release is available.")?;
    let (size, expected) = details(&update, &origin)?;
    // No session cookies, no redirects, bounded memory/time; executable bytes are
    // authenticated by the embedded updater key and signed VERSION, not HTTPS alone.
    let client = reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "Cannot prepare update download")?;
    let mut response = client
        .get(update.download_url.clone())
        .send()
        .await
        .map_err(|_| "Update download was interrupted. Retry when connected.")?;
    if !response.status().is_success() || response.content_length() != Some(size) {
        return Err("Update download size/status did not match the approved release.".into());
    }
    let mut bytes = Vec::with_capacity(size as usize);
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Update download was interrupted.")?
    {
        if bytes.len() as u64 + chunk.len() as u64 > size {
            return Err("Update exceeded its declared size.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.len() as u64 != size || format!("{:x}", Sha256::digest(&bytes)) != expected {
        return Err("Update checksum verification failed.".into());
    }
    update
        .verify(&bytes)
        .map_err(|_| "Update signature or authenticated version is invalid.")?;
    let directory = state.directory.join("verified-update");
    fs::create_dir_all(&directory).map_err(|_| "Cannot store the verified update")?;
    fs::write(directory.join("installer.pending"), &bytes)
        .map_err(|_| "Cannot store update bytes")?;
    fs::write(
        directory.join("manifest.pending"),
        update.raw_json.to_string(),
    )
    .map_err(|_| "Cannot store update details")?;
    Ok(json!({"ready":true,"version":update.version}))
}
#[tauri::command]
pub fn desktop_update_install(
    window: WebviewWindow,
    app: AppHandle,
    state: tauri::State<Desktop>,
    confirmed: bool,
) -> Result<(), String> {
    main_only(&window)?;
    if !confirmed {
        return Err("Confirm the application restart first.".into());
    }
    safety(&state)?;
    let (updater, origin) = updater(&app, &state)?;
    let directory = state.directory.join("verified-update");
    let meta = directory.join("manifest.pending");
    if fs::metadata(&meta)
        .map_err(|_| "Download an update first")?
        .len()
        > 32768
    {
        return Err("Invalid saved update details".into());
    }
    let raw: Value =
        serde_json::from_slice(&fs::read(meta).map_err(|_| "Cannot read saved update")?)
            .map_err(|_| "Invalid saved update")?;
    let update = updater
        .restore_update(raw)
        .map_err(|_| "Saved update signature metadata is invalid.")?
        .ok_or("Saved update is no longer newer than this application.")?;
    let (size, expected) = details(&update, &origin)?;
    let file = directory.join("installer.pending");
    if fs::metadata(&file)
        .map_err(|_| "Download the update again")?
        .len()
        != size
    {
        return Err("Saved update size is invalid.".into());
    }
    let bytes = fs::read(file).map_err(|_| "Cannot read saved update")?;
    if format!("{:x}", Sha256::digest(&bytes)) != expected {
        return Err("Saved update checksum is invalid.".into());
    }
    update.install(bytes).map_err(|_| {
        "The installer could not be verified or started. Your shop data has been retained.".into()
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn inactive_drafts_are_retained_without_stranding_owner_updates() {
        let db = rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../migrations/001_desktop.sql"))
            .unwrap();
        db.execute(
            "INSERT INTO drafts VALUES('departed-staff','{\"items\":[{}]}',0)",
            [],
        )
        .unwrap();
        assert_eq!(pending_work(&db, "owner").unwrap(), 0);
        assert_eq!(
            db.query_row::<i64, _, _>("SELECT count(*) FROM drafts", [], |r| r.get(0))
                .unwrap(),
            1
        );
        db.execute(
            "INSERT INTO drafts VALUES('owner','{\"items\":[{}]}',0)",
            [],
        )
        .unwrap();
        assert_eq!(pending_work(&db, "owner").unwrap(), 1);
        db.execute(
            "UPDATE drafts SET value='{\"items\":[]}' WHERE scope='owner'",
            [],
        )
        .unwrap();
        db.execute("INSERT INTO outbox(id,scope,type,payload,idempotency_key,created_at) VALUES('paid','departed-staff','CASH_SALE','{}','once',0)",[]).unwrap();
        assert_eq!(pending_work(&db, "owner").unwrap(), 1);
    }
    #[test]
    fn metadata_is_bounded_before_json_parsing() {
        assert!(metadata(&vec![b' '; MAX_METADATA + 1]).is_err());
        assert!(metadata(b"invalid").is_err());
        assert_eq!(
            metadata(b"{\"version\":\"0.5.2\"}").unwrap()["version"],
            "0.5.2"
        );
    }
    #[test]
    fn update_urls_are_https_same_origin_and_channel_scoped() {
        let origin = Url::parse("https://shop.test/api/v1").unwrap();
        for value in [
            "http://shop.test/downloads/taha-pos/windows/staging/1/setup.exe",
            "https://evil.test/downloads/taha-pos/windows/staging/1/setup.exe",
            "https://shop.test/private/data",
            "https://user@shop.test/downloads/taha-pos/windows/staging/1/setup.exe",
        ] {
            assert!(secure_url(
                &Url::parse(value).unwrap(),
                &origin,
                "/downloads/taha-pos/windows/staging/"
            )
            .is_err());
        }
        assert!(secure_url(
            &Url::parse("https://shop.test/downloads/taha-pos/windows/staging/1/setup.exe")
                .unwrap(),
            &origin,
            "/downloads/taha-pos/windows/staging/"
        )
        .is_ok());
    }
}
