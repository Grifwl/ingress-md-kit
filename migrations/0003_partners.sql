-- Partners of a Mission Day, the history of their status, and the two
-- images a Mission Day needs for its proposals.

CREATE TABLE partners (
  id TEXT PRIMARY KEY,
  mission_day_id TEXT NOT NULL REFERENCES mission_days (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('city', 'university', 'tourism_board', 'museum', 'ngo', 'other')),
  contact_person TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  why_you TEXT NOT NULL DEFAULT '',
  logo_request_json TEXT NOT NULL DEFAULT '{}',
  letter_language TEXT NOT NULL CHECK (letter_language IN ('ca', 'es', 'en')),
  proposal_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'contacted', 'in_talks', 'accepted', 'declined')),
  logo_key TEXT,
  logo_version INTEGER NOT NULL DEFAULT 0,
  logo_type TEXT,
  overlay_key TEXT,
  overlay_version INTEGER NOT NULL DEFAULT 0,
  overlay_type TEXT,
  approval_key TEXT,
  approval_version INTEGER NOT NULL DEFAULT 0,
  approval_type TEXT,
  approval_name TEXT
);

CREATE INDEX partners_by_mission_day ON partners (mission_day_id);

CREATE TABLE partner_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id TEXT NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL
);

CREATE INDEX partner_status_history_by_partner ON partner_status_history (partner_id);

ALTER TABLE mission_days ADD COLUMN default_overlay_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_days ADD COLUMN default_overlay_type TEXT;
ALTER TABLE mission_days ADD COLUMN map_screenshot_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_days ADD COLUMN map_screenshot_type TEXT;
