use crate::vault::{self, Vault};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
pub struct Desktop {
    pub db: Mutex<Connection>,
    pub directory: PathBuf,
    pub vault: Mutex<Vault>,
    pub backend: Mutex<String>,
    pub bridge: Mutex<String>,
}
pub struct StartupError(pub String);
pub fn same_access(a: &Value, b: &Value) -> bool {
    a["profile"]["id"] == b["profile"]["id"]
        && a["profile"]["role"] == b["profile"]["role"]
        && b["profile"]["status"] == "active"
        && a["store"]["id"] == b["store"]["id"]
        && a["permissions"] == b["permissions"]
        && !b["terminal"].as_bool().unwrap_or(true)
}
pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
pub fn main_only(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        Err("This operation is available on the counter only.".into())
    } else {
        Ok(())
    }
}
pub fn normalize_url(input: &str) -> Result<String, String> {
    let url = url::Url::parse(input.trim()).map_err(|_| "Enter a valid backend address.")?;
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !matches!(url.path(), "/" | "/api/v1" | "/api/v1/")
    {
        return Err("Use a backend origin without credentials or additional paths.".into());
    }
    if url.scheme() != "https" && !(cfg!(debug_assertions) && url.scheme() == "http") {
        return Err("Production backend connections require HTTPS.".into());
    }
    Ok(format!("{}/api/v1", url.origin().ascii_serialization()))
}
impl Desktop {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let directory = app
            .path()
            .app_data_dir()
            .map_err(|_| "Cannot locate application data")?;
        fs::create_dir_all(&directory).map_err(|_| "Cannot open application data")?;
        let db = Connection::open(directory.join("counter.sqlite3"))
            .map_err(|_| "Cannot open local database")?;
        db.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "Cannot prepare local database")?;
        db.execute_batch(include_str!("../migrations/001_desktop.sql"))
            .map_err(|_| "Cannot initialize local database")?;
        db.execute_batch(include_str!("../migrations/002_cash_evidence.sql"))
            .map_err(|_| "Cannot initialize cash reconciliation history")?;
        db.execute(
            "UPDATE outbox SET status='PENDING' WHERE status='SYNCING'",
            [],
        )
        .map_err(|_| "Cannot recover synchronization")?;
        let backend = fs::read_to_string(directory.join("backend.txt"))
            .ok()
            .and_then(|v| normalize_url(&v).ok())
            .or_else(|| option_env!("TAHA_API_URL").and_then(|v| normalize_url(v).ok()))
            .or_else(|| {
                if cfg!(debug_assertions) {
                    Some("http://127.0.0.1:3001/api/v1".into())
                } else {
                    None
                }
            })
            .unwrap_or_default();
        let bridge = fs::read_to_string(directory.join("bridge.txt")).unwrap_or_default();
        let vault = vault::load(&directory.join("session.dpapi"));
        Ok(Self {
            db: Mutex::new(db),
            directory,
            vault: Mutex::new(vault),
            backend: Mutex::new(backend),
            bridge: Mutex::new(bridge),
        })
    }
    pub fn scope(&self, scope: &str) -> Result<(), String> {
        let vault = self.vault.lock().map_err(|_| "Session unavailable")?;
        let c = vault
            .context
            .as_ref()
            .ok_or("Sign in before using local shop data.")?;
        let expected = format!(
            "{}|{}|{}",
            self.backend
                .lock()
                .map_err(|_| "Configuration unavailable")?,
            c["store"]["id"].as_str().unwrap_or(""),
            c["profile"]["id"].as_str().unwrap_or("")
        );
        if expected != scope {
            return Err("This local data belongs to another staff session.".into());
        }
        Ok(())
    }
}
fn safe_cache(value: &Value) -> bool {
    match value {
        Value::Object(v) => v.iter().all(|(k, v)| {
            !matches!(
                k.as_str(),
                "purchase_cost"
                    | "purchaseCost"
                    | "profit"
                    | "password"
                    | "accessToken"
                    | "refreshToken"
                    | "token"
                    | "approval"
            ) && safe_cache(v)
        }),
        Value::Array(v) => v.iter().all(safe_cache),
        _ => true,
    }
}
#[tauri::command]
pub fn desktop_init(window: WebviewWindow, app: AppHandle) -> Result<Value, String> {
    main_only(&window)?;
    if let Some(error) = app.try_state::<StartupError>() {
        return Err(error.inner().0.clone());
    }
    let state = app
        .try_state::<Desktop>()
        .ok_or("Local database is unavailable.")?;
    Ok(
        json!({"backend":*state.backend.lock().map_err(|_|"Configuration unavailable")?,"bridge":*state.bridge.lock().map_err(|_|"Configuration unavailable")?,"version":env!("CARGO_PKG_VERSION"),"database":"SQLite","build":if cfg!(debug_assertions){"DEVELOPMENT"}else{"RELEASE"}}),
    )
}
#[tauri::command]
pub fn desktop_ready(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    main_only(&window)?;
    window.show().map_err(|_| "Cannot show the counter")?;
    let _ = window.set_focus();
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    Ok(())
}
#[tauri::command]
pub fn desktop_cache(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
    name: String,
    value: Option<Value>,
    raw: Option<bool>,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    if !(matches!(
        name.as_str(),
        "products"
            | "pos-products"
            | "locations"
            | "stock-balances"
            | "settings"
            | "customers"
            | "payment-methods"
            | "sync-cursor"
    ) || name.starts_with("product:")
        || name.starts_with("gallery:"))
    {
        return Err("This information cannot be stored offline.".into());
    }
    let db = state.db.lock().map_err(|_| "Database unavailable")?;
    if let Some(v) = value {
        if !safe_cache(&v) {
            return Err("Sensitive information cannot be stored in the catalogue cache.".into());
        }
        db.execute("INSERT INTO cache VALUES(?1,?2,?3,?4) ON CONFLICT(scope,name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",params![scope,name,v.to_string(),now()]).map_err(|_|"Cannot save cached data")?;
        return Ok(v);
    }
    let text: Option<String> = db
        .query_row(
            "SELECT value FROM cache WHERE scope=?1 AND name=?2",
            params![scope, name],
            |r| r.get(0),
        )
        .optional()
        .map_err(|_| "Cannot read cached data")?;
    let mut value = text
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .unwrap_or(Value::Null);
    if name == "pos-products" && !raw.unwrap_or(false) {
        if let Some(rows) = value.as_array_mut() {
            for p in rows {
                let prefix = crate::outbox::shop_prefix(&scope)?;
                let reserved: i64 = db
                    .query_row(
                        include_str!("../sql/reserved-shop-stock.sql"),
                        params![prefix, p["id"].as_str()],
                        |r| r.get(0),
                    )
                    .map_err(|_| "Cannot check pending shop stock")?;
                if let Some(q) = p["quantity"]
                    .as_f64()
                    .or_else(|| p["quantity"].as_str().and_then(|v| v.parse().ok()))
                {
                    p["quantity"] = json!((q - reserved as f64).max(0.));
                }
            }
        }
    }
    Ok(value)
}
#[tauri::command]
pub fn desktop_draft(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
    value: Option<Value>,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    let db = state.db.lock().map_err(|_| "Database unavailable")?;
    if let Some(v) = value {
        if !safe_cache(&v) {
            return Err("Remove manager approvals before saving an offline draft.".into());
        }
        db.execute("INSERT INTO drafts VALUES(?1,?2,?3) ON CONFLICT(scope) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",params![scope,v.to_string(),now()]).map_err(|_|"Cannot save draft")?;
        return Ok(v);
    }
    let text: Option<String> = db
        .query_row("SELECT value FROM drafts WHERE scope=?1", [scope], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|_| "Cannot read draft")?;
    Ok(text
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null))
}
#[tauri::command]
pub fn desktop_offline_context(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
) -> Result<Value, String> {
    main_only(&window)?;
    let v = state.vault.lock().map_err(|_| "Session unavailable")?;
    let grant = v
        .grant
        .as_ref()
        .ok_or("Connect and sign in once to enable offline cash sales.")?;
    if !same_access(
        &grant["context"],
        v.context.as_ref().unwrap_or(&Value::Null),
    ) {
        return Err("Offline access changed. Connect and sign in again.".into());
    }
    let expires = chrono::DateTime::parse_from_rfc3339(grant["expiresAt"].as_str().unwrap_or(""))
        .map_err(|_| "Offline authorization unavailable")?
        .timestamp_millis();
    if expires < now() {
        return Err("Offline access has expired. Connect to the shop and sign in again.".into());
    }
    Ok(grant["context"].clone())
}
#[tauri::command]
pub fn desktop_clear_session(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
) -> Result<(), String> {
    main_only(&window)?;
    *state.vault.lock().map_err(|_| "Session unavailable")? = Vault::default();
    let _ = fs::remove_file(state.directory.join("session.dpapi"));
    Ok(())
}
#[tauri::command]
pub fn desktop_backend(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    address: String,
    confirmed: bool,
) -> Result<String, String> {
    main_only(&window)?;
    if !confirmed {
        return Err("Confirm the backend change before saving.".into());
    }
    if state
        .vault
        .lock()
        .map_err(|_| "Session unavailable")?
        .context
        .as_ref()
        .and_then(|c| c["profile"]["role"].as_str())
        != Some("owner")
    {
        return Err("Only the owner can change the shop backend.".into());
    }
    let address = normalize_url(&address)?;
    let db = state.db.lock().map_err(|_| "Database unavailable")?;
    let pending: i64 = db
        .query_row(
            "SELECT count(*) FROM outbox WHERE status!='SYNCED'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Cannot check pending changes")?;
    if pending > 0 {
        return Err("Synchronize all pending changes before changing the backend.".into());
    }
    fs::write(state.directory.join("backend.txt"), &address).map_err(|_| "Cannot save backend")?;
    *state
        .backend
        .lock()
        .map_err(|_| "Configuration unavailable")? = address.clone();
    drop(db);
    desktop_clear_session(window, state)?;
    Ok(address)
}
#[tauri::command]
pub fn desktop_display(
    window: WebviewWindow,
    app: AppHandle,
    terminal: String,
    fullscreen: bool,
) -> Result<(), String> {
    main_only(&window)?;
    uuid::Uuid::parse_str(&terminal).map_err(|_| "Invalid counter identity")?;
    if let Some(display) = app.get_webview_window("customer-display") {
        display
            .set_fullscreen(fullscreen)
            .map_err(|_| "Cannot change display")?;
        let _ = display.show();
        let _ = display.set_focus();
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        &app,
        "customer-display",
        tauri::WebviewUrl::App(format!("index.html#/customer-display?terminal={terminal}").into()),
    )
    .title("TAHA MOBILES — Your Order")
    .inner_size(1366., 768.)
    .min_inner_size(800., 600.)
    .fullscreen(fullscreen)
    .build()
    .map_err(|_| "Cannot open customer display")?;
    Ok(())
}
#[tauri::command]
pub fn desktop_display_state(
    window: WebviewWindow,
    app: AppHandle,
    snapshot: Value,
) -> Result<(), String> {
    main_only(&window)?;
    let _ = app.emit_to(
        "customer-display",
        "taha-display-state",
        public_display(snapshot),
    );
    Ok(())
}
fn public_display(value: Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .filter(|(key, _)| {
                    ![
                        "purchase_cost",
                        "purchaseCost",
                        "minimumPrice",
                        "minimumSellingPrice",
                        "minimum_selling_price",
                        "profit",
                        "profitMargin",
                        "location",
                        "stock",
                        "inventoryQuantity",
                        "employeeId",
                        "employeeName",
                        "approval",
                        "notes",
                        "internalNotes",
                        "customerHistory",
                    ]
                    .contains(&key.as_str())
                })
                .map(|(k, v)| (k, public_display(v)))
                .collect(),
        ),
        Value::Array(rows) => Value::Array(rows.into_iter().map(public_display).collect()),
        other => other,
    }
}
