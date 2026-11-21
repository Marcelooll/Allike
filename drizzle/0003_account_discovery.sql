ALTER TABLE auth_sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE discovery_feedback (
  owner TEXT NOT NULL,
  target TEXT NOT NULL,
  interest INTEGER NOT NULL CONSTRAINT discovery_feedback_interest CHECK(interest IN (-1,1)),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,target)
);
