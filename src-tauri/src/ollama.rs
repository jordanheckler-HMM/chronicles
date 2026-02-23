use crate::config;
use futures_util::StreamExt;
use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
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

fn parse_models_from_tags(body: TagsResponse) -> Vec<String> {
    body.models
        .unwrap_or_default()
        .into_iter()
        .filter_map(|m| m.name.or(m.model))
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect()
}

fn parse_models_from_ollama_list_output(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .skip(1) // Skip header line
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            // First column is the model name.
            trimmed.split_whitespace().next().map(|s| s.trim().to_string())
        })
        .filter(|name| !name.is_empty() && name != "NAME")
        .collect()
}

fn merge_models<I>(sources: I) -> Vec<String>
where
    I: IntoIterator<Item = Vec<String>>,
{
    let mut merged: BTreeSet<String> = BTreeSet::new();
    for models in sources {
        for model in models {
            merged.insert(model);
        }
    }
    merged.into_iter().collect()
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

                let models = parse_models_from_tags(body);

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
    let mut sources: Vec<Vec<String>> = Vec::new();
    let mut had_error = false;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(response) if response.status().is_success() => {
            let body: TagsResponse = response
                .json()
                .await
                .unwrap_or(TagsResponse { models: None });
            sources.push(parse_models_from_tags(body));
        }
        _ => {
            had_error = true;
        }
    }

    match Command::new("ollama").arg("list").output().await {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            sources.push(parse_models_from_ollama_list_output(&stdout));
        }
        _ => {
            had_error = true;
        }
    }

    let models = merge_models(sources);

    if models.is_empty() && had_error {
        return Err("Failed to list Ollama models".to_string());
    }

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

#[cfg(test)]
mod tests {
    use super::{merge_models, parse_models_from_ollama_list_output, parse_models_from_tags, TagModel, TagsResponse};

    #[test]
    fn parse_ollama_list_output_extracts_model_names() {
        let output = "NAME                     ID              SIZE      MODIFIED\nmistral:latest           abc123          4.1 GB    2 days ago\nllama3.1:8b              def456          4.9 GB    1 day ago\n";
        let models = parse_models_from_ollama_list_output(output);
        assert_eq!(models, vec!["mistral:latest", "llama3.1:8b"]);
    }

    #[test]
    fn parse_tags_extracts_name_or_model_field() {
        let tags = TagsResponse {
            models: Some(vec![
                TagModel {
                    name: Some("gemma3:4b".to_string()),
                    model: None,
                },
                TagModel {
                    name: None,
                    model: Some("deepseek-r1:8b".to_string()),
                },
            ]),
        };
        let models = parse_models_from_tags(tags);
        assert_eq!(models, vec!["gemma3:4b", "deepseek-r1:8b"]);
    }

    #[test]
    fn merge_models_dedupes_and_sorts() {
        let merged = merge_models(vec![
            vec!["mistral:latest".to_string(), "llama3.1:8b".to_string()],
            vec!["llama3.1:8b".to_string(), "gemma3:4b".to_string()],
        ]);
        assert_eq!(merged, vec!["gemma3:4b", "llama3.1:8b", "mistral:latest"]);
    }
}
