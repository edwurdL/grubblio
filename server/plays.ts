// Game history for signed-in players (the `plays` table, migrations/0003).
//
// Each POST /api/state from a signed-in player records the game. A recorded
// game only moves forward: an update must extend the stored guesses, and a
// won or lost game never changes again. That stops a player from replacing a
// loss by replaying a different guess list once they've seen the answer.
import type { GameHistory, GameState, HistoryGame, ModeHistory, PlayMode } from '../shared/types';
import type { D1Database } from './daily';
import { DISH_BY_ID } from './dishes';
import { summarize } from './game';

/** Games listed per mode; stats still count every game. */
const LIST_LIMIT = 100;

export async function recordPlay(db: D1Database, userId: string, mode: PlayMode, dishId: string, state: GameState) {
  if (!state.guesses.length) return; // Nothing to record until the first guess.
  const guesses = JSON.stringify(state.guesses.map((g) => g.dish.id));
  const now = Date.now();
  await db.prepare(
    `INSERT INTO plays (user_id, puzzle_id, mode, dish_id, guesses, guess_count, status, started_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
     ON CONFLICT (user_id, puzzle_id) DO UPDATE SET
       guesses = excluded.guesses, guess_count = excluded.guess_count,
       status = excluded.status, updated_at = excluded.updated_at
     WHERE plays.status = 'playing'
       AND excluded.guess_count > plays.guess_count
       -- The stored list, minus its closing "]", must start the new one.
       AND substr(excluded.guesses, 1, length(plays.guesses) - 1) = substr(plays.guesses, 1, length(plays.guesses) - 1)`,
  ).bind(userId, state.puzzleId, mode, dishId, guesses, state.guesses.length, state.status, now).run();
}

interface PlayRow {
  puzzle_id: string;
  mode: PlayMode;
  dish_id: string;
  guess_count: number;
  status: HistoryGame['status'];
  started_at: number;
}

const DAY_MS = 86_400_000;
const dayBefore = (date: string) => new Date(Date.parse(date) - DAY_MS).toISOString().slice(0, 10);
const nextDay = (date: string) => new Date(Date.parse(date) + DAY_MS).toISOString().slice(0, 10);

function summarizeMode(rows: PlayRow[], maxGuesses: number, today: string | null): ModeHistory {
  const finished = rows.filter((r) => r.status !== 'playing');
  const won = finished.filter((r) => r.status === 'won');
  const distribution = Array.from({ length: maxGuesses }, (_, i) => won.filter((r) => r.guess_count === i + 1).length);

  const history: ModeHistory = {
    stats: {
      played: finished.length,
      won: won.length,
      winRate: finished.length ? Math.round((won.length / finished.length) * 100) : 0,
      distribution,
    },
    games: rows.slice(0, LIST_LIMIT).map((r) => {
      const dish = DISH_BY_ID.get(r.dish_id);
      return {
        puzzleId: r.puzzle_id,
        status: r.status,
        guesses: r.guess_count,
        startedAt: r.started_at,
        // Only reveal answers to finished games.
        answer: r.status !== 'playing' && dish ? summarize(dish) : null,
      };
    }),
  };

  // Daily streaks: consecutive dates won, as in Wordle. The current streak is
  // still alive if the last win was today or yesterday (player's local date).
  if (today) {
    const wins = new Set(won.map((r) => r.puzzle_id));
    let best = 0;
    for (const date of wins) {
      if (wins.has(dayBefore(date))) continue; // Not the start of a run.
      let length = 1;
      for (let d = date; wins.has(nextDay(d)); d = nextDay(d)) length++;
      best = Math.max(best, length);
    }
    let current = 0;
    let d = wins.has(today) ? today : dayBefore(today);
    while (wins.has(d)) {
      current++;
      d = dayBefore(d);
    }
    history.stats.currentStreak = current;
    history.stats.maxStreak = best;
  }
  return history;
}

export async function loadHistory(db: D1Database, userId: string, maxGuesses: number, today: string): Promise<GameHistory> {
  const { results } = await db.prepare(
    'SELECT puzzle_id, mode, dish_id, guess_count, status, started_at FROM plays WHERE user_id = ? ORDER BY started_at DESC',
  ).bind(userId).all<PlayRow>();
  // Daily dishes sort by puzzle date, which can differ from when they were played.
  const daily = results.filter((r) => r.mode === 'daily').sort((a, b) => b.puzzle_id.localeCompare(a.puzzle_id));
  return {
    daily: summarizeMode(daily, maxGuesses, today),
    rush: summarizeMode(results.filter((r) => r.mode === 'rush'), maxGuesses, null),
  };
}
