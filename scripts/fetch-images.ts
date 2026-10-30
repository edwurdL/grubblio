// Downloads a photo for each dish and records attribution in
// assets/dishes/credits.json.
//
// Sources, best first (pick with --source, otherwise the first with a key):
//   pixabay  Pixabay API    — needs PIXABAY_API_KEY (free: pixabay.com/api/docs)
//   pexels   Pexels API     — needs PEXELS_API_KEY  (free: pexels.com/api)
//   commons  Wikimedia Commons, no key (the fallback)
// Keys can live in a .env file at the repo root.
//
//   npm run fetch-images                       # fill in dishes with no photo
//   npm run fetch-images -- --force            # replace every photo
//   npm run fetch-images -- --force pad-thai   # replace just these ids
//   npm run fetch-images -- --source pexels --force
//   npm run fetch-images -- --restore          # re-download recorded stock photos
//
// Pixabay and Pexels photos aren't committed: their licences forbid
// redistributing the raw files, so assets/dishes/.gitignore (rewritten on each
// run) lists them and deploys fetch them back with --restore at build time.
//
// A dish keeps its current photo unless a result's description actually names
// the dish, so a weak search never swaps in the wrong food.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DISHES, type Dish } from '../server/dishes';

const IMAGE_DIR = fileURLToPath(new URL('../assets/dishes/', import.meta.url));

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env — keys may still come from the environment.
}

const UA = 'GrubblioPrototype/0.1 (local dev; image fetch)';

// Search terms that find a better photo than the plain dish name.
const QUERY: Record<string, string> = {
  gyro: 'gyros pita',
  sushi: 'sushi rolls',
  pho: 'pho noodle soup',
  'fried-rice': 'fried rice',
  'chili-con-carne': 'chili con carne',
  pancakes: 'pancakes stack syrup',
  'pork-dumplings': 'chinese dumplings',
  'katsu-curry': 'katsu curry',
  'risotto-milanese': 'saffron risotto',
  'chicago-deep-dish': 'deep dish pizza',
};

// Photos checked by eye and found wrong or unclear, so they're skipped in
// favour of the next result. Keyed by the photo's page URL.
const REJECT = new Set([
  'https://pixabay.com/photos/thai-food-barramundi-fish-tom-yum-3550007/', // tom-yum
  'https://pixabay.com/photos/food-riobamba-ceviche-de-chochos-7214030/', // ceviche
  'https://pixabay.com/photos/okonomiyaki-japanese-japan-food-2397649/', // okonomiyaki
  'https://pixabay.com/photos/egg-net-thai-food-ingredient-3545650/', // pad-thai
  'https://pixabay.com/photos/butter-chicken-food-dish-meal-7614835/', // butter-chicken
  'https://pixabay.com/photos/tiramisu-pastry-baked-sweets-7030032/', // tiramisu
  'https://pixabay.com/photos/breakfast-healthy-hummus-spread-1804457/', // hummus
  'https://pixabay.com/photos/lahmacun-pizza-turkish-pizza-3841514/', // lahmacun
  'https://pixabay.com/photos/cobb-salad-chicken-cobb-meal-2736125/', // cobb-salad
  'https://pixabay.com/photos/ratatouille-food-kitchen-cooking-3646586/', // ratatouille
  'https://pixabay.com/photos/hot-dog-pan-vegetables-flesh-cook-7650901/', // hot-dog
  'https://pixabay.com/photos/grilling-grill-charcoal-5055491/', // grilled-cheese
  'https://pixabay.com/photos/cuban-coffee-cafe-cubano-3767552/', // cuban-sandwich
  'https://pixabay.com/photos/wife-cooking-kitchen-preparation-5509205/', // pierogi
  'https://pixabay.com/photos/chefs-kitchen-pizza-cooks-5437743/', // doner-kebab
  'https://pixabay.com/photos/cocktails-glasses-drinks-nachos-731898/', // nachos
  'https://pixabay.com/photos/food-wrap-chicken-chicken-wrap-5463461/', // chicken-fajitas
  'https://pixabay.com/photos/chilaquiles-mexican-food-mexico-4120608/', // chilaquiles
  'https://pixabay.com/photos/buffet-empanada-food-pastry-dish-7012759/', // empanadas
  'https://pixabay.com/photos/spring-roll-roll-food-vietnamese-6760871/', // spring-rolls
  'https://pixabay.com/photos/breakfast-orange-juice-loaf-1804436/', // guacamole
  'https://pixabay.com/photos/caribbean-kebab-food-columbus-ohio-2801439/', // jerk-chicken
  'https://pixabay.com/photos/chicken-rice-%E7%99%BD%E6%96%A9%E9%B8%A1-food-asian-1508984/', // arroz-con-pollo
  'https://pixabay.com/photos/meatloaf-food-meal-liver-cheese-3747129/', // meatloaf
  'https://pixabay.com/photos/onion-red-onion-raw-antibacterial-2699531/', // onion-rings
  'https://pixabay.com/photos/okra-okro-cooking-ladies-fingers-1386365/', // gumbo
  'https://pixabay.com/photos/kola-kanda-drink-glass-6322021/', // congee
  'https://pixabay.com/photos/food-cookie-cookies-christmas-5111642/', // brownies
  'https://pixabay.com/photos/doughnuts-desserts-pastries-treats-1868573/', // donuts
  'https://pixabay.com/photos/creme-brulee-milk-eggs-sugar-3490885/', // creme-brulee
  'https://pixabay.com/photos/food-eastern-sweets-baklava-sweet-5158702/', // baklava
  'https://pixabay.com/photos/gnocchi-potato-dumplings-preparation-7690877/', // gnocchi
  'https://pixabay.com/photos/cook-japchae-food-6028960/', // japchae
  'https://pixabay.com/photos/poke-bowl-surf-turf-food-poke-bowl-5359639/', // poke-bowl
  'https://pixabay.com/photos/soup-pot-miso-soup-soup-1090137/', // miso-soup
  'https://pixabay.com/photos/chicken-food-eat-delicious-lunch-5203432/', // orange-chicken
  'https://pixabay.com/photos/dim-sum-dim-sim-food-hong-kong-2346105/', // char-siu
  'https://pixabay.com/photos/pa-bulgogi-bul-gogi-seasoned-bulgogi-7593889/', // bulgogi
  'https://pixabay.com/photos/tteokbokki-noodles-korean-food-udon-6485983/', // tteokbokki
  'https://pixabay.com/photos/dal-toor-dal-toor-asian-india-1740205/', // dal-tadka
  'https://pixabay.com/photos/street-graffiti-greek-fast-food-2612710/', // souvlaki
  'https://pixabay.com/photos/morocco-tajine-stew-food-vegetable-325324/', // chicken-tagine
  'https://pixabay.com/photos/food-sausage-grilled-sausage-10427/', // bratwurst
  'https://pixabay.com/photos/flesh-calf-veal-beef-ossobuco-2534580/', // osso-buco
  'https://pixabay.com/photos/food-dish-seafood-fried-shrimp-5911572/', // fried-calamari
]);

// Pixabay flags AI images (`isAiGenerated`) only when the uploader says so,
// and unlabelled ones cluster in recent uploads. Ids increase over time, so
// skip everything newer than this as well; older photos cover our dishes fine.
const AI_ERA_ID = 8_000_000;

// Hand-picked photos for dishes whose search results were wrong or whose tags
// don't name the dish: a Pixabay id, or a Wikimedia Commons file name when
// Pixabay had nothing usable.
const PICK: Record<string, number | `File:${string}`> = {
  khachapuri: 6320625,
  'katsu-curry': 3371421,
  ratatouille: 5316194,
  'banh-mi': 4722334,
  'mac-and-cheese': 4305743,
  'hot-dog': 2707798,
  meatloaf: 4941275,
  pierogi: 3437689,
  bratwurst: 3524649,
  gnocchi: 4770756,
  brownies: 4967195,
  nachos: 4454941,
  'spring-rolls': 809866,
  'creme-brulee': 5455758,
  'biscuits-and-gravy': 472409,
  'key-lime-pie': 2763884,
  'chicken-teriyaki': 3765240,
  'chicken-shawarma': 7061741,
  'avocado-toast': 4488463,
  guacamole: 'File:Guacamole in a bowl by Jon Sullivan (4 April 2004).jpg',
  'onion-rings': 'File:Beer Battered Onion Rings - RV90 - 20241107-133409.jpg',
  'dal-tadka': 'File:Tadka Dal.jpg',
  'chicken-tagine': 'File:Moroccan food-Chicken tagine with preserved lemons and olives-02.jpg',
  'orange-chicken': 'File:Flickr preppybyday 4786746354--Orange chicken.jpg',
  'arroz-con-pollo': 'File:Arroz-con-Pollo.jpg',
  gumbo: 'File:Gumbo- Stu Spivak.jpg',
  'miso-soup': 'File:Miso Soup 001.jpg',
  'jerk-chicken': 'File:Jerk chicken as served july 05.jpg',
  'pork-vindaloo': 'File:Vindaloo goa.jpg',
};

interface Hit {
  url: string;
  /** Alt text or tags, used to check the photo is of the right dish. */
  description: string;
  credit: string;
  /** The photo's page on the source site, linked from the credit. */
  creditUrl: string;
  source: Source;
}

type Source = 'pexels' | 'pixabay' | 'commons';

const args = process.argv.slice(2);
const force = args.includes('--force');
const sourceArg = args[args.indexOf('--source') + 1] as Source | undefined;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--source');

const source: Source = args.includes('--source') && sourceArg
  ? sourceArg
  : process.env.PIXABAY_API_KEY ? 'pixabay' : process.env.PEXELS_API_KEY ? 'pexels' : 'commons';
if (source === 'pexels' && !process.env.PEXELS_API_KEY) throw new Error('Set PEXELS_API_KEY (free at pexels.com/api)');
if (source === 'pixabay' && !process.env.PIXABAY_API_KEY) throw new Error('Set PIXABAY_API_KEY (free at pixabay.com/api/docs)');

const creditsPath = IMAGE_DIR + 'credits.json';
const credits: Record<string, { file: string; credit: string; creditUrl?: string; source?: Source; description?: string }> =
  existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const words = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1);

const STOPWORDS = new Set(['and', 'the', 'con', 'alla', 'with', 'al', 'n']);

/** Words without stopwords, singularised so "tacos" matches "taco". */
const phraseWords = (s: string) => words(s).filter((w) => !STOPWORDS.has(w)).map((w) => w.replace(/(?<=..)e?s$/, ''));

/**
 * True when the description names the dish: its full name or a distinct
 * alias appears as a phrase within one tag (Pixabay) or the alt text (Pexels).
 * "chicken salad, parmesan" does not name Chicken Parmesan.
 */
function namesDish(dish: Dish, description: string): boolean {
  const parts = description.split(',').map((p) => ` ${phraseWords(p).join(' ')} `);
  // Shortened aliases ("Chowder" for Clam Chowder) are too generic to vouch
  // for a photo — "corn chowder" would pass.
  const full = new Set(phraseWords(dish.name));
  const aliases = (dish.aliases ?? []).filter((a) => !phraseWords(a).every((w) => full.has(w)));
  return [dish.name, ...aliases].some((name) => {
    const phrase = ` ${phraseWords(name).join(' ')} `;
    return phrase.trim() !== '' && parts.some((p) => p.includes(phrase));
  });
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
    if (res.ok && res.headers.get('content-type')?.includes('json')) return res.json();
    if (attempt === 4 || res.status === 401 || res.status === 403) {
      throw new Error(`${new URL(url).host} ${res.status}: ${(await res.text()).slice(0, 120)}`);
    }
    await sleep(15_000 * (attempt + 1));
  }
}

async function searchPexels(query: string): Promise<Hit[]> {
  const params = new URLSearchParams({ query, per_page: '15', orientation: 'landscape' });
  const data = await getJson(`https://api.pexels.com/v1/search?${params}`, {
    Authorization: process.env.PEXELS_API_KEY!,
  });
  return (data.photos ?? []).map((p: any) => ({
    url: p.src.large,
    description: p.alt ?? '',
    credit: `${p.photographer} on Pexels`,
    creditUrl: p.url,
    source: 'pexels' as const,
  }));
}

async function searchPixabay(query: string, id?: number): Promise<Hit[]> {
  const params = new URLSearchParams(
    id
      ? { key: process.env.PIXABAY_API_KEY!, id: String(id) }
      : {
          key: process.env.PIXABAY_API_KEY!, q: query, image_type: 'photo', category: 'food',
          orientation: 'horizontal', safesearch: 'true', per_page: '20',
        },
  );
  const data = await getJson(`https://pixabay.com/api/?${params}`);
  return (data.hits ?? []).filter((h: any) => !h.isAiGenerated && h.id < AI_ERA_ID).map((h: any) => ({
    url: h.largeImageURL,
    description: h.tags ?? '',
    credit: `${h.user} on Pixabay`,
    creditUrl: h.pageURL,
    source: 'pixabay' as const,
  }));
}

/** Search Commons, or with `title` look up that one file. */
async function searchCommons(query: string, title?: string): Promise<Hit[]> {
  // 960px is one of Commons' standard thumbnail sizes; other sizes get 429s.
  const params = new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '960',
    ...(title
      ? { titles: title }
      : { generator: 'search', gsrnamespace: '6', gsrlimit: '8', gsrsearch: `${query} filetype:bitmap` }),
  });
  const data = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  return (Object.values(data.query?.pages ?? {}) as any[])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => ({ title: (p.title as string).replace(/^File:/, ''), info: p.imageinfo?.[0] }))
    // Skip images smaller than the thumbnail size: Commons then hands back the
    // original file, which it rate-limits much harder than thumbnails. A file
    // picked by name is worth the one slower download.
    .filter((p) => p.info && /jpeg|png/.test(p.info.mime) && p.info.thumburl && (title || !p.info.thumburl.includes('unscaled')))
    .map((p) => {
      const meta = p.info.extmetadata ?? {};
      const artist = stripHtml(meta.Artist?.value) || 'Unknown';
      const license = stripHtml(meta.LicenseShortName?.value) || 'see source';
      return {
        url: p.info.thumburl,
        description: p.title,
        credit: `${artist} · ${license} · Wikimedia Commons`,
        creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        source: 'commons' as const,
      };
    });
}

const SEARCH: Record<Source, (q: string) => Promise<Hit[]>> = {
  pexels: searchPexels,
  pixabay: searchPixabay,
  commons: searchCommons,
};
const PAUSE: Record<Source, number> = { pexels: 500, pixabay: 800, commons: 4000 };

/** Download into a temp file with backoff, so a failure never clobbers the old photo. */
async function download(url: string, dest: string): Promise<boolean> {
  const tmp = `${dest}.part`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
      renameSync(tmp, dest);
      return true;
    } catch {
      rmSync(tmp, { force: true });
      await sleep(10_000 * (attempt + 1));
    }
  }
  return false;
}

/** Keep licence-restricted stock photos out of git; the credits stay committed. */
function writeIgnore() {
  const restricted = Object.values(credits)
    .filter((c) => c.source === 'pixabay' || c.source === 'pexels')
    .map((c) => c.file)
    .sort();
  writeFileSync(
    IMAGE_DIR + '.gitignore',
    ['# Generated by scripts/fetch-images.ts — stock photos restored at build with --restore', '*.part', ...restricted, ''].join('\n'),
  );
}

async function restore() {
  // Re-download exactly the recorded photo (by its Pixabay id), not a fresh
  // search, so deploys show the same photos as local dev. A dish that can't be
  // restored just falls back to its emoji, so this never fails the build.
  if (!process.env.PIXABAY_API_KEY) {
    console.warn('PIXABAY_API_KEY not set — skipping photo restore; those dishes will show their emoji.');
    // Names only, never values: helps spot a typo'd variable name in the host's settings.
    const similar = Object.keys(process.env).filter((k) => /pixabay|pexels|api.?key/i.test(k));
    console.warn(`Similar environment variable names: ${similar.length ? similar.map((k) => JSON.stringify(k)).join(', ') : 'none'}`);
    return;
  }
  const todo = Object.entries(credits).filter(([, c]) => c.source === 'pixabay' && !existsSync(IMAGE_DIR + c.file));
  console.log(`Restoring ${todo.length} Pixabay photos…`);
  let restored = 0;
  const reasons = new Map<string, number>();
  for (const [id, c] of todo) {
    const pixabayId = Number(c.creditUrl?.match(/-(\d+)\/?$/)?.[1]);
    let why = '';
    try {
      const hit = pixabayId ? (await searchPixabay('', pixabayId))[0] : undefined;
      if (!hit) why = pixabayId ? `Pixabay returned no photo for id ${pixabayId}` : `no Pixabay id in ${c.creditUrl}`;
      else if (await download(hit.url, IMAGE_DIR + c.file)) restored++;
      else why = 'image download failed';
    } catch (e) {
      why = (e as Error).message;
    }
    if (why) {
      console.warn(`✗ ${id}: ${why}`);
      reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
    await sleep(PAUSE.pixabay);
  }
  console.log(`Restored ${restored} of ${todo.length} photos.`);
  for (const [why, n] of reasons) console.warn(`  ${n}× ${why}`);
}

async function fetchAll() {
  console.log(`Source: ${source}${force ? ' (replacing existing photos)' : ''}`);
  const kept: string[] = [];
  for (const dish of DISHES) {
    if (only.length && !only.includes(dish.id)) continue;
    const file = `${dish.id}.jpg`;
    const hasPhoto = Boolean(credits[dish.id]) && existsSync(IMAGE_DIR + file);
    if (hasPhoto && !force) continue;

    // Try the dish name, then each alias, taking the provider's top-ranked
    // result that actually names the dish.
    const pick = PICK[dish.id];
    let best: Hit | undefined =
      typeof pick === 'string'
        ? (await searchCommons('', pick))[0]
        : pick && process.env.PIXABAY_API_KEY
          ? (await searchPixabay('', pick))[0]
          : undefined;
    for (const query of new Set([QUERY[dish.id] ?? dish.name, dish.name, ...(dish.aliases ?? [])])) {
      if (best) break;
      best = (await SEARCH[source](query)).find((h) => !REJECT.has(h.creditUrl) && namesDish(dish, h.description));
      if (best) break;
      await sleep(PAUSE[source]);
    }

    if (!best) {
      console.warn(`✗ ${dish.id}: no confident match on ${source}${hasPhoto ? ' — kept current photo' : ''}`);
      if (hasPhoto) kept.push(dish.id);
      await sleep(PAUSE[source]);
      continue;
    }
    if (!(await download(best.url, IMAGE_DIR + file))) {
      console.warn(`✗ ${dish.id}: download failed${hasPhoto ? ' — kept current photo' : ''}`);
      if (hasPhoto) kept.push(dish.id);
      continue;
    }
    credits[dish.id] = {
      file, credit: best.credit, creditUrl: best.creditUrl, source: best.source, description: best.description,
    };
    writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n');
    console.log(`✓ ${dish.id} ← "${best.description}"`);
    await sleep(PAUSE[source]);
  }

  writeIgnore();
  const missing = DISHES.filter((d) => !credits[d.id] || !existsSync(IMAGE_DIR + credits[d.id].file));
  if (kept.length) console.log(`\nKept previous photo for: ${kept.join(', ')}`);
  console.log(missing.length ? `\nStill missing a photo: ${missing.map((d) => d.id).join(', ')}` : '\nEvery dish has a photo.');
}

// Let the script end on its own rather than process.exit(), which can drop
// log lines still being written to a pipe (e.g. a deploy's build log).
await (args.includes('--restore') ? restore() : fetchAll());
