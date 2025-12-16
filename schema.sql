-- P.U.S.H Cloudflare D1 schema
-- Run this in your D1 database (push_db)

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);
