use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tauri::{AppHandle, Manager};
use std::env;
use dotenv::{dotenv, from_path};

pub async fn start_tailscale(app: &AppHandle) -> Result<(), String> {
    dotenv().ok();
    // Tauri suele ejecutar desde src-tauri; cargar tambien ../.env (apps/desktop/.env).
    from_path("../.env").ok();
    
    let auth_key = env::var("TAILSCALE_AUTH_KEY")
        .map_err(|_| "TAILSCALE_AUTH_KEY not found (set env var or apps/desktop/.env)".to_string())?;
    
    // Directorios para estado y socket aislados
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let ts_dir = app_data.join("tailscale");
    tokio::fs::create_dir_all(&ts_dir).await.map_err(|e| format!("Failed to create tailscale dir: {}", e))?;
    
    let state_file = ts_dir.join("tailscaled.state");
    let socket_file = ts_dir.join("tailscaled.sock");
    
    println!("Iniciando tailscaled con socket en: {:?}", socket_file);

    let sidecar_command = app.shell().sidecar("tailscaled")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--tun=userspace-networking", 
            "--socks5-server=localhost:1055",
            "--state", state_file.to_str().unwrap(),
            "--socket", socket_file.to_str().unwrap(),
        ]);

    let (mut rx, mut _child) = sidecar_command.spawn()
        .map_err(|e| format!("Failed to spawn tailscaled sidecar: {}", e))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => println!("tailscaled: {}", String::from_utf8_lossy(&line)),
                CommandEvent::Stderr(line) => eprintln!("tailscaled err: {}", String::from_utf8_lossy(&line)),
                CommandEvent::Terminated(payload) => println!("tailscaled terminated: {:?}", payload),
                _ => {}
            }
        }
    });

    // Esperar a que el socket aparezca
    let mut attempts = 0;
    while !socket_file.exists() && attempts < 10 {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        attempts += 1;
    }

    if !socket_file.exists() {
        return Err("Tailscaled socket was not created in time".into());
    }

    println!("Tailscaled socket detectado, procediendo al login...");

    // Ejecutar Tailscale Up usando el binario CLI 'tailscale'
    let login_command = app.shell().sidecar("tailscale")
        .map_err(|e| format!("Failed to create tailscale CLI sidecar command: {}", e))?
        .args([
            "--socket", socket_file.to_str().unwrap(),
            "up", 
            "--authkey", &auth_key, 
            "--hostname", "la-caja-desktop-client",
            "--accept-routes",
        ]);

    let output = login_command.output().await
        .map_err(|e| format!("Failed to execute tailscale up: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Tailscale login failed (exit {}): {}", output.status.code().unwrap_or(-1), err_msg));
    }

    println!("Tailscale conectado correctamente vía sidecar");
    
    // Iniciar el proxy local en segundo plano
    let server_ip = env::var("TAILSCALE_SERVER_IP").unwrap_or_else(|_| "100.109.89.122".to_string());
    let server_port = env::var("TAILSCALE_SERVER_PORT").unwrap_or_else(|_| "3000".to_string());
    
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_proxy("127.0.0.1:3001", &format!("{}:{}", server_ip, server_port)).await {
            eprintln!("Error en el proxy de Tailscale: {}", e);
        }
    });

    Ok(())
}

async fn run_proxy(local_addr: &str, remote_addr: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let listener = tokio::net::TcpListener::bind(local_addr).await?;
    println!("Proxy de Tailscale escuchando en http://{}", local_addr);

    loop {
        let (mut client_stream, _) = listener.accept().await?;
        let remote_addr_str = remote_addr.to_string();

        tokio::spawn(async move {
            // Conectar al servidor vía el proxy SOCKS5 de Tailscale
            match tokio_socks::tcp::Socks5Stream::connect("127.0.0.1:1055", remote_addr_str.as_str()).await {
                Ok(mut remote_stream) => {
                    if let Err(e) = tokio::io::copy_bidirectional(&mut client_stream, &mut remote_stream).await {
                        eprintln!("Error de transferencia en el proxy: {}", e);
                    }
                }
                Err(e) => {
                    eprintln!("Error conectando al servidor remoto vía SOCKS5: {}", e);
                }
            }
        });
    }
}
