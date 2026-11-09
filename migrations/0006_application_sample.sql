-- The picture sent with the application replaces the hand-written link:
-- it is generated once from the admin area and served at a fixed address.
-- At most one partner per Mission Day can be the one shown in it.

ALTER TABLE mission_days DROP COLUMN logo_url;
ALTER TABLE mission_days ADD COLUMN application_difference TEXT NOT NULL DEFAULT '';
ALTER TABLE mission_days ADD COLUMN sample_key TEXT;
ALTER TABLE mission_days ADD COLUMN sample_type TEXT;
ALTER TABLE mission_days ADD COLUMN sample_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_days ADD COLUMN sample_partner_id TEXT;
