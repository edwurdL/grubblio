// Cloudflare Worker for the game API. The built client and the dish photos
// (/images/*) are Workers static assets; only /api/* reaches this code
// (run_worker_first in wrangler.jsonc).
import type { AccountInfo, ResolveResponse, StateRequest } from '../shared/types';
import { createAuth, type Auth, type AuthEnv } from './auth';
import { dailyAnswerId, isDailyId, isReleased, isoDate } from './daily';
import { DISHES, DISH_BY_ID, type Dish } from './dishes';
import { buildState, GuessError, MAX_GUESSES, summarize } from './game';
import { loadHistory, recordPlay, unfinishedRush } from './plays';
import { openPracticeId, sealPracticeId } from './practice';
import { resolve } from './resolve';

/** Shown next to the title: the day's scheduled puzzle (from D1), or a random practice one. */
const DAILY_LABEL = 'Daily dish';
const PRACTICE_LABEL = 'Rush hour';

const DISH_IDS = DISHES.map((d) => d.id);

interface Env extends AuthEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Encrypts practice puzzle ids. Set in production with `wrangler secret put PUZZLE_SECRET`. */
  PUZZLE_SECRET?: string;
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

// Only good enough for local dev: the repo is public, so anyone could decrypt
// practice answers sealed with it.
const DEV_SECRET = 'grubblio-dev-only';

const json = (body: unknown, status = 200) => Response.json(body, { status });

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, url, env, ctx);
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

/** Better Auth's session cookie ("__Secure-" prefixed over HTTPS). */
const hasSessionCookie = (request: Request) => /(^|;\s*)(__Secure-)?better-auth\.session_token=/.test(request.headers.get('cookie') ?? '');

async function api(request: Request, url: URL, env: Env, ctx: Ctx): Promise<Response> {
  const route = `${request.method} ${url.pathname}`;
  // Built only for requests that need it, so anonymous play skips it entirely.
  let auth: Auth | undefined;
  const getAuth = () => (auth ??= createAuth(env, url.origin, (p) => ctx.waitUntil(p)));
  const getUser = async () =>
    hasSessionCookie(request) ? ((await getAuth().api.getSession({ headers: request.headers }))?.user ?? null) : null;

  if (url.pathname.startsWith('/api/auth/')) return getAuth().handler(request);

  if (route === 'GET /api/resolve') {
    const { exact, suggestions } = resolve(url.searchParams.get('q') ?? '');
    const body: ResolveResponse = { exact: exact && summarize(exact), suggestions: suggestions.map(summarize) };
    return json(body);
  }

  if (route === 'GET /api/puzzle') {
    if (url.searchParams.get('mode') === 'practice') {
      // A signed-in player gets back their oldest unfinished Rush hour (from
      // any device) before a new dish is dealt.
      const user = await getUser();
      const open = user && (await unfinishedRush(env.DB, user.id));
      const openDish = open && DISH_BY_ID.get(open.dishId);
      if (open && openDish) return json(buildState(open.puzzleId, PRACTICE_LABEL, openDish, open.guesses));

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
    const state = buildState(puzzleId, puzzle.label, puzzle.answer, guesses);
    const user = await getUser();
    if (user) {
      const mode = isDailyId(puzzleId) ? 'daily' : 'rush';
      // After the response, so saving history never slows a guess down.
      ctx.waitUntil(recordPlay(env.DB, user.id, mode, puzzle.answer.id, state).catch((e) => console.error('recordPlay', e)));
    }
    return json(state);
  }

  // ── Account ──────────────────────────────────────────
  if (url.pathname === '/api/account' || url.pathname.startsWith('/api/account/') || route === 'GET /api/history') {
    const user = await getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);
    const hasPassword = async () =>
      !!(await env.DB.prepare(
        `SELECT 1 AS yes FROM account WHERE userId = ? AND providerId = 'credential' AND password IS NOT NULL`,
      ).bind(user.id).first<{ yes: number }>());

    if (route === 'GET /api/account') {
      const body: AccountInfo = { name: user.name, email: user.email, hasPassword: await hasPassword() };
      return json(body);
    }

    // Sets the first password on an account made with an emailed code. (To
    // change an existing one, the client uses Better Auth's /change-password.)
    if (route === 'POST /api/account/password') {
      const { password } = (await request.json().catch(() => ({}))) as { password?: unknown };
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return json({ error: 'Password must be 8 to 128 characters' }, 400);
      }
      if (await hasPassword()) return json({ error: 'This account already has a password' }, 409);
      await getAuth().api.setPassword({ body: { newPassword: password }, headers: request.headers });
      return json({ ok: true });
    }

    if (route === 'GET /api/history') {
      const today = url.searchParams.get('today') ?? '';
      return json(await loadHistory(env.DB, user.id, MAX_GUESSES, isDailyId(today) ? today : isoDate(Date.now())));
    }
  }

  return json({ error: 'Not found' }, 404);
}
