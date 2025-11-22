-- 發行憑證表
CREATE TABLE IF NOT EXISTS issued_certificates (
  issued_certificate_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  cid TEXT NOT NULL UNIQUE,
  vc_uid TEXT NOT NULL,
  issuance_date TEXT,
  expired_date TEXT,
  fields TEXT NOT NULL, -- JSON 格式儲存 fields 陣列
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED', 'REVOKED')),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_issued_certificates_user_id ON issued_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_transaction_id ON issued_certificates(transaction_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_cid ON issued_certificates(cid);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_status ON issued_certificates(status);

