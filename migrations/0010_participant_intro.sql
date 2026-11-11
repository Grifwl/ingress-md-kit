-- Each Mission Day can present itself to agents in its own words, per
-- language, at the top of its participant view.

ALTER TABLE mission_days ADD COLUMN participant_intro_json TEXT NOT NULL DEFAULT '{}';
