ALTER TABLE connections ADD COLUMN notice TEXT;
ALTER TABLE connections ADD COLUMN last_import_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
CREATE TABLE integration_secrets (
  provider TEXT PRIMARY KEY NOT NULL,
  encrypted_key TEXT NOT NULL,
  updated INTEGER NOT NULL
);
