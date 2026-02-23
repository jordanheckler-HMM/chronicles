use crate::config;
use futures_util::StreamExt;
use reqwest;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

// ─── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatStreamChunk {
    message: Option<ChunkMessage>,
    done: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChunkMessage {
    role: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub running: bool,
    pub models: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TagsResponse {
    models: Option<Vec<TagModel>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TagModel {
    name: Option<String>,
    model: Option<String>,
}

// ─── Chat command ────────────────────────────────────────────────────

#[tauri::command]
pub async fn chat(app: AppHandle, model: String, messages: Vec<ChatMessage>) -> Result<(), String> {
    let client = reqwest::Client::new();

    let request_body = ChatRequest {
        model,
        messages,
        stream: true,
    };

    let response = client
        .post("http://localhost:11434/api/chat")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let msg = if e.is_connect() {
                "Ollama is not running. Please start Ollama and try again.".to_string()
            } else {
                format!("Failed to connect to Ollama: {}", e)
            };
            let _ = app.emit("chat-error", serde_json::json!({ "message": msg }));
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = format!("Ollama returned error {}: {}", status, body);
        let _ = app.emit("chat-error", serde_json::json!({ "message": msg }));
        return Err(msg);
    }

    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                // Ollama returns newline-delimited JSON
                for line in text.lines() {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<ChatStreamChunk>(line) {
                        Ok(chunk) => {
                            if let Some(msg) = &chunk.message {
                                if let Some(content) = &msg.content {
                                    if !content.is_empty() {
                                        let _ = app.emit(
                                            "chat-token",
                                            serde_json::json!({ "token": content }),
                                        );
                                    }
                                }
                            }
                            if chunk.done == Some(true) {
                                let _ = app.emit("chat-done", serde_json::json!({}));
                                return Ok(());
                            }
                        }
                        Err(_) => {
                            // Skip malformed lines
                            continue;
                        }
                    }
                }
            }
            Err(e) => {
                let msg = format!("Stream error: {}", e);
                let _ = app.emit("chat-error", serde_json::json!({ "message": msg }));
                return Err(msg);
            }
        }
    }

    // Stream ended without done=true, emit done anyway
    let _ = app.emit("chat-done", serde_json::json!({}));
    Ok(())
}

// ─── Health check ────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_ollama_status() -> Result<OllamaStatus, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(response) => {
            if response.status().is_success() {
                let body: TagsResponse = response
                    .json()
                    .await
                    .unwrap_or(TagsResponse { models: None });

                let models = body
                    .models
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|m| m.name.or(m.model))
                    .collect();

                Ok(OllamaStatus {
                    running: true,
                    models,
                })
            } else {
                Ok(OllamaStatus {
                    running: false,
                    models: vec![],
                })
            }
        }
        Err(_) => Ok(OllamaStatus {
            running: false,
            models: vec![],
        }),
    }
}

// ─── Model management ────────────────────────────────────────────────

#[tauri::command]
pub async fn get_available_models() -> Result<Vec<String>, String> {
    let output = Command::new("ollama")
        .arg("list")
        .output()
        .await
        .map_err(|e| format!("Failed to run 'ollama list': {}", e))?;

    if !output.status.success() {
        return Err("Failed to list Ollama models".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let models: Vec<String> = stdout
        .lines()
        .skip(1) // Skip header line
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            // First column is the model name
            trimmed.split_whitespace().next().map(|s| s.to_string())
        })
        .collect();

    Ok(models)
}

#[tauri::command]
pub async fn get_selected_model(app: AppHandle) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    Ok(cfg.selected_model)
}

#[tauri::command]
pub async fn set_selected_model(app: AppHandle, model_name: String) -> Result<(), String> {
    let mut cfg = config::load_config(&app)?;
    cfg.selected_model = model_name;
    config::save_config(&app, &cfg)?;
    Ok(())
}
