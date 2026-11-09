-- Organisers, Mission Days, candidate missions and their portals.
-- Every mission belongs to one Mission Day and waypoints belong to a
-- mission, so deleting a Mission Day removes everything scoped to it.

CREATE TABLE organisers (
  email TEXT PRIMARY KEY,
  codename TEXT NOT NULL DEFAULT '',
  faction TEXT CHECK (faction IN ('ENL', 'RES'))
);

CREATE TABLE mission_days (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  year INTEGER NOT NULL,
  date TEXT,
  format TEXT NOT NULL CHECK (format IN ('standard18', 'standard24', 'lite6')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'approved', 'done')),
  team_json TEXT NOT NULL DEFAULT '{}',
  letter_json TEXT NOT NULL DEFAULT '{}',
  my_maps_url TEXT,
  map_screenshot_key TEXT,
  default_overlay_key TEXT,
  participant_view_enabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE memberships (
  mission_day_id TEXT NOT NULL REFERENCES mission_days (id) ON DELETE CASCADE,
  organiser_email TEXT NOT NULL REFERENCES organisers (email) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  PRIMARY KEY (mission_day_id, organiser_email)
);

CREATE INDEX memberships_by_organiser ON memberships (organiser_email);

CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  mission_day_id TEXT NOT NULL REFERENCES mission_days (id) ON DELETE CASCADE,
  landmark TEXT NOT NULL DEFAULT '',
  description_json TEXT NOT NULL DEFAULT '{}',
  photo_key TEXT,
  photo_version INTEGER NOT NULL DEFAULT 0,
  crop_json TEXT,
  selected INTEGER NOT NULL DEFAULT 0,
  recommended_order INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  colour TEXT NOT NULL
);

CREATE INDEX missions_by_mission_day ON missions (mission_day_id);

CREATE TABLE waypoints (
  mission_id TEXT NOT NULL REFERENCES missions (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  portal_guid TEXT,
  title TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  image_url TEXT,
  PRIMARY KEY (mission_id, position)
);
