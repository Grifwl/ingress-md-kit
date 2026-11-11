-- Biocards: printed cards for each mission and for the Mission Day as a
-- whole. The Mission Day keeps the two templates (front and back), the
-- photo of its own card, an optional font, and the layout and texts of
-- the cards as JSON. A mission can have a shorter name for its card.
-- Partners are asked whether they want to appear on the cards, and their
-- answer is recorded next to the request sent to them.

ALTER TABLE mission_days ADD COLUMN biocard_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE mission_days ADD COLUMN biocard_front_key TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_front_type TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_front_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_days ADD COLUMN biocard_back_key TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_back_type TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_back_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_days ADD COLUMN biocard_photo_key TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_photo_type TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_photo_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_days ADD COLUMN biocard_font_key TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_font_type TEXT;
ALTER TABLE mission_days ADD COLUMN biocard_font_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE missions ADD COLUMN biocard_name TEXT NOT NULL DEFAULT '';

ALTER TABLE partners ADD COLUMN biocard_request_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE partners ADD COLUMN biocard_answer TEXT NOT NULL DEFAULT 'pending'
  CHECK (biocard_answer IN ('pending', 'no', 'yes', 'own'));
