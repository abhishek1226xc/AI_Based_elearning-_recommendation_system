# Database Connection Setup Guide

## Problem Identified & Fixed

Your application was experiencing a **database configuration mismatch**:

### Issues Found:
1. ❌ `.env` file was configured for **MySQL** (`mysql://root:password@localhost:3306/elearning`)
2. ✅ But the application code was using **SQLite** (local file-based at `./data/elearning.db`)
3. ⚠️ Database schema may not have been properly initialized

### Solution Applied:
1. ✅ Updated `.env` to use **SQLite** (`./data/elearning.db`)
2. ✅ Updated `.env.example` to reflect correct default configuration
3. ✅ Created `init-db.ts` script for easy database initialization
4. ✅ Added `npm run db:init` command to package.json

---

## Database Architecture

The application uses **SQLite** with **Drizzle ORM** for the following reasons:
- **No external database setup required** - works out of the box
- **Perfect for development** - data persists locally
- **File-based storage** - easy to backup and version control
- **Built-in WAL mode** - ensures data integrity even with concurrent access

### Database Location
```
📁 /workspaces/AI_Based_elearning-_recommendation_system/
   └── 📁 data/
       ├── elearning.db       (main database file)
       ├── elearning.db-shm   (shared memory file)
       └── elearning.db-wal   (write-ahead log)
```

---

## Quick Start: Initialize Your Database

### Option 1: Automatic Initialization (Recommended)
```bash
npm run db:init
```
This will:
- ✓ Create the `data/` directory (if needed)
- ✓ Initialize SQLite database with complete schema
- ✓ Seed with 3 sample courses (only on first run)
- ✓ Enable WAL mode for better concurrency
- ✓ Enable foreign key constraints

### Option 2: Using Drizzle Migrations
```bash
npm run db:push
```
This will:
- Generate SQL migration files
- Apply migrations to the database

### Option 3: Seed with Full Sample Data
After initialization, populate with more sample data:
```bash
npm run seed
```

---

## Verification Steps

### 1. Check Database Connection
```bash
# The database files should exist in data/ directory
ls -la data/elearning.db*
```

Expected output:
```
-rw-r--r-- user group ... elearning.db
-rw-r--r-- user group ... elearning.db-shm
-rw-r--r-- user group ... elearning.db-wal
```

### 2. Verify Database Initialization in Code
The database connection in `server/db.ts` includes error handling:
```typescript
export function getDb() {
  if (!_db) {
    try {
      const dbDir = path.resolve(import.meta.dirname, '..', 'data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const dbPath = path.join(dbDir, 'elearning.db');
      const sqlite = new Database(dbPath);
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      _db = drizzle(sqlite);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
```

### 3. Start the Development Server
```bash
npm run dev
```

Check console for messages like:
```
[Database] Connected to SQLite database
[Auth] User authenticated successfully
```

---

## Database Schema Overview

The application includes the following tables:

| Table | Purpose |
|-------|---------|
| **users** | Core user authentication and account data |
| **userProfiles** | User learning preferences and skills |
| **courses** | Course catalog with metadata |
| **courseInteractions** | User-course engagement tracking |
| **userProgress** | Enrollment and completion tracking |
| **bookmarks** | Bookmarked courses for users |
| **platformRatings** | Course ratings from external platforms |
| **recommendations** | AI-generated course recommendations |
| **recommendationFeedback** | User feedback on recommendations |
| **chatSessions** | Chat conversation history (sessions) |
| **chatMessages** | Individual messages in chat sessions |

---

## Environment Variables Reference

```env
# Database connection (SQLite by default)
DATABASE_URL=./data/elearning.db

# Authentication
JWT_SECRET=your-jwt-secret-here-change-in-production
OAUTH_SERVER_URL=https://oauth.example.com
OWNER_OPEN_ID=owner-id-placeholder

# Client-side (VITE_ prefix exposes to browser)
VITE_APP_ID=app-id-placeholder
VITE_OAUTH_PORTAL_URL=https://oauth-portal.example.com

# AI / Forge API
BUILT_IN_FORGE_API_URL=https://forge-api.example.com
BUILT_IN_FORGE_API_KEY=forge-api-key-placeholder

# Node environment
NODE_ENV=development
```

---

## Troubleshooting

### Issue: "Database not available" error
**Solution:**
```bash
# Reinitialize the database
npm run db:init
```

### Issue: "Foreign key constraint failed"
**Solution:** Database WAL mode may not be enabled
```bash
# Reset and reinitialize
rm -rf data/elearning.db*
npm run db:init
```

### Issue: Tables don't exist after starting server
**Solution:** Run migrations
```bash
npm run db:push
npm run db:init
```

### Issue: Want to start fresh with sample data
**Solution:**
```bash
# Remove existing database
rm -rf data/elearning.db*

# Reinitialize and seed
npm run db:init
npm run seed
```

---

## Production Deployment Notes

For production, you can:

1. **Keep SQLite** (recommended for small deployments):
   - Backup `data/elearning.db` regularly
   - Use WAL mode for better concurrency ✓ (already enabled)
   - Set `NODE_ENV=production`

2. **Switch to MySQL/PostgreSQL** (for larger deployments):
   - Update `DATABASE_URL` environment variable
   - Update database dialect in `drizzle.config.ts`
   - Update ORM imports in `server/db.ts`
   - Re-run migrations

---

## File Structure Reference

```
project/
├── server/
│   ├── db.ts                 ← Database connection & queries
│   └── _core/
│       └── env.ts            ← Environment variables
├── drizzle/
│   ├── schema.ts             ← Table definitions
│   └── migrations/           ← SQL migration files
├── data/
│   └── elearning.db          ← SQLite database file
├── init-db.ts                ← Database initialization script
├── seed-db.ts                ← Database seeding script
├── .env                       ← Your local config (updated ✓)
├── .env.example               ← Template config (updated ✓)
├── drizzle.config.ts         ← Drizzle ORM config
└── package.json              ← Scripts (db:init added ✓)
```

---

## Next Steps

1. ✅ Run `npm run db:init` to initialize your database
2. ✅ Run `npm run dev` to start development server
3. ✅ Test database connection by logging in/creating users
4. ✅ Check `data/elearning.db` file for data persistence

Your database is now properly configured! 🎉
