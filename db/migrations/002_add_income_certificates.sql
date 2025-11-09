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
CREATE INDEX IF NOT EXISTS idx_income_certificates_user_id ON income_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_income_certificates_uuid ON income_certificates(uuid);

