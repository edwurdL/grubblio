# Grubblio (prototype)

Guess the dish from its ingredients. You start with three ingredients. Each wrong guess reveals another ingredient. You get 10 guesses. When the game ends, it shows the answer with a photo.

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

The **test puzzle's** answer is French Fries. To test a different answer, create `.dev.vars` containing `ANSWER=<dish-id>` (ids are in `server/dishes.ts`). Use **New practice** in the header to play a random dish.

Production-style build: `npm run preview` builds, then serves the built site and Worker locally.

Photos: `npm run fetch-images` downloads a photo for each dish and saves its credit in `assets/dishes/credits.json`. It uses free, watermark-free stock photos from **Pixabay** (or Pexels) when an API key is set. Copy `.env.example` to `.env` and add `PIXABAY_API_KEY` (or `PEXELS_API_KEY`); both keys are free. Without a key it falls back to Wikimedia Commons. Run `npm run fetch-images -- --force` to replace every photo. A dish's photo is replaced only when the stock photo's description names that dish; otherwise the dish keeps its current photo, so no dish is left without one.

Pixabay and Pexels photos are **not committed**: their licences don't allow redistributing the raw files, so `assets/dishes/.gitignore` (regenerated on every `fetch-images` run) lists them, while `credits.json` stays in git. After cloning, run `npm run fetch-images -- --restore` with `PIXABAY_API_KEY` set to download exactly the recorded photos again. Wikimedia Commons photos are committed, with their credits.

## Deploy (Cloudflare Workers)

One Worker serves everything: the built site and dish photos as static assets, and `/api/*` from [server/index.ts](server/index.ts). It's configured in [wrangler.jsonc](wrangler.jsonc), including the `grubbl.io` and `www.grubbl.io` custom domains. Cloudflare creates their DNS records and certificates on the first deploy.

1. In Cloudflare → DNS for grubbl.io, **delete any existing records named `grubbl.io` (`@`) or `www`** (for example parking records). Custom domains can't be attached while they exist.
2. Push the repo to GitHub. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick it.
3. Set the build settings:
   - **Build command:** `npm run fetch-images -- --restore && npm run build`
   - **Deploy command:** `npx wrangler deploy` (the default)
   - **Build variable:** `PIXABAY_API_KEY`. The build restores the stock photos that aren't committed (see Photos above). Without it, those dishes show their emoji.
4. After the first deploy, open the Worker's **Settings → Variables and Secrets** and add a **secret** named `PUZZLE_SECRET` set to a long random string (`openssl rand -base64 32`). It encrypts practice puzzle ids, so the answer can't be read out of them. Without it, the Worker falls back to a dev key that's public in this repo.

Every push to the main branch then redeploys. To deploy from your machine instead: `npx wrangler login`, then `npm run deploy`.

Practice puzzles are stateless: the puzzle id carries its answer, AES-GCM encrypted (see [server/practice.ts](server/practice.ts)), so they survive deploys and need no storage.

## Layout

```
shared/types.ts        API types shared by client + server
server/dishes.ts       dish database (attributes + ordered ingredient lists)
server/game.ts         comparison, closeness score, ingredient unlocks
server/index.ts        API (Cloudflare Worker)
server/practice.ts     encrypted, stateless practice puzzle ids
client/src/            React app (Vite)
index.html             Vite entry page
scripts/fetch-images.ts photo download / --restore
wrangler.jsonc         Worker config: static assets, vars, custom domains
```

The server is stateless per player. The client keeps its list of guessed dish ids in `localStorage`, and `POST /api/state` replays them to rebuild the board. The answer is sent only after the game ends.

## Not covered by this prototype (needed for production)

- **Database.** Dishes and the puzzle schedule are currently in code. You'd want a database (on Cloudflare, D1) with `dishes`, `ingredients`, `puzzles (date → dish)`, and optionally `plays` for stats.
- **Daily puzzle rotation.** A scheduler or date→dish mapping, plus time-zone handling.
- **Anti-cheat.** Because the server is stateless, a client can replay invented guess lists to reach the reveal. Server-side sessions, or signed state tokens, would fix this.
- **Image curation and hosting.** Someone should review each photo by eye, and production should serve them from a CDN. A paid library such as Adobe Stock needs a purchased licence for each image.
- **Content.** A larger dish list (the prototype has about 230), editorial review of ingredient order and difficulty for each answer, and playtesting.
- **Accounts and stats** (streaks, guess distribution), if wanted.
