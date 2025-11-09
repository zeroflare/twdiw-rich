-- Migration: Add user_settings table
-- Created: 2024

-- 使用者設定表
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  gemini_api_key TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

