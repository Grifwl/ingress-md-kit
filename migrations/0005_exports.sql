-- Two answers of the application form, and which mission occupied each
-- position of the last Ultimate Mission Maker file that was exported.

ALTER TABLE mission_days ADD COLUMN application_theme TEXT NOT NULL DEFAULT '';
ALTER TABLE mission_days ADD COLUMN logo_url TEXT;

CREATE TABLE umm_manifests (
  mission_day_id TEXT PRIMARY KEY REFERENCES mission_days (id) ON DELETE CASCADE,
  mission_ids_json TEXT NOT NULL
);
