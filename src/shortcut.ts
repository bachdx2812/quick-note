import { invoke } from "@tauri-apps/api/core";

const STORAGE_KEY = "shortcut";
export const DEFAULT_SHORTCUT = "Command+Shift+M";

export function loadShortcut(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_SHORTCUT;
}

/** Build a Tauri accelerator string from a keydown event, or null if invalid. */
export function acceleratorFromEvent(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.metaKey) mods.push("Command");
  if (e.ctrlKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  const key = e.key.length === 1 ? e.key.toUpperCase() : "";
  if (!key || mods.length === 0) return null;
  return [...mods, key].join("+");
}

const SYMBOLS: Record<string, string> = {
  Command: "⌘",
  CmdOrControl: "⌘",
  Control: "⌃",
  Alt: "⌥",
  Shift: "⇧",
};

export function prettyShortcut(accel: string): string {
  return accel
    .split("+")
    .map((part) => SYMBOLS[part] ?? part)
    .join("");
}

/**
 * Register `accel` in the Rust backend (which owns the global shortcut so the
 * window reliably focuses on this no-Dock app), replacing the previous one.
 */
export async function applyShortcut(accel: string): Promise<void> {
  try {
    await invoke("set_shortcut", { accelerator: accel });
    localStorage.setItem(STORAGE_KEY, accel);
  } catch (err) {
    console.error("Failed to register shortcut", accel, err);
  }
}
