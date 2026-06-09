//! macOS-specific window tweaks.
//!
//! Makes the popover window float above other applications' full-screen
//! spaces (the way Spotlight / Raycast windows appear over any space),
//! instead of being trapped on the app's own desktop.

use std::ffi::c_void;

use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};

/// `NSPopUpMenuWindowLevel` — above normal windows and full-screen content.
const POPUP_MENU_WINDOW_LEVEL: isize = 101;

/// Configure the given `NSWindow` pointer to overlay full-screen spaces.
pub fn enable_fullscreen_overlay(ns_window: *mut c_void) {
    if ns_window.is_null() {
        return;
    }

    // Safety: Tauri hands us a valid NSWindow pointer for the main window,
    // and we only touch it on the main thread (during setup / show).
    let window: &NSWindow = unsafe { &*(ns_window as *const NSWindow) };

    let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
        | NSWindowCollectionBehavior::FullScreenAuxiliary
        | NSWindowCollectionBehavior::Stationary;

    window.setCollectionBehavior(behavior);
    window.setLevel(POPUP_MENU_WINDOW_LEVEL);
}
