// Turns free text into a dish: an exact name/alias match, or a short list of
// "did you mean" candidates. Only names and aliases are matched — never
// ingredients or attributes, or players could search their way to the answer.
// Add common alternative names to a dish's `aliases` instead.
import { DISHES, type Dish } from './dishes';

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Optimal-string-alignment distance (Levenshtein + adjacent transpositions). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Typos allowed for a word of this length. */
const allowance = (len: number) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);

interface Entry {
  dish: Dish;
  /** Normalised name and aliases, each split into words. */
  names: string[][];
}

const ENTRIES: Entry[] = DISHES.map((dish) => ({
  dish,
  names: [dish.name, ...(dish.aliases ?? [])].map((n) => normalize(n).split(' ')),
}));

/**
 * How well the query reads as this whole name: every query word must pair up
 * with a different name word (within typo allowance), and the query must cover
 * the whole name — or all but one word of a 3+ word name ("buffalo chicken").
 * Fragments like "pineapple" or "chicken" deliberately match nothing.
 */
function scoreName(query: string[], name: string[]): number {
  const unused = [...name];
  let typos = 0;
  for (const token of query) {
    let bestIdx = -1;
    let best = Infinity;
    unused.forEach((w, i) => {
      const d = distance(token, w);
      if (d <= allowance(Math.max(token.length, w.length)) && d < best) [best, bestIdx] = [d, i];
    });
    if (bestIdx < 0) return 0;
    typos += best;
    unused.splice(bestIdx, 1);
  }
  const missing = unused.length;
  if (missing > (name.length >= 3 ? 1 : 0)) return 0;
  return 600 - typos * 40 - missing * 60;
}

const score = (query: string[], e: Entry) => Math.max(...e.names.map((n) => scoreName(query, n)));

export function resolve(query: string): { exact: Dish | null; suggestions: Dish[] } {
  const q = normalize(query);
  if (!q) return { exact: null, suggestions: [] };

  const exact = ENTRIES.find((e) => e.names.some((n) => n.join(' ') === q));
  if (exact) return { exact: exact.dish, suggestions: [] };

  const words = q.split(' ');
  const ranked = ENTRIES.map((e) => ({ dish: e.dish, score: score(words, e) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.dish.name.length - b.dish.name.length);
  // Offer the top match plus near-ties (e.g. "chicken pizza" → BBQ / Buffalo).
  const top = ranked[0]?.score ?? 0;
  return { exact: null, suggestions: ranked.filter((r) => r.score >= top - 30).slice(0, 3).map((r) => r.dish) };
}
