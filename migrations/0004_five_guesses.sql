-- Games went from 9 guesses to 5 (MAX_GUESSES in shared/types.ts). Unfinished
-- games that already have 5 or more guesses are out of plates under the new
-- limit, so they're recorded as lost. Otherwise they could never be replayed,
-- and an unfinished Rush hour would block new ones forever.
UPDATE plays SET status = 'lost' WHERE status = 'playing' AND guess_count >= 5;
