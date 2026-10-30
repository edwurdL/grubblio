import type { AttributeKey, GuessResult } from '../../../shared/types';

const COLUMNS: { key: AttributeKey; label: string }[] = [
  { key: 'family', label: 'Type' },
  { key: 'origin', label: 'Origin' },
  { key: 'diet', label: 'Diet' },
  { key: 'palate', label: 'Palate' },
  { key: 'course', label: 'Course' },
  { key: 'method', label: 'Method' },
  { key: 'spice', label: 'Spice' },
  { key: 'ingredients', label: 'Ingredients' },
];

export function heat(closeness: number): { label: string; tone: string } {
  if (closeness === 100) return { label: 'Correct!', tone: 'exact' };
  if (closeness >= 80) return { label: 'Scorching', tone: 'scorching' };
  if (closeness >= 60) return { label: 'Hot', tone: 'hot' };
  if (closeness >= 40) return { label: 'Warm', tone: 'warm' };
  return { label: 'Cold', tone: 'cold' };
}

export default function GuessBoard({ guesses }: { guesses: GuessResult[] }) {
  if (!guesses.length) return null;
  const newestFirst = [...guesses].reverse();

  return (
    <section className="board-wrap" aria-label="Your guesses">
      <div className="board" role="table">
        <div className="board-row head" role="row">
          <span role="columnheader">Dish</span>
          {COLUMNS.map((c) => <span key={c.key} role="columnheader">{c.label}</span>)}
          <span role="columnheader">Closeness</span>
        </div>
        {newestFirst.map((g, rowIdx) => {
          const h = heat(g.closeness);
          return (
            <div key={g.dish.id} className="board-row" role="row">
              <span className={`cell dish ${g.correct ? 'exact' : ''}`} role="cell">
                <span className="emoji" aria-hidden>{g.dish.emoji}</span>
                <span>
                  <span className="guess-no">#{guesses.length - rowIdx}</span>
                  {g.dish.name}
                </span>
              </span>
              {COLUMNS.map((c, i) => {
                const a = g.attributes.find((x) => x.key === c.key)!;
                return (
                  <span
                    key={c.key}
                    className={`cell tile ${a.match}`}
                    style={{ animationDelay: `${i * 90}ms` }}
                    title={a.note}
                    role="cell"
                  >
                    <span className="tile-value">{a.value}</span>
                    {a.direction && <span className="arrow" aria-label={a.direction === 'up' ? 'spicier' : 'milder'}>{a.direction === 'up' ? '▲' : '▼'}</span>}
                  </span>
                );
              })}
              <span className={`cell closeness ${h.tone}`} role="cell" style={{ animationDelay: `${COLUMNS.length * 90}ms` }}>
                <span className="meter"><span style={{ width: `${g.closeness}%` }} /></span>
                <span className="closeness-text">{g.closeness}% · {h.label}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="legend">
        <span className="swatch exact" /> Match
        <span className="swatch partial" /> Close
        <span className="swatch miss" /> Miss
        <span>▲▼ spicier / milder</span>
        <span className="muted">Hover a tile for details</span>
      </p>
    </section>
  );
}
