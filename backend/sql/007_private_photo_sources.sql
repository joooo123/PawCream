-- Keep source images private and separate from the composite Instax image.
-- Existing photos remain intact; historic composites may have no source rows.
CREATE TABLE IF NOT EXISTS private_photo_sources (
  private_photo_id uuid NOT NULL REFERENCES private_photos(id) ON DELETE CASCADE,
  slot_index smallint NOT NULL CHECK (slot_index >= 0 AND slot_index < 4),
  image_type varchar(16) NOT NULL CHECK (image_type IN ('image/png','image/jpeg','image/webp')),
  oss_key text NOT NULL UNIQUE,
  PRIMARY KEY (private_photo_id, slot_index)
);
