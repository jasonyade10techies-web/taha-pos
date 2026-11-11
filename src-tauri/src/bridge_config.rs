use crate::desktop::{main_only, Desktop};
use tauri::WebviewWindow;
#[tauri::command]
pub fn desktop_bridge_config(
    window: WebviewWindow,
    state: tauri::State<Desktop>,
    address: String,
    confirmed: bool,
) -> Result<(), String> {
    main_only(&window)?;
    if !confirmed
        || state
            .vault
            .lock()
            .map_err(|_| "Session unavailable")?
            .context
            .as_ref()
            .and_then(|c| c["profile"]["role"].as_str())
            != Some("owner")
    {
        return Err("The owner must confirm a local bridge change.".into());
    }
    let result = if address.trim().is_empty() {
        String::new()
    } else {
        let u = url::Url::parse(address.trim()).map_err(|_| "Enter the local bridge address")?;
        let local = u
            .host_str()
            .and_then(|v| v.parse::<std::net::Ipv4Addr>().ok())
            .is_some_and(|ip| ip.is_private() || ip.is_loopback())
            || u.host_str() == Some("localhost");
        if !local
            || !matches!(u.scheme(), "http" | "https")
            || !u.username().is_empty()
            || u.password().is_some()
            || u.query().is_some()
            || u.fragment().is_some()
            || !matches!(u.path(), "/" | "/api/v1" | "/api/v1/")
        {
            return Err("Use the private LAN bridge address. Cloud connections use the HTTPS backend setting.".into());
        }
        format!("{}/api/v1", u.origin().ascii_serialization())
    };
    std::fs::write(state.directory.join("bridge.txt"), &result)
        .map_err(|_| "Cannot save local bridge")?;
    *state
        .bridge
        .lock()
        .map_err(|_| "Configuration unavailable")? = result;
    Ok(())
}
