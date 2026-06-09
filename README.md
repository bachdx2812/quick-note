# QuickMemo

Fast, independent **menu-bar note capture** for macOS. No Dock icon — lives only
in the menu bar. Press a global shortcut (or click the icon) to pop a clean
input, type, hit `↵` to save. The popover floats **over full-screen apps**
(Spotlight-style). Notes are grouped by day and can be archived.

Built with [Tauri v2](https://tauri.app) (Rust + webview) + [tauri-nspanel](https://github.com/ahkohd/tauri-nspanel).

![icon](icons-src/app-icon.png)

## Features

- **Menu-bar only** — agent app, no Dock icon, no app menu
- **Floats over full-screen apps** — non-activating `NSPanel`, joins all Spaces
- **Global shortcut** — default `⌘⇧M`, rebindable in Settings
- **Input-first** — opens to a single clean input with a key-hint bar
  (`↵` save · `⇧↵` new line · `esc` close); `Saved ✓` toast on save
- **Grouped by day** — Today / Yesterday / date, with sticky headers
- **Archive & delete** — hover a note; toggle the archived view
- **Launch at login** — optional, via Settings
- **Local SQLite** — `~/Library/Application Support/com.self.quickmemo/quickmemo.db`

## Install with Homebrew

```bash
brew install --cask bachdx2812/tap/quickmemo
```

> Unsigned build: on first launch, right-click **QuickMemo.app → Open** (or
> `xattr -dr com.apple.quarantine /Applications/QuickMemo.app`).

**Local install (build from source, no release):**

```bash
./packaging/install-local.sh
```

## Usage

- Press **`⌘⇧M`** (or click the menu-bar icon) → capture input appears
- Type, **`↵`** saves (box stays open for rapid entry); **`⇧↵`** new line
- **`esc`** or click-away dismisses
- Menu-bar icon → **Show Notes** (browse, archive, delete) / **Settings…** / **Quit**
- In Settings: rebind the shortcut, toggle launch-at-login

## Develop

```bash
bun install
bun run tauri dev
```

## Build

```bash
bun run tauri build
# -> src-tauri/target/release/bundle/macos/QuickMemo.app
# -> src-tauri/target/release/bundle/dmg/QuickMemo_1.0.0_*.dmg
```

Releases are built as a **universal** binary by GitHub Actions on tag push
(`.github/workflows/release.yml`).

## Architecture

| Layer | File | Role |
|-------|------|------|
| Backend | `src-tauri/src/lib.rs` | Tray, accessory policy, NSPanel conversion, popover auto-hide, SQLite migration, global shortcut |
| Data | `src/db.ts` | SQLite CRUD (`@tauri-apps/plugin-sql`) |
| Hotkey | `src/shortcut.ts` | Accelerator parse + register via backend |
| UI | `src/main.ts`, `index.html`, `src/styles.css` | Capture input, day-grouped list, settings, views |
| Icons | `icons-src/` | Source SVG + AI-generated app icon |

## Notes / limitations

- The build is **unsigned** (no Apple Developer cert) — see install note above.
- Default shortcut is a single chord. True double-tap `⌘M⌘M` needs raw key
  monitoring + Accessibility permission and is not yet implemented.
