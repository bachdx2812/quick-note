#!/usr/bin/env bash
# Bump the QuickMemo version in one shot.
#
# Updates the version in tauri.conf.json, package.json, Cargo.toml (+ Cargo.lock),
# commits the change, and optionally tags + pushes to trigger the release CI.
#
# Usage:
#   scripts/bump.sh 1.2.3              # set an explicit version
#   scripts/bump.sh patch             # 1.0.0 -> 1.0.1
#   scripts/bump.sh minor             # 1.0.0 -> 1.1.0
#   scripts/bump.sh major             # 1.0.0 -> 2.0.0
#   scripts/bump.sh patch --release   # also tag vX.Y.Z + push (builds + publishes)
set -euo pipefail
cd "$(dirname "$0")/.."

CONF="src-tauri/tauri.conf.json"
PKG="package.json"
CARGO="src-tauri/Cargo.toml"
LOCK="src-tauri/Cargo.lock"

arg="${1:-}"
release="${2:-}"
if [[ -z "$arg" ]]; then
  echo "usage: scripts/bump.sh <version|patch|minor|major> [--release]" >&2
  exit 1
fi

current="$(grep -m1 '"version"' "$PKG" | sed -E 's/.*"version": "([^"]+)".*/\1/')"
[[ -n "$current" ]] || { echo "error: cannot read current version from $PKG" >&2; exit 1; }

IFS='.' read -r MA MI PA <<<"$current"
case "$arg" in
  major) new="$((MA + 1)).0.0" ;;
  minor) new="${MA}.$((MI + 1)).0" ;;
  patch) new="${MA}.${MI}.$((PA + 1))" ;;
  *)
    if [[ ! "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "error: invalid version '$arg' (expected X.Y.Z or patch|minor|major)" >&2
      exit 1
    fi
    new="$arg"
    ;;
esac

echo "bump: $current -> $new"

# Replace the first "version" key in the JSON files, and the [package] version
# in Cargo.toml (a line that starts with `version =`, not the inline dep ones).
NEW="$new" perl -i -pe 'BEGIN{$v=$ENV{NEW}} if(!$d && s/("version"\s*:\s*")[^"]+(")/$1$v$2/){$d=1}' "$CONF"
NEW="$new" perl -i -pe 'BEGIN{$v=$ENV{NEW}} if(!$d && s/("version"\s*:\s*")[^"]+(")/$1$v$2/){$d=1}' "$PKG"
NEW="$new" perl -i -pe 'BEGIN{$v=$ENV{NEW}} if(!$d && s/^(version\s*=\s*")[^"]+(")/$1$v$2/){$d=1}' "$CARGO"

# Keep Cargo.lock's quickmemo entry in sync (no network needed).
if [[ -f "$LOCK" ]]; then
  NEW="$new" perl -0777 -i -pe 'BEGIN{$v=$ENV{NEW}} s/(name = "quickmemo"\nversion = ")[^"]+(")/$1$v$2/' "$LOCK"
fi

echo "updated:"
grep -m1 '"version"' "$CONF" | sed 's/^/  tauri.conf.json:/'
grep -m1 '"version"' "$PKG" | sed 's/^/  package.json:/'
grep -m1 '^version' "$CARGO" | sed 's/^/  Cargo.toml: /'

git add "$CONF" "$PKG" "$CARGO" "$LOCK"
git commit -m "chore: bump version to $new"

if [[ "$release" == "--release" || "$release" == "-r" ]]; then
  git push origin HEAD
  git tag "v$new"
  git push origin "v$new"
  echo "tagged v$new — release workflow will build, publish, and update the Homebrew tap."
else
  echo
  echo "committed. To publish this version, run:"
  echo "  git push && git tag v$new && git push origin v$new"
  echo "or re-run as: scripts/bump.sh $new --release"
fi
