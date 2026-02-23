use crate::config;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Check if Ollama CLI is installed on the system.
async fn check_ollama_installed() -> bool {
    match Command::new("ollama").arg("--version").output().await {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// Check if a specific model is already pulled in Ollama.
async fn check_model_exists(model: &str) -> bool {
    match Command::new("ollama").arg("list").output().await {
        Ok(output) => {
            if !output.status.success() {
                return false;
            }
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Check if any line starts with the model name
            stdout.lines().any(|line| {
                line.split_whitespace()
                    .next()
                    .map(|name| name.starts_with(model))
                    .unwrap_or(false)
            })
        }
        Err(_) => false,
    }
}

/// Parse download progress from Ollama pull output.
/// Ollama outputs lines like: "pulling abc123... 45% ▕████          ▏  1.2 GB/2.7 GB"
fn parse_progress(line: &str) -> Option<u8> {
    // Look for a percentage pattern like "45%"
    for word in line.split_whitespace() {
        if let Some(pct_str) = word.strip_suffix('%') {
            if let Ok(pct) = pct_str.parse::<u8>() {
                return Some(pct.min(100));
            }
        }
    }
    None
}

/// Run the first-launch setup flow.
/// This checks for Ollama, downloads the default model, and emits events
/// to the frontend to display setup progress.
pub async fn run_setup(app: AppHandle) {
    // Load config — skip setup if already complete
    let cfg = match config::load_config(&app) {
        Ok(c) => c,
        Err(e) => {
            log::error!("Failed to load config during setup: {}", e);
            return;
        }
    };

    if cfg.setup_complete {
        return;
    }

    // Step 1: Check if Ollama is installed
    if !check_ollama_installed().await {
        let _ = app.emit(
            "setup-required",
            serde_json::json!({ "step": "ollama-not-found" }),
        );

        // Poll every 3 seconds until Ollama is detected
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            if check_ollama_installed().await {
                break;
            }
        }
    }

    // Step 2: Check if the default model is present
    let default_model = "mistral";

    if !check_model_exists(default_model).await {
        let _ = app.emit(
            "setup-required",
            serde_json::json!({ "step": "model-downloading", "progress": 0 }),
        );

        // Spawn `ollama pull` and stream its output
        let mut child = match Command::new("ollama")
            .arg("pull")
            .arg(default_model)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                log::error!("Failed to spawn ollama pull: {}", e);
                let _ = app.emit(
                    "setup-required",
                    serde_json::json!({ "step": "setup-error", "message": format!("Failed to download model: {}", e) }),
                );
                return;
            }
        };

        // Read stderr for progress (ollama outputs progress to stderr)
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            let mut last_progress: u8 = 0;

            while let Ok(Some(line)) = lines.next_line().await {
                if let Some(pct) = parse_progress(&line) {
                    // Only emit if progress actually changed
                    if pct != last_progress {
                        last_progress = pct;
                        let _ = app.emit(
                            "setup-required",
                            serde_json::json!({ "step": "model-downloading", "progress": pct }),
                        );
                    }
                }
            }
        }

        // Wait for the process to finish
        match child.wait().await {
            Ok(status) => {
                if !status.success() {
                    log::error!("ollama pull exited with status: {}", status);
                    let _ = app.emit(
                        "setup-required",
                        serde_json::json!({ "step": "setup-error", "message": "Model download failed" }),
                    );
                    return;
                }
            }
            Err(e) => {
                log::error!("Failed to wait for ollama pull: {}", e);
                return;
            }
        }
    }

    // Step 3: Mark setup as complete
    let _ = app.emit(
        "setup-required",
        serde_json::json!({ "step": "setup-complete" }),
    );

    // Update config
    if let Ok(mut cfg) = config::load_config(&app) {
        cfg.setup_complete = true;
        cfg.first_launch = false;
        let _ = config::save_config(&app, &cfg);
    }
}
