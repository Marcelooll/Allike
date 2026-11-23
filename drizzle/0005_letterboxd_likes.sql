ALTER TABLE items ADD COLUMN liked INTEGER NOT NULL DEFAULT 0;

CREATE TABLE profile_favorites (owner TEXT NOT NULL,provider TEXT NOT NULL,position INTEGER NOT NULL,title TEXT NOT NULL,image TEXT NOT NULL,url TEXT NOT NULL,observed_at INTEGER NOT NULL,PRIMARY KEY(owner,provider,position));
