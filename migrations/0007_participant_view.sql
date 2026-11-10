-- The participant view can show the images with the overlay of one
-- partner, chosen by an owner. It is only honoured while that partner
-- stays accepted with a signed approval; otherwise the default overlay
-- is used, so a withdrawn permission takes effect without anyone acting.

ALTER TABLE mission_days ADD COLUMN participant_partner_id TEXT;
