#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Window;

mod sidecar;

#[tauri::command]
fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn maximize_window(window: Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_always_on_top(window: Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_size(window: Window, width: f64, height: f64) -> Result<(), String> {
    use tauri::LogicalSize;
    window.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_window_size(window: Window) -> Result<(f64, f64), String> {
    let size = window.inner_size().map_err(|e| e.to_string())?;
    Ok((size.width as f64, size.height as f64))
}

#[tauri::command]
fn create_window(
    app: tauri::AppHandle,
    label: String,
    title: String,
    url: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    use tauri::WebviewUrl;
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        label,
        WebviewUrl::App(url.into()),
    )
    .title(title)
    .inner_size(width, height)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;
    
    window.show().map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = sidecar::start_tailscale(&handle).await {
                    eprintln!("Error starting Tailscale sidecar: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            maximize_window,
            close_window,
            set_always_on_top,
            set_window_size,
            get_window_size,
            create_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


