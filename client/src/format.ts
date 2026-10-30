const UPPER = new Set(['bbq']);

/** "bbq sauce" → "BBQ Sauce" */
export const titleCase = (s: string) =>
  s.replace(/\p{L}+/gu, (w) => (UPPER.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
