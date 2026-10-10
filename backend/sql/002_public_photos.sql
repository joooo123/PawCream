-- Run this migration once against existing PawCream databases.
-- New PostgreSQL volumes apply it automatically via docker-entrypoint-initdb.d.
CREATE TABLE IF NOT EXISTS public_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_photo_id varchar(90) NOT NULL,
  author_name varchar(40) NOT NULL,
  frame_name varchar(80) NOT NULL,
  image_type varchar(16) NOT NULL CHECK (image_type IN ('image/png', 'image/jpeg', 'image/webp')),
  image_data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_photo_id)
);

CREATE INDEX IF NOT EXISTS public_photos_recent_idx
  ON public_photos (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS public_photos_owner_idx
  ON public_photos (user_id, created_at DESC);
