# Research: macOS quick-note market — what QuickMemo builds next

_Conducted 2026-06-10. 5 web searches (Gemini off, no CLI)._

## Executive summary

QuickMemo already nails the **table-stakes** of the quick-capture niche: sub-3s
global-hotkey capture, menu-bar-only (no Dock), local storage. It even has a
**rare differentiator** — floats over other apps' full-screen Spaces (most rivals
don't). Gaps vs. what the market repeatedly asks for: **search**, **plain-text/
markdown ownership + export**, and **sync** (the #1 desire _and_ #1 trust-wound).
Win by staying tiny + local-first + own-your-data, not by chasing Notion/Obsidian
feature bloat.

## Competitor map (direct niche = global-hotkey capture)

| App | Price | Notes |
|-----|-------|-------|
| **Apple Notes Quick Note** | free | benchmark for speed (Fn-Q); weak search/org; iCloud sync; walled garden |
| **Stik** | free, OSS | ⌘⇧S floating post-it, **.md files**, sync via iCloud/git/local — closest rival + our positioning twin |
| **Type** | free/paid | hotkey, text files, auto timestamps; pairs with Obsidian |
| **Scratchpad** (Sindre) | free | single persistent note, syncs Mac/iPhone/iPad/Watch |
| **Antinote** | $5 once | ephemeral notes, **inline math/currency**, 14 themes, local-only |
| **Noted** | $0.99 | ultra-minimal, privacy, no sync |
| **Raycast Notes/Floating** | free | ~3s capture inside Raycast |

## What users want (recurring, ranked)

1. **Reliable sync that never silently overwrites** — most valuable + most broken. Local-first (iCloud Drive/Dropbox/git folder) avoids ~60% of category complaints. Cloud-first = biggest trust wounds.
2. **Sub-3s hotkey capture** — table stakes (✅ have it).
3. **Plain-text / markdown storage** — kills export-lock-in + the markdown request in one move. Nearly all new entrants (Stik, Type) store `.md`.
4. **Search** — Apple Notes' weak search is a top complaint; with >100 notes finding stuff is painful.
5. **Export / no lock-in** — own-your-data is valued more than price.
6. **Cross-platform (iPhone)** — Apple Notes' moat; hard for us.
7. **AI (emerging)** — proactive tags, task extraction, summarize, _cited_ retrieval. 2026's hot axis but not table stakes; on-device/privacy preferred.
8. **Delight**: inline math (Antinote), themes, command palette.

## QuickMemo: have vs. gap

- ✅ Global hotkey, no-Dock, fullscreen overlay, day-group, archive, launch-at-login, local SQLite, polished UI, content-scaling input.
- ❌ Search · ❌ markdown/plain-text + export (SQLite = lock-in) · ❌ sync · ❌ edit existing note · ❌ mobile · ❌ AI.

## Monetization

- Menu-bar utilities: **one-time purchase is expected**; subscriptions = red flag unless hosted sync. Indie subscriptions only sustainable as a multi-app catalog (Sindre model) or bundle (Setapp).
- Comparable prices: Noted $0.99, Antinote $5.
- **Recommendation:** stay **free + OSS** now (it's already public → adoption, goodwill, distribution via r/macapps, Product Hunt, Setapp). If monetizing later: one-time ~$5, or a one-time **Pro** unlock for sync + AI. Avoid subscriptions.

## Recommended roadmap (YAGNI / KISS)

**P0 — next (high value, low effort, on-brand "own your data + fast"):**
1. **Search** — filter field in the notes view. Cheap; hits a top pain. (~0.5 day)
2. **Markdown export + plain-text path** — "Export all to `.md`" now; evaluate storing notes as `.md` files (Stik-style) for the own-your-data story. (~1 day export; bigger if full migration)
3. **iCloud Drive sync** — store DB/notes folder under `~/Library/Mobile Documents/...` → free **Mac↔Mac** sync, no server, no subscription. Biggest want at lowest cost. (~1 day; watch file-conflict edge)

**P1 — differentiate + delight:**
4. Edit an existing note (currently capture-only).
5. Inline math (Antinote-style) — beloved, cheap.
6. Theme/accent picker.
7. Command palette / quick actions.

**P2 — bigger bets:**
8. AI: summarize / auto-tag / "turn into todo" (on-device or API, opt-in).
9. iOS companion (Apple Notes' moat) — only if going serious; Tauri-mobile or native + shared iCloud store.

## Positioning

"**Own-your-data quick capture that even works over full-screen.**" Lean into:
local-first, plain-text, fullscreen overlay, speed, polish — the things heavy
apps (Notion/Obsidian) and even Apple Notes don't do well together.

## Unresolved questions

1. Sync scope — Mac-only (iCloud Drive, easy) or full iPhone (huge effort)?
2. Storage — migrate SQLite → `.md` files (portability) or keep SQLite + add export (simpler)?
3. Monetize at all, or stay free+OSS as a portfolio/calling-card app?

## Sources

- [On My Menubar — menu-bar quick-note apps](https://onmymenubar.app/blog/quick-note-taking-menubar-apps-that-actually-capture-your-thoughts/)
- [Stik — free OSS quick capture](https://www.stik.ink/) · [Type](https://usetype.app/)
- [SlashNote — quick notes on Mac, 10 methods](https://slashnote.app/blog/quick-notes-mac-10-methods/)
- [Saner.AI — 15 Apple Notes alternatives](https://www.saner.ai/blogs/best-apple-notes-alternatives)
- [Teenyapps — best Mac apps under $10 one-time](https://teenyapps.com/articles/best-mac-apps-under-10-dollars/)
- [Timing — best Mac menu bar apps 2026](https://timingapp.com/blog/best-mac-menu-bar-apps/)
- [Sugggest — 2026 note-taking landscape](https://sugggest.com/blog/best-note-taking-apps-2026)
- [Atlas — cross-platform note apps 2026](https://www.atlasworkspace.ai/blog/best-cross-platform-note-taking-apps)
