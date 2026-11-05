# Grubblio (prototype)

Guess the dish from its ingredients. You start with three ingredients. Each wrong guess reveals another ingredient. You get 9 guesses. When the game ends, it shows the answer with a photo.

Each guess is compared with the answer column by column, in the style of Royaledle:

| Column | Green | Yellow | Red |
|---|---|---|---|
| Type | same family (Pizza) | related family (Flatbread, Sandwich…) | otherwise |
| Origin | same country | same region (e.g. Europe) | otherwise |
| Diet | same | one step on Vegan → Vegetarian → Pescatarian → Omnivore | otherwise |
| Palate | identical set | some overlap | none |
| Course | same | both light (starter/side/snack) | otherwise |
| Method | same | same style (dry heat / oil / wet heat) | otherwise |
| Spice | same | off by one (▲▼ arrows show which way) | further |
| Ingredients | n/a | ≥25% of the answer's ingredients shared | fewer |

A **closeness** score (0–100%) combines all the columns, so players can tell when they're close.

There is no autocomplete. On submit, an exact name or alias ("Chicken Parm", "Lasagne") is guessed straight away. Anything close gets a **"Did you mean …?"** prompt instead. Matching uses only dish names and their `aliases` (also-known-as names). What you type has to read as a whole name, with small typos allowed: "bufalo chiken pizza" → Buffalo Chicken Pizza, and "pinapple pizza" → Hawaiian Pizza via its "Pineapple Pizza" alias. A name of three or more words can be missing one word ("buffalo chicken"). Ingredients and single fragments ("pineapple", "chicken") match nothing, so players can't search their way to the answer. To accept another way of naming a dish, add an alias in `server/dishes.ts`.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 — site + API Worker in one process
```

The API is a Cloudflare Worker ([server/index.ts](server/index.ts)). `npm run dev` runs it locally inside Vite via `@cloudflare/vite-plugin`, so no Cloudflare account is needed for development.

Before starting, `npm run dev` sets up a local copy of the database in `.wrangler/`. The game opens on the **Daily dish**: the day's scheduled puzzle for your local date. Use **Rush hour** in the header to play a random dish.

## Daily dish

The daily answers are stored in a D1 (Cloudflare's SQLite) table, `puzzles (date → dish_id)`, defined in [migrations/](migrations/). They're kept out of the repo so nobody can read upcoming answers on GitHub. A puzzle's id is its date in the player's local time, as in Wordle. Past dates stay playable. The API refuses a date that hasn't started in any time zone yet. Without that check, anyone could replay nine wrong guesses on tomorrow's puzzle and see its answer early.

**Each day's answer picks itself.** The first request for a date with no answer yet picks a random dish and stores it, so every later player gets the same one ([server/daily.ts](server/daily.ts)). Dishes that have never been an answer come first. Once every dish has had a turn, a dish can't come back within about four months. A newly added dish is picked soon after it's deployed. There's nothing to top up or schedule. Answers are only picked for dates that are "today" somewhere, so an old date with no answer stays empty.

To choose answers yourself, use [scripts/schedule.ts](scripts/schedule.ts). It prints dates, never answers:

```bash
npm run schedule -- --remote --set 2026-12-25=gingerbread   # hand-pick a date (repeatable)
npm run schedule -- --remote --days 30                      # pre-pick the next 30 days now
```

Leave out `--remote` to change the local dev database instead. `--set` replaces a date's dish, but only for dates that haven't started anywhere yet. Deploy a new dish before you hand-pick it, or that day's puzzle will name a dish the live site doesn't know.

To try a specific answer locally, change today's row directly (`--set` won't touch a date that has started):
`npx wrangler d1 execute grubblio --local --command "UPDATE puzzles SET dish_id = 'pad-thai' WHERE date = '2026-11-05'"`.

The Worker caches each date's answer in memory. Each instance reads D1 at most once per date, which keeps D1 reads far under the free plan's 5 million a day.

Production-style build: `npm run preview` builds, then serves the built site and Worker locally.

Photos: `npm run fetch-images` downloads a photo for each dish and saves its credit in `assets/dishes/credits.json`. It uses free, watermark-free stock photos from **Pixabay** (or Pexels) when an API key is set. Copy `.env.example` to `.env` and add `PIXABAY_API_KEY` (or `PEXELS_API_KEY`); both keys are free. Without a key it falls back to Wikimedia Commons. Run `npm run fetch-images -- --force` to replace every photo. A dish's photo is replaced only when the stock photo's description names that dish; otherwise the dish keeps its current photo, so no dish is left without one.

Pixabay and Pexels photos are **not committed**: their licences don't allow redistributing the raw files, so `assets/dishes/.gitignore` (regenerated on every `fetch-images` run) lists them, while `credits.json` stays in git. After cloning, run `npm run fetch-images -- --restore` with `PIXABAY_API_KEY` set to download exactly the recorded photos again. Wikimedia Commons photos are committed, with their credits.

Music: [jazz_music_loop](https://freesound.org/s/456797/) by [NikoSardas](https://freesound.org/people/NikoSardas/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It's committed in `public/audio/` and credited in the in-game Credits. The game changes its playback speed: it gets faster with each wrong guess, up to 2×.

Plate-breaking sound: [Plate-5](https://freesound.org/s/381264/) by [edwar64896](https://freesound.org/people/edwar64896/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It's also committed in `public/audio/` and credited in the in-game Credits. It plays on every wrong guess.

Page-turn sound: [Page Turn - Please Turn Over (PTO)](https://freesound.org/s/63318/) by [flag2](https://freesound.org/people/flag2/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It's also committed in `public/audio/` and credited in the in-game Credits. It plays whenever a new order ticket is put up, and when the Help or Credits menu opens.

Right-answer sound: [Bite (Cartoon Style)](https://freesound.org/s/353067/) by [Jofae](https://freesound.org/people/Jofae/), released under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). No credit is required, but it's listed in the in-game Credits anyway.

Game-over sound: [Glass](https://freesound.org/s/536763/) by [egomassive](https://freesound.org/people/egomassive/), released under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). It plays when the last guess is wrong, and is also listed in the in-game Credits.

## Deploy (Cloudflare Workers)

One Worker serves everything: the built site and dish photos as static assets, and `/api/*` from [server/index.ts](server/index.ts). It's configured in [wrangler.jsonc](wrangler.jsonc), including the `grubbl.io` and `www.grubbl.io` custom domains. Cloudflare creates their DNS records and certificates on the first deploy.

1. In Cloudflare → DNS for grubbl.io, **delete any existing records named `grubbl.io` (`@`) or `www`** (for example parking records). Custom domains can't be attached while they exist.
2. Create the database once: `npx wrangler login`, then `npx wrangler d1 create grubblio`, and paste the `database_id` it prints into the `d1_databases` entry in [wrangler.jsonc](wrangler.jsonc). Then create the table: `npx wrangler d1 migrations apply grubblio --remote`.
3. Push the repo to GitHub. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick it.
4. Set the build settings:
   - **Build command:** `npm run fetch-images -- --restore && npm run build`
   - **Deploy command:** `npx wrangler d1 migrations apply grubblio --remote && npx wrangler deploy`. This applies any new migrations before each deploy.
   - **Build variable:** `PIXABAY_API_KEY`. The build restores the stock photos that aren't committed (see Photos above). Without it, those dishes show their emoji.
5. After the first deploy, open the Worker's **Settings → Variables and Secrets** and add a **secret** named `PUZZLE_SECRET` set to a long random string (`openssl rand -base64 32`). It encrypts practice puzzle ids, so the answer can't be read out of them. Without it, the Worker falls back to a dev key that's public in this repo.

Every push to the main branch then redeploys. To deploy from your machine instead: `npx wrangler login`, then `npm run deploy`.

Practice puzzles are stateless: the puzzle id carries its answer, AES-GCM encrypted (see [server/practice.ts](server/practice.ts)), so they survive deploys and need no storage.

## Layout

```
shared/types.ts        API types shared by client + server
server/dishes.ts       dish database (attributes + ordered ingredient lists)
server/game.ts         comparison, closeness score, ingredient unlocks
server/index.ts        API (Cloudflare Worker)
server/daily.ts        daily puzzles: picking, D1 lookup, date checks, cache
server/practice.ts     encrypted, stateless practice puzzle ids
migrations/            D1 schema (the puzzles schedule)
scripts/schedule.ts    hand-picks daily answers (optional)
client/src/            React app (Vite)
index.html             Vite entry page
scripts/fetch-images.ts photo download / --restore
wrangler.jsonc         Worker config: static assets, D1, custom domains
```

The server is stateless per player. The client keeps its list of guessed dish ids in `localStorage`, and `POST /api/state` replays them to rebuild the board. The answer is sent only after the game ends.

## Not covered by this prototype (needed for production)

- **Dish data in a database.** Dishes are still in code (`server/dishes.ts`). That's fine while developers edit them; move them to D1 once non-developers need an editor. A `plays` table for stats would also go in D1.
- **Reviewing upcoming answers.** Answers are picked on the day, so there's nothing to review ahead of time. A daily Cron Trigger running the `--days` logic would keep a month picked ahead for review.
- **Anti-cheat.** Because the server is stateless, a client can replay invented guess lists to reach the reveal. Server-side sessions, or signed state tokens, would fix this.
- **Image curation and hosting.** Someone should review each photo by eye, and production should serve them from a CDN. A paid library such as Adobe Stock needs a purchased licence for each image.
- **Content.** A larger dish list (the prototype has about 230), editorial review of ingredient order and difficulty for each answer, and playtesting.
- **Accounts and stats** (streaks, guess distribution), if wanted.
