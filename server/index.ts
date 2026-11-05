// Cloudflare Worker for the game API. The built client and the dish photos
// (/images/*) are Workers static assets; only /api/* reaches this code
// (run_worker_first in wrangler.jsonc).
import type { ResolveResponse, StateRequest } from '../shared/types';
import { dailyAnswerId, isDailyId, isReleased, type D1Database } from './daily';
import { DISHES, DISH_BY_ID, type Dish } from './dishes';
import { buildState, GuessError, summarize } from './game';
import { openPracticeId, sealPracticeId } from './practice';
import { resolve } from './resolve';

/** Shown next to the title: the day's scheduled puzzle (from D1), or a random practice one. */
const DAILY_LABEL = 'Daily dish';
const PRACTICE_LABEL = 'Rush hour';

const DISH_IDS = DISHES.map((d) => d.id);

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Daily puzzle schedule (migrations/, scripts/schedule.ts). */
  DB: D1Database;
  /** Encrypts practice puzzle ids. Set in production with `wrangler secret put PUZZLE_SECRET`. */
  PUZZLE_SECRET?: string;
}

// Only good enough for local dev: the repo is public, so anyone could decrypt
// practice answers sealed with it.
const DEV_SECRET = 'grubblio-dev-only';

const json = (body: unknown, status = 200) => Response.json(body, { status });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, url, env);
    } catch (e) {
      if (e instanceof GuessError) return json({ error: e.message }, 400);
      throw e;
    }
  },
};

/** The answer and label for a daily (date) or practice puzzle id, or null if unknown. */
async function puzzleFor(puzzleId: string, env: Env): Promise<{ answer: Dish; label: string } | null> {
  if (isDailyId(puzzleId)) {
    if (!isReleased(puzzleId)) throw new GuessError("That day's puzzle isn't out yet");
    const id = await dailyAnswerId(env.DB, puzzleId, DISH_IDS);
    const answer = id ? DISH_BY_ID.get(id) : undefined;
    if (id && !answer) console.error(`Puzzle ${puzzleId} names unknown dish "${id}"`);
    return answer ? { answer, label: DAILY_LABEL } : null;
  }
  const id = await openPracticeId(puzzleId, env.PUZZLE_SECRET ?? DEV_SECRET);
  const answer = id ? DISH_BY_ID.get(id) : undefined;
  return answer ? { answer, label: PRACTICE_LABEL } : null;
}

async function api(request: Request, url: URL, env: Env): Promise<Response> {
  const route = `${request.method} ${url.pathname}`;

  if (route === 'GET /api/resolve') {
    const { exact, suggestions } = resolve(url.searchParams.get('q') ?? '');
    const body: ResolveResponse = { exact: exact && summarize(exact), suggestions: suggestions.map(summarize) };
    return json(body);
  }

  if (route === 'GET /api/puzzle') {
    if (url.searchParams.get('mode') === 'practice') {
      const answer = DISHES[Math.floor(Math.random() * DISHES.length)];
      const id = await sealPracticeId(answer.id, env.PUZZLE_SECRET ?? DEV_SECRET);
      return json(buildState(id, PRACTICE_LABEL, answer, []));
    }
    const date = url.searchParams.get('date') ?? '';
    if (!isDailyId(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400);
    const puzzle = await puzzleFor(date, env);
    if (!puzzle) return json({ error: `No puzzle is scheduled for ${date}` }, 404);
    return json(buildState(date, puzzle.label, puzzle.answer, []));
  }

  if (route === 'POST /api/state') {
    const { puzzleId, guesses } = (await request.json().catch(() => ({}))) as Partial<StateRequest>;
    const puzzle = typeof puzzleId === 'string' ? await puzzleFor(puzzleId, env) : null;
    if (!puzzleId || !puzzle) return json({ error: 'Unknown puzzle' }, 404);
    if (!Array.isArray(guesses) || !guesses.every((g) => typeof g === 'string')) {
      return json({ error: 'guesses must be an array of dish ids' }, 400);
    }
    return json(buildState(puzzleId, puzzle.label, puzzle.answer, guesses));
  }

  return json({ error: 'Not found' }, 404);
}
