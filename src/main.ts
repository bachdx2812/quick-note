import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import {
  enable as autostartEnable,
  disable as autostartDisable,
  isEnabled as autostartIsEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  addNote,
  initDb,
  listNotes,
  removeNote,
  setArchived,
  type Note,
} from "./db";
import {
  acceleratorFromEvent,
  applyShortcut,
  loadShortcut,
  prettyShortcut,
} from "./shortcut";

type View = "capture" | "browse" | "settings";

const appWindow = getCurrentWindow();
const DAY_MS = 86_400_000;
const WIDTH = 600;

let showArchived = false;
let recording = false;
let currentView: View = "capture";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

let toastTimer: number | undefined;

/** Brief in-app confirmation (no OS permission, no banner spam). */
function showToast(message: string): void {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1100);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayTitle(key: number): string {
  const today = startOfDay(Date.now());
  if (key === today) return "Today";
  if (key === today - DAY_MS) return "Yesterday";
  return new Date(key).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDay(notes: Note[]): Map<number, Note[]> {
  const groups = new Map<number, Note[]>();
  for (const note of notes) {
    const key = startOfDay(note.created_at);
    const bucket = groups.get(key);
    if (bucket) bucket.push(note);
    else groups.set(key, [note]);
  }
  return groups;
}

function noteRow(note: Note): HTMLElement {
  const row = document.createElement("div");
  row.className = note.archived_at ? "note archived" : "note";

  const body = document.createElement("span");
  body.className = "note-body";
  body.textContent = note.body;

  const time = document.createElement("span");
  time.className = "note-time";
  time.textContent = timeLabel(note.created_at);

  const archiveBtn = document.createElement("button");
  archiveBtn.className = "icon";
  archiveBtn.textContent = note.archived_at ? "↩︎" : "🗄";
  archiveBtn.title = note.archived_at ? "Unarchive" : "Archive";
  archiveBtn.onclick = async () => {
    await setArchived(note.id, note.archived_at === null);
    await render();
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "icon";
  deleteBtn.textContent = "🗑";
  deleteBtn.title = "Delete";
  deleteBtn.onclick = async () => {
    await removeNote(note.id);
    await render();
  };

  row.append(body, time, archiveBtn, deleteBtn);
  return row;
}

async function render(): Promise<void> {
  const all = await listNotes();
  const notes = all.filter((n) =>
    showArchived ? n.archived_at !== null : n.archived_at === null
  );
  const list = $("list");
  list.innerHTML = "";

  if (notes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = showArchived ? "No archived notes" : "No notes yet";
    list.appendChild(empty);
    return;
  }

  const groups = groupByDay(notes);
  for (const key of [...groups.keys()].sort((a, b) => b - a)) {
    const section = document.createElement("div");
    section.className = "day";
    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = dayTitle(key);
    section.appendChild(title);
    for (const note of groups.get(key)!) section.appendChild(noteRow(note));
    list.appendChild(section);
  }
}

function autoGrow(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
}

/** In capture view the window hugs the input height + the hint bar. */
async function syncCaptureSize(): Promise<void> {
  const input = $<HTMLTextAreaElement>("note-input");
  autoGrow(input);
  const height = Math.min(Math.max(input.scrollHeight + 44, 104), 340);
  await appWindow.setSize(new LogicalSize(WIDTH, height));
}

async function setView(view: View): Promise<void> {
  currentView = view;
  $("capture").hidden = view !== "capture";
  $("browse").hidden = view !== "browse";
  $("settings").hidden = view !== "settings";

  if (view === "capture") {
    await syncCaptureSize();
    const input = $<HTMLTextAreaElement>("note-input");
    input.focus();
    input.select();
  } else if (view === "browse") {
    await appWindow.setSize(new LogicalSize(WIDTH, 480));
    await render();
  } else {
    await appWindow.setSize(new LogicalSize(WIDTH, 340));
  }
}

function wireCapture(): void {
  const input = $<HTMLTextAreaElement>("note-input");
  input.addEventListener("input", () => {
    void syncCaptureSize();
  });
  input.addEventListener("keydown", async (e) => {
    // Enter saves; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      await addNote(value);
      input.value = "";
      await syncCaptureSize();
      showToast("Saved ✓");
    } else if (e.key === "Escape") {
      await appWindow.hide();
    }
  });
}

function wireBrowse(): void {
  $("back-from-browse").onclick = () => void setView("capture");
  $("open-settings").onclick = () => void setView("settings");
  $("toggle-archived").onclick = async () => {
    showArchived = !showArchived;
    $("view-title").textContent = showArchived ? "Archived" : "Notes";
    await render();
  };
}

function wireSettings(): void {
  $("close-settings").onclick = () => void setView("browse");

  const shortcutBtn = $<HTMLButtonElement>("shortcut-btn");
  shortcutBtn.textContent = prettyShortcut(loadShortcut());
  shortcutBtn.onclick = () => {
    recording = true;
    shortcutBtn.textContent = "Press keys…";
  };
  window.addEventListener(
    "keydown",
    async (e) => {
      if (!recording) return;
      e.preventDefault();
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      recording = false;
      const accel = acceleratorFromEvent(e);
      if (!accel) {
        shortcutBtn.textContent = prettyShortcut(loadShortcut());
        return;
      }
      await applyShortcut(accel);
      shortcutBtn.textContent = prettyShortcut(accel);
    },
    true
  );

  const autostart = $<HTMLInputElement>("autostart");
  autostartIsEnabled()
    .then((on) => {
      autostart.checked = on;
    })
    .catch(() => {});
  autostart.onchange = async () => {
    try {
      if (autostart.checked) await autostartEnable();
      else await autostartDisable();
    } catch (err) {
      console.error("autostart toggle failed", err);
    }
  };
}

async function main(): Promise<void> {
  await initDb();
  wireCapture();
  wireBrowse();
  wireSettings();
  await applyShortcut(loadShortcut());

  await listen("focus-capture", () => void setView("capture"));
  await listen("show-notes", () => void setView("browse"));
  await listen("open-settings", () => void setView("settings"));

  // Esc backs out of browse/settings to the capture input.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && currentView !== "capture") void setView("capture");
  });

  appWindow.onFocusChanged(({ payload: focused }) => {
    if (focused && currentView === "capture") {
      $<HTMLTextAreaElement>("note-input").focus();
    }
  });

  await setView("capture");
}

window.addEventListener("DOMContentLoaded", () => {
  main().catch((err) => console.error("QuickMemo init failed", err));
});
