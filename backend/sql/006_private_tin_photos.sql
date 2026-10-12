-- Private tin-box photos live only in OSS, independently of public wall photos.
-- Run manually on existing PostgreSQL volumes before updating the API.
CREATE TABLE IF NOT EXISTS private_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_photo_id varchar(90) NOT NULL,
  frame_name varchar(80) NOT NULL,
  image_type varchar(16) NOT NULL CHECK (image_type IN ('image/png', 'image/jpeg', 'image/webp')),
  oss_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_photo_id)
);

CREATE INDEX IF NOT EXISTS private_photos_owner_recent_idx
  ON private_photos (user_id, created_at DESC, id DESC);
