use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn sanitize_campaign_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Campaign name cannot be empty".to_string());
    }

    let mut sanitized = String::new();
    let mut last_dash = false;

    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            sanitized.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if (ch.is_whitespace() || ch == '.') && !last_dash {
            sanitized.push('-');
            last_dash = true;
        }
    }

    let sanitized = sanitized.trim_matches('-').to_string();
    if sanitized.is_empty() {
        return Err("Campaign name must contain letters or numbers".to_string());
    }

    if sanitized.len() > 80 {
        return Err("Campaign name is too long".to_string());
    }

    Ok(sanitized)
}

fn get_campaigns_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let campaigns_dir = app_data.join("campaigns");
    fs::create_dir_all(&campaigns_dir)
        .map_err(|e| format!("Failed to create campaigns dir: {}", e))?;
    Ok(campaigns_dir)
}

#[tauri::command]
pub async fn save_campaign(app: AppHandle, name: String, data: String) -> Result<(), String> {
    let campaigns_dir = get_campaigns_dir(&app)?;
    let safe_name = sanitize_campaign_name(&name)?;
    let file_path = campaigns_dir.join(format!("{}.json", safe_name));
    fs::write(&file_path, data).map_err(|e| format!("Failed to save campaign: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_campaign(app: AppHandle, name: String) -> Result<String, String> {
    let campaigns_dir = get_campaigns_dir(&app)?;
    let safe_name = sanitize_campaign_name(&name)?;
    let file_path = campaigns_dir.join(format!("{}.json", safe_name));
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to load campaign: {}", e))
}

#[tauri::command]
pub async fn list_campaigns(app: AppHandle) -> Result<Vec<String>, String> {
    let campaigns_dir = get_campaigns_dir(&app)?;

    if !campaigns_dir.exists() {
        return Ok(Vec::new());
    }

    let entries =
        fs::read_dir(&campaigns_dir).map_err(|e| format!("Failed to read campaigns dir: {}", e))?;

    let mut campaigns = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                campaigns.push(stem.to_string());
            }
        }
    }

    Ok(campaigns)
}

#[tauri::command]
pub async fn delete_campaign(app: AppHandle, name: String) -> Result<(), String> {
    let campaigns_dir = get_campaigns_dir(&app)?;
    let safe_name = sanitize_campaign_name(&name)?;
    let file_path = campaigns_dir.join(format!("{}.json", safe_name));
    fs::remove_file(&file_path).map_err(|e| format!("Failed to delete campaign: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::sanitize_campaign_name;

    #[test]
    fn campaign_name_allows_basic_characters() {
        let name = sanitize_campaign_name("my_campaign-01").unwrap();
        assert_eq!(name, "my_campaign-01");
    }

    #[test]
    fn campaign_name_normalizes_spaces_and_case() {
        let name = sanitize_campaign_name("  My Campaign Name  ").unwrap();
        assert_eq!(name, "my-campaign-name");
    }

    #[test]
    fn campaign_name_rejects_empty_values() {
        assert!(sanitize_campaign_name("   ").is_err());
    }
}
