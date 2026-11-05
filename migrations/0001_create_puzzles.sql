-- Daily puzzle schedule: the answer for each date. Filled ahead of time by
-- scripts/schedule.ts (`npm run schedule`).
CREATE TABLE puzzles (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD, the player's local date
  dish_id TEXT NOT NULL  -- an id from server/dishes.ts
);
