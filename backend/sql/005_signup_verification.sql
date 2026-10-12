-- 005: Invitation-only email verified registrations.
-- Apply on existing volumes BEFORE deploying updated Node API.
CREATE TABLE IF NOT EXISTS registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash char(64) UNIQUE NOT NULL,
  last_four varchar(4) NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS registration_invites_recent_idx
  ON registration_invites (created_at DESC, id DESC);

-- Emails and code hashes are used only for pending signup; passwords are never stored here.
CREATE TABLE IF NOT EXISTS registration_email_codes (
  email citext PRIMARY KEY,
  invite_hash char(64) NOT NULL,
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  window_start timestamptz NOT NULL DEFAULT now(),
  window_sends integer NOT NULL DEFAULT 1,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);
CREATE INDEX IF NOT EXISTS registration_email_codes_expiry_idx
  ON registration_email_codes (expires_at);
