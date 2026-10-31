// Cloudflare Worker for the game API. The built client and the dish photos
// (/images/*) are Workers static assets; only /api/* reaches this code
// (run_worker_first in wrangler.jsonc).
import type { ResolveResponse, StateRequest } from '../shared/types';
import { DISHES, DISH_BY_ID } from './dishes';
import { buildState, GuessError, summarize } from './game';
import { openPracticeId, sealPracticeId } from './practice';
import { resolve } from './resolve';

/** Shown next to the title for random (practice) puzzles. */
const PRACTICE_LABEL = 'Rush hour';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Dish id for the fixed test puzzle. */
  ANSWER: string;
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

async function api(request: Request, url: URL, env: Env): Promise<Response> {
  const test = DISH_BY_ID.get(env.ANSWER);
  if (!test) throw new Error(`ANSWER=${env.ANSWER} is not a known dish id`);
  const secret = env.PUZZLE_SECRET ?? DEV_SECRET;
  const route = `${request.method} ${url.pathname}`;

  if (route === 'GET /api/resolve') {
    const { exact, suggestions } = resolve(url.searchParams.get('q') ?? '');
    const body: ResolveResponse = { exact: exact && summarize(exact), suggestions: suggestions.map(summarize) };
    return json(body);
  }

  if (route === 'GET /api/puzzle') {
    if (url.searchParams.get('mode') === 'practice') {
      const answer = DISHES[Math.floor(Math.random() * DISHES.length)];
      return json(buildState(await sealPracticeId(answer.id, secret), PRACTICE_LABEL, answer, []));
    }
    return json(buildState('test', 'Test puzzle', test, []));
  }

  if (route === 'POST /api/state') {
    const { puzzleId, guesses } = (await request.json().catch(() => ({}))) as Partial<StateRequest>;
    const answer = puzzleId === 'test'
      ? test
      : puzzleId && DISH_BY_ID.get((await openPracticeId(puzzleId, secret)) ?? '');
    if (!puzzleId || !answer) return json({ error: 'Unknown puzzle' }, 404);
    if (!Array.isArray(guesses) || !guesses.every((g) => typeof g === 'string')) {
      return json({ error: 'guesses must be an array of dish ids' }, 400);
    }
    return json(buildState(puzzleId, puzzleId === 'test' ? 'Test puzzle' : PRACTICE_LABEL, answer, guesses));
  }

  return json({ error: 'Not found' }, 404);
}
