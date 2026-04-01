import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbDir = path.resolve(import.meta.dirname, "..", "..", "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(dbDir, "elearning.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
