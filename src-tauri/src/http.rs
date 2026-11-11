use crate::{
    desktop::{main_only, Desktop},
    vault,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::WebviewWindow;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: String,
    timeout: u64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Response {
    status: u16,
    body: String,
    content_type: String,
}
#[tauri::command]
pub async fn desktop_http(
    window: WebviewWindow,
    state: tauri::State<'_, Desktop>,
    request: Request,
) -> Result<Response, String> {
    main_only(&window)?;
    let url = url::Url::parse(&request.url).map_err(|_| "Invalid shop request")?;
    let backend = state
        .backend
        .lock()
        .map_err(|_| "Configuration unavailable")?
        .clone();
    // No arbitrary-origin requests, redirects, caller-provided cookies or refresh tokens.
    let configured = url::Url::parse(&backend)
        .map_err(|_| "The owner must configure the shop backend before signing in.")?;
    let bridge = state
        .bridge
        .lock()
        .map_err(|_| "Configuration unavailable")?
        .clone();
    let bridge = url::Url::parse(&bridge).ok();
    let cloud = url.origin() == configured.origin();
    if !cloud && !bridge.as_ref().is_some_and(|b| url.origin() == b.origin()) {
        return Err("This address is not the configured shop connection.".into());
    }
    if url.scheme() != "https" && cloud && !cfg!(debug_assertions) {
        return Err("This release requires HTTPS.".into());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_millis(
            request.timeout.clamp(1000, 30000),
        ))
        .build()
        .map_err(|_| "Cannot initialize shop connection")?;
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| "Invalid shop operation")?;
    let origin = url.origin().ascii_serialization();
    let mut req = client
        .request(method, url.clone())
        .header("Origin", "tauri://localhost");
    for (k, v) in &request.headers {
        if ["authorization", "content-type", "x-counter-session"]
            .contains(&k.to_lowercase().as_str())
        {
            req = req.header(k, v);
        }
    }
    if url.path().starts_with("/api/v1/auth/") {
        if let Some(cookie) = state
            .vault
            .lock()
            .map_err(|_| "Session unavailable")?
            .cookies
            .get(&origin)
        {
            req = req.header("Cookie", cookie);
        }
    }
    if !request.body.is_empty() {
        req = req.body(
            STANDARD
                .decode(request.body)
                .map_err(|_| "Invalid request body")?,
        );
    }
    let response = req
        .send()
        .await
        .map_err(|_| "Cannot reach the shop server. Check the connection and retry.")?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    let cookies = response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "The server response was interrupted")?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err("The server response is too large.".into());
    }
    {
        let mut v = state.vault.lock().map_err(|_| "Session unavailable")?;
        for cookie in cookies {
            if let Some(pair) = cookie
                .split(';')
                .next()
                .filter(|s| s.starts_with("taha_refresh="))
            {
                if pair == "taha_refresh=" {
                    v.cookies.remove(&origin);
                } else {
                    v.cookies.insert(origin.clone(), pair.to_string());
                }
            }
        }
        if cloud {
            if let Ok(body) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                if (200..300).contains(&status) {
                    if url.path().ends_with("/offline-grant") {
                        v.context = Some(body["context"].clone());
                        v.grant = Some(body);
                    } else if url.path().ends_with("/auth/session") {
                        v.context = Some(body);
                    } else if body.get("context").is_some() {
                        if v.context.as_ref().and_then(|c| c["profile"]["id"].as_str())
                            != body["context"]["profile"]["id"].as_str()
                        {
                            v.grant = None;
                        }
                        v.context = Some(body["context"].clone());
                    }
                } else if [401, 403].contains(&status) && url.path().ends_with("/auth/refresh") {
                    v.context = None;
                    v.grant = None;
                    v.cookies.remove(&origin);
                }
            }
            if v.grant.as_ref().is_some_and(|g| {
                !crate::desktop::same_access(
                    &g["context"],
                    v.context.as_ref().unwrap_or(&serde_json::Value::Null),
                )
            }) {
                v.grant = None;
            }
        }
        vault::save(&state.directory.join("session.dpapi"), &v)?;
    }
    Ok(Response {
        status,
        body: STANDARD.encode(bytes),
        content_type,
    })
}
