-- Game history for signed-in players: one row per game, written as they play
-- (server/plays.ts). A Daily dish's puzzle_id is its date; a Rush hour one is
-- its sealed practice id, unique per game.
CREATE TABLE plays (
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  puzzle_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('daily', 'rush')),
  dish_id TEXT NOT NULL,                -- the answer
  guesses TEXT NOT NULL,                -- JSON array of guessed dish ids, oldest first
  guess_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('playing', 'won', 'lost')),
  started_at INTEGER NOT NULL,          -- ms since epoch
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, puzzle_id)
);
CREATE INDEX plays_by_user_mode ON plays (user_id, mode, started_at DESC);
