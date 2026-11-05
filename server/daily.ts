// Daily puzzles. The D1 `puzzles` table maps each date to its answer. It isn't
// in the repo, so upcoming answers can't be read from GitHub.
//
// The table fills itself: the first request for a date with no row picks a
// random dish (pickDish) and stores it, so every later player, on any Worker
// instance, gets the same answer. scripts/schedule.ts can hand-pick future
// dates ahead of that.
//
// A daily puzzle's id is its date (YYYY-MM-DD), the player's local date, as in
// Wordle. Past puzzles stay playable. A date that hasn't started in any time
// zone yet is refused: the server is stateless, so anyone could otherwise
// replay nine wrong guesses on tomorrow's puzzle to see its answer a day early.

/** The slice of Cloudflare's D1 binding that this module uses. */
export interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** The earliest time zone (UTC+14) starts each day 14 hours before UTC; the latest (UTC−12) ends it 12 hours after. */
const MAX_UTC_OFFSET_MS = 14 * HOUR_MS;
const MIN_UTC_OFFSET_MS = -12 * HOUR_MS;

export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** True for a real calendar date written as YYYY-MM-DD. */
export function isDailyId(id: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return false;
  const ms = Date.parse(id);
  return !Number.isNaN(ms) && isoDate(ms) === id; // Rejects 2026-02-30 etc.
}

/** The newest date that has already begun somewhere on Earth. */
export const latestReleasedDate = (now = Date.now()) => isoDate(now + MAX_UTC_OFFSET_MS);
/** The oldest date that is still "today" somewhere on Earth. */
export const earliestLiveDate = (now = Date.now()) => isoDate(now + MIN_UTC_OFFSET_MS);

export const isReleased = (date: string) => date <= latestReleasedDate();
/** Today somewhere on Earth: the only dates the Worker will pick an answer for. */
export const isLive = (date: string) => date >= earliestLiveDate() && date <= latestReleasedDate();

/**
 * A random dish id for `date`, given the dates already scheduled (date → dish
 * id, past and future). Dishes that have never been an answer come first; once
 * every dish has had a turn, a dish can't come back within half the dish
 * list's length in days of any other date it's on.
 */
export function pickDish(date: string, schedule: Map<string, string>, dishIds: string[]): string {
  const usedOn = new Map<string, string[]>();
  for (const [d, id] of schedule) usedOn.set(id, [...(usedOn.get(id) ?? []), d]);
  const cooldownDays = Math.floor(dishIds.length / 2);
  const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;

  const fresh = dishIds.filter((id) => !usedOn.has(id));
  const rested = dishIds.filter((id) => usedOn.get(id)?.every((d) => daysApart(d, date) >= cooldownDays));
  const pool = fresh.length ? fresh : rested.length ? rested : dishIds;
  return pool[Math.floor(Math.random() * pool.length)];
}

// A released date's answer never changes (the schedule script refuses to edit
// them), so each Worker instance looks a date up at most once.
const cache = new Map<string, string>();

const selectAnswer = (db: D1Database, date: string) =>
  db.prepare('SELECT dish_id FROM puzzles WHERE date = ?').bind(date).first<{ dish_id: string }>();

/**
 * The answer's dish id for a released date. A live date with no answer yet
 * gets one picked now; a past date with none (from before the game started)
 * returns null.
 */
export async function dailyAnswerId(db: D1Database, date: string, dishIds: string[]): Promise<string | null> {
  const hit = cache.get(date);
  if (hit) return hit;

  let row = await selectAnswer(db, date);
  if (!row && isLive(date)) {
    const { results } = await db.prepare('SELECT date, dish_id FROM puzzles').bind().all<{ date: string; dish_id: string }>();
    const pick = pickDish(date, new Map(results.map((r) => [r.date, r.dish_id])), dishIds);
    // If another request picked this date first, keep its answer: OR IGNORE
    // leaves the existing row, and the re-read returns it.
    await db.prepare('INSERT OR IGNORE INTO puzzles (date, dish_id) VALUES (?, ?)').bind(date, pick).run();
    row = await selectAnswer(db, date);
  }
  if (row) cache.set(date, row.dish_id);
  return row?.dish_id ?? null;
}
