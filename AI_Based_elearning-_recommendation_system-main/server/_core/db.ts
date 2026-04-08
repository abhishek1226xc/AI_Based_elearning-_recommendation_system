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

const ensureUsersColumns = () => {
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    if (columns.length === 0) return;
    const existing = new Set(columns.map(col => col.name));
    const addColumn = (name: string, type: string, defaultValue?: string) => {
      if (existing.has(name)) return;
      const defaultSql = defaultValue ? ` DEFAULT ${defaultValue}` : "";
      db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}${defaultSql}`);
    };

    addColumn("onboardingCompletedAt", "INTEGER");
    addColumn("isActive", "INTEGER", "1");
    addColumn("isBanned", "INTEGER", "0");
    addColumn("lastLoginIp", "TEXT");
    addColumn("resetPasswordToken", "TEXT");
    addColumn("resetPasswordExpiresAt", "INTEGER");
    addColumn("adminNotes", "TEXT");
    addColumn("sessionInvalidatedAt", "INTEGER");
  } catch (error) {
    console.warn("[Database] Failed to ensure users columns:", error);
  }
};

ensureUsersColumns();
