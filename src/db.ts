import Database from "@tauri-apps/plugin-sql";

export interface Note {
  id: number;
  body: string;
  created_at: number;
  archived_at: number | null;
}

let db: Database | null = null;

export async function initDb(): Promise<void> {
  db = await Database.load("sqlite:quickmemo.db");
}

function conn(): Database {
  if (!db) throw new Error("Database not initialised");
  return db;
}

export async function addNote(body: string): Promise<void> {
  await conn().execute("INSERT INTO notes (body, created_at) VALUES ($1, $2)", [
    body,
    Date.now(),
  ]);
}

export async function listNotes(): Promise<Note[]> {
  return conn().select<Note[]>(
    "SELECT id, body, created_at, archived_at FROM notes ORDER BY created_at DESC"
  );
}

export async function setArchived(id: number, archived: boolean): Promise<void> {
  await conn().execute("UPDATE notes SET archived_at = $1 WHERE id = $2", [
    archived ? Date.now() : null,
    id,
  ]);
}

export async function updateNote(id: number, body: string): Promise<void> {
  await conn().execute("UPDATE notes SET body = $1 WHERE id = $2", [body, id]);
}

export async function removeNote(id: number): Promise<void> {
  await conn().execute("DELETE FROM notes WHERE id = $1", [id]);
}
