import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  enable as autostartEnable,
  disable as autostartDisable,
  isEnabled as autostartIsEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  Pencil,
  List as ListIcon,
  Settings as SettingsIcon,
  Search,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import {
  addNote,
  initDb,
  listNotes,
  removeNote,
  setArchived,
  updateNote,
  type Note,
} from "./db";
import {
  acceleratorFromEvent,
  applyShortcut,
  loadShortcut,
  prettyShortcut,
} from "./shortcut";
import { evalMath, formatResult } from "./calc";

type Mode = "capture" | "panel" | "settings";

const appWindow = getCurrentWindow();
const WIDTH = 560;
const DAY_MS = 86_400_000;
const ACCENTS = ["#10b981", "#3b82f6", "#6c5ce7", "#6b7280", "#ef4444", "#f59e0b"];

const startOfDay = (ts: number) => new Date(ts).setHours(0, 0, 0, 0);

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

const timeLabel = (ts: number) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function groupByDay(notes: Note[]): [number, Note[]][] {
  const groups = new Map<number, Note[]>();
  for (const note of notes) {
    const key = startOfDay(note.created_at);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(note);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

const applyAccent = (c: string) =>
  document.documentElement.style.setProperty("--accent", c);

export default function App() {
  const [mode, setMode] = useState<Mode>("capture");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const refresh = useCallback(async () => setNotes(await listNotes()), []);

  useEffect(() => {
    applyAccent(localStorage.getItem("accent") || ACCENTS[0]);
    initDb()
      .then(refresh)
      .then(() => applyShortcut(loadShortcut()));
  }, [refresh]);

  // Auto-size the window to the card.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const resize = () =>
      void appWindow.setSize(new LogicalSize(WIDTH, Math.ceil(el.offsetHeight)));
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    return () => ro.disconnect();
  }, []);

  // Hotkey / tray events.
  useEffect(() => {
    const resetCapture = () => {
      setQuery("");
      setSearch("");
      setEditingId(null);
      setShowArchived(false);
      setMode("capture");
    };
    const unlisteners = [
      listen("focus-capture", resetCapture),
      listen("show-notes", () => setMode("panel")),
      listen("open-settings", () => setMode("settings")),
    ];
    const focusOff = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        if (modeRef.current === "capture") inputRef.current?.focus();
      } else {
        setMode("capture");
      }
    });
    return () => {
      unlisteners.forEach((p) => p.then((f) => f()));
      focusOff.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (mode === "capture") inputRef.current?.focus();
    else if (mode === "panel") searchRef.current?.focus();
  }, [mode]);

  useLayoutEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [query, mode]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1100);
  }, []);

  const save = useCallback(async () => {
    const value = query.trim();
    if (!value) return;
    const math = evalMath(value);
    await addNote(math === null ? value : `${value} = ${formatResult(math)}`);
    setQuery("");
    flash("Saved ✓");
    void refresh();
  }, [query, flash, refresh]);

  const exportMd = useCallback(async () => {
    const lines: string[] = ["# QuickMemo", ""];
    const section = (title: string, ns: Note[]) => {
      if (!ns.length) return;
      lines.push(`## ${title}`, "");
      for (const [key, group] of groupByDay(ns)) {
        lines.push(`### ${dayTitle(key)}`, "");
        for (const n of group)
          lines.push(`- ${timeLabel(n.created_at)} — ${n.body.replace(/\n/g, "\n  ")}`);
        lines.push("");
      }
    };
    section("Notes", notes.filter((n) => n.archived_at === null));
    section("Archived", notes.filter((n) => n.archived_at !== null));
    try {
      await invoke("export_markdown", { content: lines.join("\n") });
      flash("Saved to Downloads");
    } catch (err) {
      console.error("export failed", err);
    }
  }, [notes, flash]);

  const calc = evalMath(query);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2.5 p-4">
        {mode !== "settings" && (
          <div className="flex items-center gap-2.5">
            <div className="surface flex min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 py-3">
              <Pencil size={18} className="shrink-0 text-muted" />
              <textarea
                ref={inputRef}
                rows={1}
                value={query}
                placeholder="Quick note…"
                autoComplete="off"
                spellCheck={false}
                style={{ caretColor: "var(--accent)" }}
                className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-[16px] leading-snug text-text outline-none placeholder:text-faint"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void save();
                  } else if (e.key === "Escape") {
                    if (query) setQuery("");
                    else void appWindow.hide();
                  }
                }}
              />
              {calc !== null && (
                <span className="shrink-0 font-semibold text-accent tabular-nums">
                  = {formatResult(calc)}
                </span>
              )}
            </div>
            <IconButton
              label="Notes"
              active={mode === "panel"}
              onClick={() => setMode(mode === "panel" ? "capture" : "panel")}
            >
              <ListIcon size={18} />
            </IconButton>
            <IconButton label="Settings" onClick={() => setMode("settings")}>
              <SettingsIcon size={18} />
            </IconButton>
          </div>
        )}

        {mode === "panel" && (
          <NotesPanel
            notes={notes}
            search={search}
            setSearch={setSearch}
            showArchived={showArchived}
            toggleArchived={() => setShowArchived((v) => !v)}
            editingId={editingId}
            setEditingId={setEditingId}
            searchRef={searchRef}
            onArchive={async (n) => {
              await setArchived(n.id, n.archived_at === null);
              void refresh();
            }}
            onDelete={async (n) => {
              await removeNote(n.id);
              void refresh();
            }}
            onUpdate={async (id, body) => {
              await updateNote(id, body);
              setEditingId(null);
              void refresh();
            }}
          />
        )}

        {mode === "settings" && (
          <SettingsPanel onBack={() => setMode("capture")} onExport={exportMd} />
        )}

        <div
          className={`pointer-events-none absolute right-3 top-2.5 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-white transition-all ${
            toast ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          }`}
        >
          {toast}
        </div>
    </div>
  );
}

// ---------------- subcomponents ----------------

function IconButton({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`surface flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${
        active ? "text-accent" : "text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function NotesPanel(props: {
  notes: Note[];
  search: string;
  setSearch: (v: string) => void;
  showArchived: boolean;
  toggleArchived: () => void;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  onArchive: (n: Note) => void;
  onDelete: (n: Note) => void;
  onUpdate: (id: number, body: string) => void;
}) {
  const term = props.search.trim().toLowerCase();
  const visible = props.notes.filter((n) => {
    const inView = props.showArchived ? n.archived_at !== null : n.archived_at === null;
    return inView && (!term || n.body.toLowerCase().includes(term));
  });
  const groups = groupByDay(visible);

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-hover px-3 py-2">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            ref={props.searchRef}
            value={props.search}
            placeholder="Search notes…"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
            onChange={(e) => props.setSearch(e.target.value)}
          />
        </div>
        <button
          title={props.showArchived ? "Show active" : "Show archived"}
          onClick={props.toggleArchived}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
            props.showArchived ? "bg-hover text-accent" : "text-muted hover:bg-hover"
          }`}
        >
          <Archive size={16} />
        </button>
      </div>

      <div className="scroll-thin max-h-[320px] overflow-y-auto px-2 pb-2">
        {visible.length === 0 ? (
          <p className="px-2 py-9 text-center text-[13px] text-faint">
            {term ? "No matches" : props.showArchived ? "No archived notes" : "No notes yet"}
          </p>
        ) : (
          groups.map(([key, group]) => (
            <div key={key}>
              <div className="px-1.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                {dayTitle(key)}
              </div>
              {group.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  editing={props.editingId === note.id}
                  onStartEdit={() => props.setEditingId(note.id)}
                  onCancel={() => props.setEditingId(null)}
                  onSave={(body) => props.onUpdate(note.id, body)}
                  onArchive={() => props.onArchive(note)}
                  onDelete={() => props.onDelete(note)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
  editing,
  onStartEdit,
  onCancel,
  onSave,
  onArchive,
  onDelete,
}: {
  note: Note;
  editing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: (body: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const editRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="p-1">
        <textarea
          ref={editRef}
          defaultValue={note.body}
          rows={Math.min(note.body.split("\n").length, 6)}
          className="w-full resize-none rounded-lg border border-accent bg-hover px-2.5 py-2 text-sm leading-snug text-text outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              const v = e.currentTarget.value.trim();
              if (v) onSave(v);
              else onCancel();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`row-hover group flex items-start gap-2 rounded-[10px] px-2.5 py-2 ${
        note.archived_at ? "opacity-[0.55]" : ""
      }`}
    >
      <span
        className="flex-1 break-words whitespace-pre-wrap leading-snug [user-select:text]"
        onDoubleClick={onStartEdit}
      >
        {note.body}
      </span>
      <span className="shrink-0 pt-0.5 text-[11px] text-faint tabular-nums">
        {timeLabel(note.created_at)}
      </span>
      <RowAction title="Edit" onClick={onStartEdit}>
        <Pencil size={15} />
      </RowAction>
      <RowAction title={note.archived_at ? "Unarchive" : "Archive"} onClick={onArchive}>
        {note.archived_at ? <ArchiveRestore size={15} /> : <Archive size={15} />}
      </RowAction>
      <RowAction title="Delete" onClick={onDelete}>
        <Trash2 size={15} />
      </RowAction>
    </div>
  );
}

function RowAction({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="shrink-0 rounded-md p-1 leading-none text-muted opacity-0 transition group-hover:opacity-100 hover:bg-hover hover:text-accent"
    >
      {children}
    </button>
  );
}

function SettingsPanel({
  onBack,
  onExport,
}: {
  onBack: () => void;
  onExport: () => void;
}) {
  const [shortcut, setShortcut] = useState(prettyShortcut(loadShortcut()));
  const [recording, setRecording] = useState(false);
  const [autostartOn, setAutostartOn] = useState(false);
  const [accent, setAccent] = useState(localStorage.getItem("accent") || ACCENTS[0]);

  useEffect(() => {
    autostartIsEnabled().then(setAutostartOn).catch(() => {});
  }, []);

  useEffect(() => {
    if (!recording) return;
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault();
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      setRecording(false);
      const accel = acceleratorFromEvent(e);
      if (!accel) return;
      await applyShortcut(accel);
      setShortcut(prettyShortcut(accel));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]);

  const toggleAutostart = async () => {
    try {
      if (autostartOn) await autostartDisable();
      else await autostartEnable();
      setAutostartOn(!autostartOn);
    } catch (err) {
      console.error("autostart toggle failed", err);
    }
  };

  return (
    <div className="surface flex flex-col gap-4 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2.5 text-[15px] font-bold">
        <button
          onClick={onBack}
          title="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-text"
        >
          <ChevronLeft size={16} />
        </button>
        Settings
      </div>

      <Row label="Global shortcut">
        <button
          onClick={() => setRecording(true)}
          className="rounded-lg border border-border bg-hover px-3 py-1.5 text-[13px] hover:border-accent"
        >
          {recording ? "Press keys…" : shortcut}
        </button>
      </Row>

      <Row label="Launch at login">
        <input
          type="checkbox"
          checked={autostartOn}
          onChange={toggleAutostart}
          className="h-[18px] w-[18px] cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
        />
      </Row>

      <Row label="Accent">
        <div className="flex gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => {
                applyAccent(c);
                localStorage.setItem("accent", c);
                setAccent(c);
              }}
              style={{ background: c }}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                accent === c ? "ring-2 ring-text" : ""
              }`}
            />
          ))}
        </div>
      </Row>

      <Row label="Backup">
        <button
          onClick={onExport}
          className="rounded-lg border border-border bg-hover px-3 py-1.5 text-[13px] hover:border-accent"
        >
          Export to Markdown
        </button>
      </Row>

      <button
        onClick={() => void invoke("quit_app")}
        className="rounded-lg border border-border bg-hover px-3 py-1.5 text-[13px] text-red-500 hover:border-red-500"
      >
        Quit QuickMemo
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      {children}
    </div>
  );
}
