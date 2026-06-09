# Homebrew cask for QuickMemo.
#
# Used by the tap repo (bachdx2812/homebrew-tap → Casks/quickmemo.rb).
# `sha256` is filled from the released universal .dmg.
# For a purely local install (no release), run packaging/install-local.sh.
cask "quickmemo" do
  version "1.0.0"
  sha256 "af0f492b977e9deb61d018b46d4434abb5ccb0b8a67d04cc8bd5106e62942d3e"

  url "https://github.com/bachdx2812/quick-note/releases/download/v#{version}/QuickMemo_#{version}_universal.dmg"
  name "QuickMemo"
  desc "Fast menu-bar note capture for macOS"
  homepage "https://github.com/bachdx2812/quick-note"

  depends_on macos: ">= :big_sur"

  app "QuickMemo.app"

  zap trash: [
    "~/Library/Application Support/com.self.quickmemo",
    "~/Library/Preferences/com.self.quickmemo.plist",
    "~/Library/Saved Application State/com.self.quickmemo.savedState",
  ]
end
