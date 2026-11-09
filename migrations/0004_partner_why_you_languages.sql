-- The "why this entity" text becomes per-language, like the logo request.
-- What had been written is kept under the partner's letter language.

ALTER TABLE partners ADD COLUMN why_you_json TEXT NOT NULL DEFAULT '{}';

UPDATE partners
SET why_you_json = json_object(letter_language, why_you)
WHERE why_you <> '';

ALTER TABLE partners DROP COLUMN why_you;
