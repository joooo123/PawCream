-- 004: PawCream owner-only moderation console.
-- On an existing PostgreSQL volume apply this file manually BEFORE rebuilding the API.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason varchar(280);

-- Hiding does not delete private OSS objects or historical database images.
ALTER TABLE public_photos ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS admin_audit (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  action varchar(64) NOT NULL,
  target_type varchar(24) NOT NULL,
  target_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON admin_audit(target_type, target_id);
