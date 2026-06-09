#!/usr/bin/env bash
# Build QuickMemo and install it locally via Homebrew (no GitHub release needed).
# Generates a cask pointing at the freshly built .dmg, then `brew install --cask`.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building release bundle (this takes a few minutes the first time)…"
bun run tauri build

DMG="$(ls -t src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1 || true)"
if [[ -z "${DMG}" || ! -f "${DMG}" ]]; then
  echo "error: no .dmg produced under src-tauri/target/release/bundle/dmg/" >&2
  exit 1
fi

SHA="$(shasum -a 256 "${DMG}" | awk '{print $1}')"
VERSION="$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')"
DMG_DIR="$(cd "$(dirname "${DMG}")" && pwd)"
DMG_NAME="$(basename "${DMG}")"
CASK="packaging/quickmemo-local.rb"

cat > "${CASK}" <<RB
cask "quickmemo" do
  version "${VERSION}"
  sha256 "${SHA}"
  url "file://${DMG_DIR}/${DMG_NAME}"
  name "QuickMemo"
  desc "Fast menu-bar note capture for macOS"
  homepage "https://example.com/quickmemo"
  app "QuickMemo.app"
  zap trash: [
    "~/Library/Application Support/com.self.quickmemo",
    "~/Library/Preferences/com.self.quickmemo.plist",
  ]
end
RB

echo "==> Installing via Homebrew…"
brew install --cask "${CASK}"

echo "==> Done. QuickMemo lives in the menu bar (no Dock icon)."
echo "    Press ⌘⇧M (default) or click the menu-bar icon to capture a note."
