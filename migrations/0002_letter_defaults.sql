-- Settings of the whole instance, kept in a table of exactly one row.
-- The default letter texts live in the database rather than in the
-- repository because they are written by each community.

CREATE TABLE instance_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  letter_defaults_json TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO instance_settings (id) VALUES (1);
