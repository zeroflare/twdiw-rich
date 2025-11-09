-- D1 Database Schema for twdiw-rich
-- 使用者表
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- 資產表
CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('CASH_AND_EQUIVALENTS', 'SECURITIES', 'REAL_ESTATE', 'VEHICLE')),
  asset_name TEXT NOT NULL,
  current_value REAL NOT NULL DEFAULT 0,
  location TEXT,
  size_ping REAL,
  model_no TEXT,
  model_year INTEGER,
  uuid TEXT,
  certificate_type TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 負債表
CREATE TABLE IF NOT EXISTS liabilities (
  liability_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  liability_type TEXT NOT NULL CHECK(liability_type IN ('MORTGAGE', 'PERSONAL_LOAN', 'STUDENT_LOAN', 'CAR_LOAN', 'CREDIT_CARD_DEBT')),
  liability_name TEXT NOT NULL,
  remaining_balance REAL NOT NULL DEFAULT 0,
  uuid TEXT,
  certificate_type TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 財富階層憑證表
CREATE TABLE IF NOT EXISTS rank_certificates (
  rank_certificate_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  net_worth REAL NOT NULL,
  certificate_type TEXT DEFAULT '0052696330_vc_asset_player_rank_certificate',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 使用者設定表
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  gemini_api_key TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 年收入憑證表
CREATE TABLE IF NOT EXISTS income_certificates (
  income_certificate_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  uuid TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ANNUAL_INCOME',
  year INTEGER NOT NULL,
  certificate_type TEXT DEFAULT '0052696330_vc_income__certificate',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_uuid ON assets(uuid);
CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_uuid ON liabilities(uuid);
CREATE INDEX IF NOT EXISTS idx_rank_certificates_user_id ON rank_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_income_certificates_user_id ON income_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_income_certificates_uuid ON income_certificates(uuid);

