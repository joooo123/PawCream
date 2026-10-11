-- Keep old image_data rows readable while new uploads use OSS.
-- Apply once to existing databases before setting PHOTO_STORAGE=oss.
ALTER TABLE public_photos ADD COLUMN IF NOT EXISTS oss_key text;
ALTER TABLE public_photos ALTER COLUMN image_data DROP NOT NULL;

-- An image must be stored in exactly one location (legacy bytea or OSS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'public_photos_storage_location_chk'
      AND conrelid = 'public_photos'::regclass
  ) THEN
    ALTER TABLE public_photos
      ADD CONSTRAINT public_photos_storage_location_chk
      CHECK ((image_data IS NOT NULL) <> (oss_key IS NOT NULL));
  END IF;
END $$;
