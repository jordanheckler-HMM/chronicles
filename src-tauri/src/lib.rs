mod campaign;
mod config;
mod ollama;
mod setup;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Spawn the first-launch setup flow on a background task
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                setup::run_setup(handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Config
            config::get_config,
            config::update_config,
            // Ollama
            ollama::chat,
            ollama::check_ollama_status,
            ollama::get_available_models,
            ollama::get_selected_model,
            ollama::set_selected_model,
            // Campaigns
            campaign::save_campaign,
            campaign::load_campaign,
            campaign::list_campaigns,
            campaign::delete_campaign,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
