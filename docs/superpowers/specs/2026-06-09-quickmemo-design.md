# QuickMemo — Design Spec

**Date:** 2026-06-09
**Status:** Implemented (v0.1.0)

## Goal

Native-feeling macOS menu-bar app for fast, independent note capture. No Dock
icon. Click the menu-bar icon (or press a global shortcut) → small box → type →
`↵` to save. Notes grouped by day, archivable. Optional launch-at-login.

## Stack

- **Tauri v2** (Rust core + system webview), vanilla TypeScript frontend, Vite, bun.
- Distribution: **Homebrew cask** (no App Store).
- Dependency-light: official Tauri plugins only.

## Decisions

| Topic | Choice | Why |
|-------|--------|-----|
| Menu-bar surface | AppKit-level tray via Tauri `TrayIconBuilder` | programmatic show/hide; shortcut + click share one window |
| No Dock | `ActivationPolicy::Accessory` (macOS) + `LSUIElement` implied | agent app, menu-bar only |
| Storage | SQLite via `tauri-plugin-sql` | day grouping + archive flag; scales |
| Global hotkey | `tauri-plugin-global-shortcut`, single chord, configurable, default `⌘⇧M` | zero permission, reliable; recorder UI in Settings |
| Double-tap `⌘M⌘M` | **deferred** | needs raw key monitor (rdev) + Accessibility permission |
| Browse/archive | single popover window: capture field + day-grouped list + archived toggle | lightweight, one surface |
| Launch at login | `tauri-plugin-autostart` (LaunchAgent) | native, toggle in Settings |

## Architecture

```
Tray icon ─ click ─┐
Global shortcut ───┼─► toggle main window (popover-style)
Tray menu "Open" ──┘
                         main window (hidden by default)
                         ├─ capture input  (↵ save, Esc hide)
                         ├─ day-grouped list (Today/Yesterday/date)
                         │   └─ note row: archive / delete on hover
                         └─ settings panel: shortcut recorder, launch-at-login
window blur ─► auto-hide (250ms guard vs tray-click race)
```

### Backend (`src-tauri/src/lib.rs`, thin)
- Accessory activation policy (no Dock).
- Tray icon + menu (Open / Settings… / Quit). Left-click toggles window;
  right-click shows menu.
- Popover auto-hide on window blur, with a 250 ms guard so a tray-click dismiss
  doesn't immediately re-open (blur fires before the tray click event).
- SQLite migration: `notes(id, body, created_at, archived_at)` + index.

### Frontend
- `src/db.ts` — SQLite CRUD; notes ordered by `created_at desc`.
- `src/shortcut.ts` — accelerator parsing, pretty symbols, register/replace.
- `src/main.ts` — UI wiring: capture, day grouping, archive/delete, settings.

## Data model

`notes`: `id INTEGER PK`, `body TEXT`, `created_at INTEGER (epoch ms)`,
`archived_at INTEGER NULL` (null = active). Grouping by local `startOfDay`.
Archive = set `archived_at`; unarchive = null it; delete = row delete.

## UX rules

- `↵` saves + clears + keeps box open (rapid entry); resets view to active notes.
- `Esc` / click-away hides the window.
- Shortcut recorder: click chip → press combo → stored in `localStorage`.

## Build & install

- `bun run tauri build` → `QuickMemo.app` + `.dmg`.
- `packaging/install-local.sh` → build + generate local cask + `brew install --cask`.
- `packaging/quickmemo.rb` → release cask template (fill repo + sha256).

## Deferred / future

- Double-tap `⌘M⌘M` (rdev + Accessibility).
- Window anchored under the tray icon (currently centered).
- Search; retention/auto-archive policy.

## Unresolved questions

- App name confirmed as "QuickMemo"? (placeholder, easily renamed)
- Preferred default shortcut — `⌘⇧M` vs `⌃⌥M`?
- Should saving auto-hide the window, or stay open (current) for multi-entry?
