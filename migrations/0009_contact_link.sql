-- The home page contact becomes a label plus the address it links to,
-- so that it can read "@someone" while pointing to a Telegram link, or
-- show a name while pointing to a mailto: address.

ALTER TABLE instance_settings RENAME COLUMN contact TO contact_label;
ALTER TABLE instance_settings ADD COLUMN contact_url TEXT NOT NULL DEFAULT '';
