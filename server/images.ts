// Photo credits are written by scripts/fetch-images.ts. The photos themselves
// are copied into the client build at /images/ (see vite.config.ts) and served
// as static assets; if one is missing the client falls back to the emoji.
import credits from '../assets/dishes/credits.json';

interface Credit { file: string; credit: string; creditUrl?: string }

export function imageFor(id: string): { url: string; credit: string; creditUrl: string | null } | null {
  const c = (credits as Record<string, Credit>)[id];
  return c ? { url: `/images/${c.file}`, credit: c.credit, creditUrl: c.creditUrl ?? null } : null;
}
