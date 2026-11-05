// Optional tools for the daily puzzle schedule (the D1 `puzzles` table). You
// don't need to run this: the Worker picks each day's answer on that day's
// first request (server/daily.ts). Use it to choose answers yourself.
//
//   npm run schedule -- --set 2026-12-25=gingerbread    hand-pick a date (repeatable)
//   npm run schedule -- --days 30                       pre-pick the next 30 days now
//   add --remote to change production instead of the local dev database
//
// --set overwrites a date, but refuses one that has already started in some
// time zone, since players may be mid-game (and the Worker caches it).
// --days only fills empty dates, using the same picking rules as the Worker.
//
// It prints dates only, never answers, so running it doesn't spoil anything.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { earliestLiveDate, isDailyId, isoDate, latestReleasedDate, pickDish } from '../server/daily';
import { DISHES, DISH_BY_ID } from '../server/dishes';

const DAY_MS = 86_400_000;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    remote: { type: 'boolean', default: false },
    days: { type: 'string', default: '0' },
    set: { type: 'string', multiple: true, default: [] },
  },
});
const days = Number(values.days);
if (!Number.isInteger(days) || days < 0) fail('--days must be a whole number');
if (!days && !values.set.length) {
  fail('Nothing to do. The Worker picks each day itself; use --set DATE=dish-id or --days N (see scripts/schedule.ts).');
}

const d1 = (...args: string[]) =>
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'grubblio', values.remote ? '--remote' : '--local', ...args], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });

const [{ results }] = JSON.parse(d1('--json', '--command', 'SELECT date, dish_id FROM puzzles')) as [
  { results: { date: string; dish_id: string }[] },
];
const schedule = new Map(results.map((r) => [r.date, r.dish_id]));
const writes = new Map<string, string>();

const live = latestReleasedDate();
for (const arg of values.set) {
  const [date, id] = arg.split('=');
  if (!isDailyId(date) || !id) fail(`--set ${arg}: expected YYYY-MM-DD=dish-id`);
  if (!DISH_BY_ID.has(id)) fail(`--set ${arg}: no dish has the id "${id}" (see server/dishes.ts)`);
  if (date <= live) fail(`--set ${arg}: ${date} has already started in some time zone, so it can't change`);
  schedule.set(date, id);
  writes.set(date, id);
}

// From the earliest date anyone is still on to `days` ahead.
const filled: string[] = [];
if (days) {
  const ids = DISHES.map((d) => d.id);
  const end = isoDate(Date.now() + days * DAY_MS);
  for (let ms = Date.parse(earliestLiveDate()); isoDate(ms) <= end; ms += DAY_MS) {
    const date = isoDate(ms);
    if (schedule.has(date)) continue;
    const id = pickDish(date, schedule, ids);
    schedule.set(date, id);
    writes.set(date, id);
    filled.push(date);
  }
}

if (writes.size) {
  const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const sql = [...writes]
    .map(([date, id]) => `INSERT OR REPLACE INTO puzzles (date, dish_id) VALUES (${quote(date)}, ${quote(id)});`)
    .join('\n');
  const dir = mkdtempSync(join(tmpdir(), 'grubblio-schedule-'));
  try {
    writeFileSync(join(dir, 'schedule.sql'), sql);
    d1('--yes', '--file', join(dir, 'schedule.sql'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const where = values.remote ? 'production' : 'local';
if (values.set.length) console.log(`Hand-picked ${values.set.length} date(s) in the ${where} schedule.`);
if (days) {
  console.log(
    filled.length
      ? `Pre-picked ${filled.length} day(s) in the ${where} schedule: ${filled[0]} → ${filled.at(-1)}.`
      : `Nothing to fill: the ${where} schedule already covers the next ${days} days.`,
  );
}
