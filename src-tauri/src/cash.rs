use crate::{
    desktop::{main_only, now, Desktop},
    outbox::{can_reconcile, shop_prefix},
};
use rusqlite::params;
use serde_json::{json, Value};
use tauri::WebviewWindow;
#[tauri::command]
pub fn desktop_cash_backlog(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    {
        let v = state.vault.lock().map_err(|_| "Session unavailable")?;
        let c = v.context.as_ref().ok_or("Sign in to review closing")?;
        if c["profile"]["role"] != "owner"
            && !c["permissions"]
                .as_array()
                .is_some_and(|p| p.iter().any(|k| k == "shifts.manage"))
        {
            return Err("Shift closing permission required".into());
        }
    }
    let prefix = shop_prefix(&scope)?;
    let db = state.db.lock().map_err(|_| "Database unavailable")?;
    let mut q = db
        .prepare(include_str!("../sql/list-cash-backlog.sql"))
        .map_err(|_| "Cannot check retained cash before closing")?;
    let rows = q
        .query_map([prefix], |r| r.get::<_, String>(0))
        .map_err(|_| "Cannot read retained cash")?;
    let mut result = vec![];
    for row in rows {
        result.push(
            serde_json::from_str::<Value>(&row.map_err(|_| "Cash closing check failed")?)
                .map_err(|_| "Cash closing check failed")?,
        );
    }
    Ok(json!(result))
}

#[tauri::command]
pub fn desktop_cash_records(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
) -> Result<Value, String> {
    main_only(&window)?;
    state.scope(&scope)?;
    let resolver = can_reconcile(&state)?;
    let prefix = shop_prefix(&scope)?;
    let db = state.db.lock().map_err(|_| "Database unavailable")?;
    let mut stmt = db
        .prepare(include_str!("../sql/list-cash-records.sql"))
        .map_err(|_| "Cannot read collected cash")?;
    let rows = stmt
        .query_map(params![scope, resolver, prefix], |r| r.get::<_, String>(0))
        .map_err(|_| "Cannot read collected cash")?;
    let mut result = vec![];
    for row in rows {
        result.push(
            serde_json::from_str::<Value>(&row.map_err(|_| "Cash record needs recovery")?)
                .map_err(|_| "Cash record needs recovery")?,
        );
    }
    Ok(json!(result))
}
#[tauri::command]
pub fn desktop_cash_resolution(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    scope: String,
    id: String,
    resolution: Value,
) -> Result<(), String> {
    main_only(&window)?;
    state.scope(&scope)?;
    if !can_reconcile(&state)? {
        return Err("Owner or authorized manager required".into());
    }
    let prefix = shop_prefix(&scope)?;
    let kind = resolution["state"]
        .as_str()
        .ok_or("Missing server decision")?;
    if kind != "POSTED" && kind != "REFUNDED" {
        return Err("The server has not resolved this cash record".into());
    }
    let mut db = state.db.lock().map_err(|_| "Database unavailable")?;
    let tx = db
        .transaction()
        .map_err(|_| "Cannot preserve cash decision")?;
    let target: String = tx
        .query_row(
            "SELECT scope FROM cash_evidence WHERE id=?1 AND substr(scope,1,length(?2))=?2",
            params![id, prefix],
            |r| r.get(0),
        )
        .map_err(|_| "Cash record is not from this shop")?;
    let actor = state
        .vault
        .lock()
        .map_err(|_| "Session unavailable")?
        .context
        .as_ref()
        .map(|c| c["profile"]["id"].clone())
        .unwrap_or(Value::Null);
    tx.execute(
        include_str!("../sql/record-cash-decision.sql"),
        params![id, kind, actor.as_str(), resolution.to_string(), now()],
    )
    .map_err(|_| "Cannot preserve owner decision")?;
    if kind == "POSTED" && resolution["sale"].is_object() {
        let mut sale = resolution["sale"].clone();
        sale["offlineId"] = json!(id);
        sale["syncStatus"] = json!("SYNCED");
        tx.execute(
            "UPDATE receipts SET value=?1 WHERE id=?2 AND scope=?3",
            params![sale.to_string(), id, target],
        )
        .map_err(|_| "Cannot cache posted receipt")?;
    }
    if kind == "REFUNDED" {
        tx.execute("UPDATE receipts SET value=json_set(value,'$.syncStatus','REFUNDED','$.offlineResolution',json(?1)) WHERE id=?2 AND scope=?3",params![resolution.to_string(),id,target]).map_err(|_|"Cannot retain refunded receipt status")?;
    }
    tx.execute(
        "UPDATE outbox SET status='SYNCED',error=NULL WHERE id=?1 AND scope=?2",
        params![id, target],
    )
    .map_err(|_| "Cannot acknowledge resolution")?;
    tx.execute("DELETE FROM reservations WHERE outbox_id=?1", [&id])
        .map_err(|_| "Cannot release pending reservation")?;
    tx.commit().map_err(|_| "Cannot commit cash resolution")?;
    let _ = std::fs::remove_file(state.directory.join(format!("outbox-{id}.dpapi")));
    Ok(())
}
