use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub setup_complete: bool,
    pub selected_model: String,
    pub first_launch: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            setup_complete: false,
            selected_model: "mistral".to_string(),
            first_launch: true,
        }
    }
}

pub fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_data).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_data.join("config.json"))
}

pub fn load_config(app: &AppHandle) -> Result<AppConfig, String> {
    let path = get_config_path(app)?;
    if path.exists() {
        let content =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
    } else {
        let config = AppConfig::default();
        save_config(app, &config)?;
        Ok(config)
    }
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_config_path(app)?;
    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<String, String> {
    let config = load_config(&app)?;
    serde_json::to_string(&config).map_err(|e| format!("Failed to serialize config: {}", e))
}

#[tauri::command]
pub async fn update_config(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let mut config = load_config(&app)?;

    match key.as_str() {
        "setup_complete" => {
            config.setup_complete = value
                .parse::<bool>()
                .map_err(|e| format!("Invalid bool value: {}", e))?;
        }
        "selected_model" => {
            config.selected_model = value;
        }
        "first_launch" => {
            config.first_launch = value
                .parse::<bool>()
                .map_err(|e| format!("Invalid bool value: {}", e))?;
        }
        _ => return Err(format!("Unknown config key: {}", key)),
    }

    save_config(&app, &config)?;
    Ok(())
}
