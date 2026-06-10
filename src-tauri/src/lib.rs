// QuickMemo — fast menu-bar note capture (Tauri v2, macOS).
//
// The window is converted into a non-activating floating NSPanel via
// tauri-nspanel so it can: (a) take keyboard focus without activating the app
// (no Space switch), and (b) appear over other apps' full-screen spaces.
// Note CRUD + the shortcut recorder live in the frontend.

use std::sync::Mutex;
use std::time::Instant;

use objc2_app_kit::{NSColor, NSWindowCollectionBehavior, NSWindowStyleMask};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_nspanel::{tauri_panel, ManagerExt, WebviewWindowExt};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_sql::{Migration, MigrationKind};

/// `NSPopUpMenuWindowLevel` — above normal windows and full-screen content.
const PANEL_LEVEL: i64 = 101;

// A non-activating, floating panel that can become the key window.
tauri_panel! {
    panel!(QuickMemoPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

/// Guards the tray-click / blur-hide race (see `toggle_from_tray`).
struct AppState {
    last_hidden: Mutex<Option<Instant>>,
}

fn is_visible(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

fn show_panel(app: &AppHandle) {
    if let Ok(panel) = app.get_webview_panel("main") {
        panel.show_and_make_key();
    }
}

fn hide_panel(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        *state.last_hidden.lock().unwrap() = Some(Instant::now());
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

/// Reveal the panel and tell the frontend to show the capture input.
fn trigger_capture(app: &AppHandle) {
    show_panel(app);
    let _ = app.emit("focus-capture", ());
}

/// Left-click toggle with a 250 ms guard so the blur fired when clicking the
/// tray to dismiss doesn't immediately re-open the panel.
fn toggle_from_tray(app: &AppHandle) {
    let recently_hidden = app
        .try_state::<AppState>()
        .map(|s| {
            s.last_hidden
                .lock()
                .unwrap()
                .map_or(false, |t| t.elapsed().as_millis() < 250)
        })
        .unwrap_or(false);

    if is_visible(app) {
        hide_panel(app);
    } else if !recently_hidden {
        trigger_capture(app);
    }
}

/// Rebind the global shortcut at runtime (called by the Settings recorder).
#[tauri::command]
fn set_shortcut(app: AppHandle, accelerator: String) -> Result<(), String> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    gs.on_shortcut(accelerator.as_str(), |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            trigger_capture(app);
        }
    })
    .map_err(|err| err.to_string())
}

/// Quit the app (exposed as a command so it's reachable from the search surface).
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Write the notes (rendered as Markdown by the frontend) to ~/Downloads.
#[tauri::command]
fn export_markdown(app: AppHandle, content: String) -> Result<String, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let path = dir.join("QuickMemo Notes.md");
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create notes table",
        sql: "CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                archived_at INTEGER
              );
              CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_nspanel::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:quickmemo.db", migrations)
                .build(),
        )
        .manage(AppState {
            last_hidden: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            set_shortcut,
            export_markdown,
            quit_app
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();

            // Convert the main window into a floating, non-activating panel that
            // overlays full-screen spaces.
            if let Some(win) = handle.get_webview_window("main") {
                if let Ok(panel) = win.to_panel::<QuickMemoPanel>() {
                    panel.set_level(PANEL_LEVEL);
                    panel.set_collection_behavior(
                        NSWindowCollectionBehavior::CanJoinAllSpaces
                            | NSWindowCollectionBehavior::FullScreenAuxiliary
                            | NSWindowCollectionBehavior::Stationary,
                    );
                    // Non-activating: take key focus WITHOUT activating the app,
                    // so showing over another app's full-screen space does not
                    // kick the user out of that Space.
                    panel.set_style_mask(NSWindowStyleMask::NonactivatingPanel);
                }

                // Fully transparent panel so the floating pill + circle buttons
                // sit directly on the desktop (gaps between them show through).
                if let Ok(ns_window) = win.ns_window() {
                    unsafe {
                        let w: &NSWindow = &*(ns_window as *const NSWindow);
                        w.setOpaque(false);
                        w.setBackgroundColor(Some(&NSColor::clearColor()));
                    }
                }

                // Popover behaviour: hide when the panel loses focus.
                let win_for_event = win.clone();
                win.on_window_event(move |event| {
                    if let WindowEvent::Focused(false) = event {
                        hide_panel(win_for_event.app_handle());
                    }
                });
            }

            // Tray menu
            let new_i = MenuItem::with_id(&handle, "new", "New Note", true, None::<&str>)?;
            let notes_i = MenuItem::with_id(&handle, "notes", "Show Notes", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(&handle, "settings", "Settings…", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(&handle, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(&handle, &[&new_i, &notes_i, &settings_i, &quit_i])?;

            // Monochrome template glyph adapts to light/dark menu bars.
            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))
                .expect("tray icon");

            TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("QuickMemo")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "new" => trigger_capture(app),
                    "notes" => {
                        show_panel(app);
                        let _ = app.emit("show-notes", ());
                    }
                    "settings" => {
                        show_panel(app);
                        let _ = app.emit("open-settings", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_from_tray(tray.app_handle());
                    }
                })
                .build(&handle)?;

            // Default global shortcut (⌘⇧M); frontend re-registers any custom one.
            let _ = handle.global_shortcut().on_shortcut(
                "Command+Shift+M",
                |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        trigger_capture(app);
                    }
                },
            );

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
