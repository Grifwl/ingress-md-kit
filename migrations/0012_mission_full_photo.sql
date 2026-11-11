-- Mission photos in full quality. The 512 px PNG stays the photo every
-- page and export uses; next to it the browser now also stores the same
-- square crop at the resolution of the original (up to a limit), as a
-- JPEG, so that printed Biocards stay sharp. Photos uploaded before this
-- change have no full-quality copy and the cards fall back to 512 px.

ALTER TABLE missions ADD COLUMN photo_full_key TEXT;
ALTER TABLE missions ADD COLUMN photo_full_size INTEGER;
