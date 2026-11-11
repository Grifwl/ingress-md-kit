-- The home page of the instance offers a way to reach whoever runs it,
-- for communities that would like to use the tool. It is instance data,
-- written by its administrators, so it lives here and not in the code.

ALTER TABLE instance_settings ADD COLUMN contact TEXT NOT NULL DEFAULT '';
