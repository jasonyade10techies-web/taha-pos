use tauri::Manager;
mod bridge_config;
mod cash;
mod desktop;
mod http;
mod images;
mod outbox;
mod vault;
#[cfg(all(debug_assertions, any(target_os = "windows", target_os = "linux")))]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .with_denylist(&["splash"])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            images::desktop_image,
            bridge_config::desktop_bridge_config,
            desktop::desktop_init,
            desktop::desktop_ready,
            desktop::desktop_cache,
            desktop::desktop_draft,
            desktop::desktop_offline_context,
            desktop::desktop_clear_session,
            desktop::desktop_backend,
            desktop::desktop_display,
            desktop::desktop_display_state,
            http::desktop_http,
            outbox::desktop_queue_sale,
            outbox::desktop_outbox,
            outbox::desktop_receipts,
            cash::desktop_cash_records,
            cash::desktop_cash_backlog,
            cash::desktop_cash_resolution
        ])
        .setup(|app| {
            match desktop::Desktop::open(app.handle()) {
                Ok(state) => {
                    app.manage(state);
                }
                Err(error) => {
                    app.manage(desktop::StartupError(error));
                }
            }
            // A frontend startup failure must not strand the hidden main window.
            let recovery = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(8));
                if recovery.get_webview_window("splash").is_some() {
                    if let Some(main) = recovery.get_webview_window("main") {
                        let _ = main.show();
                    }
                    if let Some(splash) = recovery.get_webview_window("splash") {
                        let _ = splash.close();
                    }
                }
            });
            #[cfg(all(debug_assertions, any(target_os = "windows", target_os = "linux")))]
            app.deep_link().register_all()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Unable to start Taha POS");
}
