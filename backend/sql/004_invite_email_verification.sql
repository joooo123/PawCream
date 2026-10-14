-- Apply once to existing PostgreSQL databases; new volumes run it automatically.
CREATE TABLE IF NOT EXISTS invite_codes (
  code varchar(16) PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email citext PRIMARY KEY,
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL,
  window_started_at timestamptz NOT NULL,
  sent_in_window integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS email_verifications_expire_idx
  ON email_verifications (expires_at);
