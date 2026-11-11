use crate::{
    desktop::{main_only, now, Desktop},
    vault,
};
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};
use tauri::WebviewWindow;
pub fn shop_prefix(scope: &str) -> Result<String, String> {
    scope
        .rsplit_once('|')
        .map(|(shop, _)| format!("{shop}|"))
        .ok_or("Invalid shop scope".into())
}
pub fn can_reconcile(state: &Desktop) -> Result<bool, String> {
    let v = state.vault.lock().map_err(|_| "Session unavailable")?;
    let c = v.context.as_ref().ok_or("Sign in to review local cash")?;
    Ok(c["profile"]["status"] == "active"
        && (c["profile"]["role"] == "owner"
            || (c["profile"]["role"] == "manager"
                && c["permissions"]
                    .as_array()
                    .is_some_and(|p| p.iter().any(|k| k == "sync.reconcile_cash")))))
}
#[tauri::command]
pub fn desktop_queue_sale(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
    mut payload: Value,
    mut receipt: Value,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    let id = payload["input"]["idempotencyKey"]
        .as_str()
        .ok_or("Missing transaction identity")?
        .to_owned();
    uuid::Uuid::parse_str(&id).map_err(|_| "Invalid transaction identity")?;
    let invoice = format!("TM-INV-O-{}", id.to_uppercase());
    if receipt["invoice"] != invoice || payload["invoice"] != invoice {
        return Err("Invalid offline invoice".into());
    }
    if let Some(object) = payload.as_object_mut() {
        object.remove("grant");
    }
    let lines = payload["input"]["lines"]
        .as_array()
        .ok_or("Sale needs catalogue items")?;
    let payments = payload["input"]["payments"]
        .as_array()
        .ok_or("Cash payment is required")?;
    if lines.is_empty()
        || lines.len() > 100
        || payments.len() != 1
        || payments[0]["methodId"] == "credit"
        || lines
            .iter()
            .any(|l| !l["customService"].is_null() || !l["approval"].is_null())
        || payload["input"]["coupon"]
            .as_str()
            .is_some_and(|v| !v.is_empty())
        || payload["input"]["sourceTestId"]
            .as_str()
            .is_some_and(|v| !v.is_empty())
    {
        return Err("Offline checkout supports cash and catalogue items only.".into());
    }
    let vault = state
        .vault
        .lock()
        .map_err(|_| "Session unavailable")?
        .clone();
    let grant = vault
        .grant
        .as_ref()
        .ok_or("Sign in online once to enable offline cash sales.")?;
    let captured_at = chrono::Utc::now();
    if chrono::DateTime::parse_from_rfc3339(grant["expiresAt"].as_str().unwrap_or(""))
        .map_err(|_| "Offline authorization unavailable")?
        .timestamp_millis()
        < captured_at.timestamp_millis()
    {
        return Err("Offline cash authorization expired. Connect and sign in again.".into());
    }
    if !crate::desktop::same_access(
        &grant["context"],
        &vault.context.clone().unwrap_or(Value::Null),
    ) {
        return Err("Sign in online to authorize this employee for offline checkout.".into());
    }
    payload["terminalId"] = grant["terminalId"].clone();
    payload["createdAt"] = json!(captured_at.to_rfc3339());
    receipt["createdAt"] = payload["createdAt"].clone();
    let total = payload["total"]
        .as_f64()
        .filter(|v| v.is_finite() && *v > 0.)
        .ok_or("Invalid collected amount")?;
    let tendered = receipt["cashReceived"]
        .as_f64()
        .ok_or("Missing cash received")?;
    let change = receipt["change"].as_f64().ok_or("Missing change given")?;
    if receipt["employeeId"] != grant["context"]["profile"]["id"]
        || receipt["total"].as_f64() != Some(total)
        || tendered < total
        || change < 0.
        || ((tendered - change - total) * 100.).abs() > 0.001
        || payload["input"]["cashReceived"].as_f64() != Some(tendered)
        || payload["input"]["payments"][0]["amount"].as_f64() != Some(total)
        || [total, tendered, change]
            .iter()
            .any(|v| !v.is_finite() || (*v * 100. - (*v * 100.).round()).abs() > 0.001)
    {
        return Err("Cash received, change and original seller must match the receipt.".into());
    }
    payload["receipt"] = receipt.clone();
    let prefix = shop_prefix(&scope)?;
    let mut db = state.db.lock().map_err(|_| "Database unavailable")?;
    let tx = db
        .transaction()
        .map_err(|_| "Cannot start local checkout")?;
    if let Some(old) = tx
        .query_row(
            "SELECT value FROM receipts WHERE id=?1 AND scope=?2",
            params![id, scope],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map_err(|_| "Cannot recover receipt")?
    {
        return serde_json::from_str(&old).map_err(|_| "Cannot read receipt".into());
    }
    let catalog: String = tx
        .query_row(
            "SELECT value FROM cache WHERE scope=?1 AND name='pos-products'",
            [&scope],
            |r| r.get(0),
        )
        .map_err(|_| "Load the product catalogue online before selling offline.")?;
    let catalog: Value = serde_json::from_str(&catalog).map_err(|_| "Catalogue unavailable")?;
    for line in payload["input"]["lines"]
        .as_array()
        .ok_or("Sale needs items")?
    {
        let pid = line["productId"].as_str().ok_or("Invalid item")?;
        let product = catalog
            .as_array()
            .and_then(|rows| rows.iter().find(|p| p["id"] == pid))
            .ok_or("This item is not available in the cached catalogue.")?;
        let qty = line["quantity"]
            .as_i64()
            .filter(|v| *v > 0)
            .ok_or("Invalid quantity")?;
        let reserved: i64 = tx
            .query_row(
                include_str!("../sql/reserved-shop-stock.sql"),
                params![prefix, pid],
                |r| r.get(0),
            )
            .map_err(|_| "Cannot check local stock")?;
        if line["unitPrice"].as_f64().unwrap_or(0.)
            < product["minimum_selling_price"]
                .as_str()
                .and_then(|v| v.parse().ok())
                .or(product["minimum_selling_price"].as_f64())
                .unwrap_or(f64::MAX)
        {
            return Err("Below-minimum sales require an online manager approval.".into());
        }
        if product["category"] != "Services"
            && product["quantity"]
                .as_i64()
                .or_else(|| product["quantity"].as_str().and_then(|v| v.parse().ok()))
                .unwrap_or(0)
                < reserved + qty
        {
            return Err("Insufficient cached stock. Reconnect before completing this sale.".into());
        }
    }
    // The original signed authorization is DPAPI-encrypted separately, never kept in SQLite.
    let mut original = vault.clone();
    original.cookies.clear();
    vault::save(
        &state.directory.join(format!("outbox-{id}.dpapi")),
        &original,
    )?;
    tx.execute("INSERT INTO outbox(id,scope,type,payload,idempotency_key,created_at) VALUES(?1,?2,'CASH_SALE',?3,?1,?4)",params![id,scope,payload.to_string(),now()]).map_err(|_|"Cannot queue offline sale")?;
    for line in payload["input"]["lines"].as_array().unwrap() {
        let product = catalog
            .as_array()
            .unwrap()
            .iter()
            .find(|p| p["id"] == line["productId"])
            .unwrap();
        if product["category"] != "Services" {
            tx.execute(
                "INSERT INTO reservations VALUES(?1,?2,?3,?4)",
                params![
                    scope,
                    line["productId"].as_str(),
                    id,
                    line["quantity"].as_i64()
                ],
            )
            .map_err(|_| "Cannot reserve local stock")?;
        }
    }
    tx.execute(
        "INSERT INTO receipts VALUES(?1,?2,?3,?4,?5)",
        params![id, scope, invoice, receipt.to_string(), now()],
    )
    .map_err(|_| "Cannot save receipt")?;
    tx.execute(include_str!("../sql/capture-cash.sql"), [&id])
        .map_err(|_| "Cannot preserve the original cash record")?;
    tx.execute("DELETE FROM drafts WHERE scope=?1", [&scope])
        .map_err(|_| "Cannot clear completed draft")?;
    tx.commit().map_err(|_| "Cannot complete local checkout")?;
    Ok(receipt)
}
#[tauri::command]
pub fn desktop_outbox(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
    id: Option<String>,
    status: Option<String>,
    error: Option<String>,
    receipt: Option<Value>,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    let resolver = can_reconcile(&state)?;
    let prefix = shop_prefix(&scope)?;
    let mut db = state.db.lock().map_err(|_| "Database unavailable")?;
    if let Some(id) = id {
        let target_scope:String=db.query_row("SELECT scope FROM outbox WHERE id=?1 AND (scope=?2 OR (?3 AND type='CASH_SALE' AND substr(scope,1,length(?4))=?4))",params![id,scope,resolver,prefix],|r|r.get(0)).map_err(|_|"This change is not available to the current employee")?;
        let status = status.ok_or("Missing synchronization status")?;
        if ![
            "PENDING",
            "SYNCING",
            "SYNCED",
            "CONFLICT",
            "FAILED",
            "REGISTERED",
        ]
        .contains(&status.as_str())
        {
            return Err("Invalid synchronization status".into());
        }
        let tx = db
            .transaction()
            .map_err(|_| "Cannot update synchronization")?;
        if let Some(value) = receipt {
            tx.execute(
                "UPDATE receipts SET value=?1 WHERE id=?2 AND scope=?3",
                params![value.to_string(), id, target_scope],
            )
            .map_err(|_| "Cannot update receipt")?;
        }
        if status != "REGISTERED" {
            tx.execute("UPDATE outbox SET status=?1,error=?2,attempt_count=attempt_count+CASE WHEN ?1='SYNCING' THEN 1 ELSE 0 END,last_attempt=?3,next_attempt=CASE WHEN ?1='FAILED' THEN ?3+min(300000,5000*(1<<min(attempt_count,6))) ELSE 0 END WHERE id=?4 AND scope=?5",params![status,error,now(),id,target_scope]).map_err(|_|"Cannot update synchronization")?;
        }
        tx.execute("INSERT INTO cash_events(capture_id,state,details,created_at) SELECT id,?2,?3,?4 FROM cash_evidence WHERE id=?1",params![id,status,json!({"error":error}).to_string(),now()]).map_err(|_|"Cannot preserve synchronization history")?;
        if status == "SYNCED" {
            tx.execute("DELETE FROM reservations WHERE outbox_id=?1", [&id])
                .map_err(|_| "Cannot release reservations")?;
        }
        tx.commit().map_err(|_| "Cannot commit synchronization")?;
        if status == "SYNCED" {
            let _ = std::fs::remove_file(state.directory.join(format!("outbox-{id}.dpapi")));
        }
    }
    let mut stmt=db.prepare("SELECT id,type,payload,status,attempt_count,error,next_attempt FROM outbox WHERE (scope=?1 OR (?2 AND type='CASH_SALE' AND substr(scope,1,length(?3))=?3)) AND status!='SYNCED' ORDER BY created_at").map_err(|_|"Cannot read pending changes")?;
    let rows = stmt
        .query_map(params![scope, resolver, prefix], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, Option<String>>(5)?,
                r.get::<_, i64>(6)?,
            ))
        })
        .map_err(|_| "Cannot read pending changes")?;
    let mut result = vec![];
    for row in rows {
        let (id, kind, raw, status, attempts, error, next) =
            row.map_err(|_| "Cannot read pending changes")?;
        let mut payload: Value =
            serde_json::from_str(&raw).map_err(|_| "Cannot read queued change")?;
        let original = vault::load(&state.directory.join(format!("outbox-{id}.dpapi")));
        payload["grant"] = original
            .grant
            .map(|g| g["token"].clone())
            .unwrap_or(Value::Null);
        result.push(json!({"id":id,"type":kind,"payload":payload,"status":status,"attempts":attempts,"error":error,"nextAttempt":next}));
    }
    Ok(json!(result))
}
#[tauri::command]
pub fn desktop_receipts(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    let db = state.db.lock().map_err(|_| "Database unavailable")?;
    let mut s = db
        .prepare("SELECT value FROM receipts WHERE scope=?1 ORDER BY created_at DESC LIMIT 200")
        .map_err(|_| "Cannot read local receipts")?;
    let rows = s
        .query_map([scope], |r| r.get::<_, String>(0))
        .map_err(|_| "Cannot read local receipts")?;
    let mut result = vec![];
    for row in rows {
        result.push(
            serde_json::from_str::<Value>(&row.map_err(|_| "Cannot read a local receipt")?)
                .map_err(|_| "A receipt needs recovery; its stored record has been retained")?,
        );
    }
    Ok(json!(result))
}
