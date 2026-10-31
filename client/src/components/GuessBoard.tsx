import { useEffect, useRef, type CSSProperties } from 'react';
import type { AttributeKey, GuessResult } from '../../../shared/types';
import { useSwing } from '../useSwing';

const COLUMNS: { key: AttributeKey; label: string }[] = [
  { key: 'family', label: 'Type' },
  { key: 'origin', label: 'Origin' },
  { key: 'diet', label: 'Diet' },
  { key: 'palate', label: 'Palate' },
  { key: 'course', label: 'Course' },
  { key: 'method', label: 'Method' },
  { key: 'spice', label: 'Spice' },
  { key: 'ingredients', label: 'Ingred.' },
];

// Tiles flip in one after another once the ticket has started to drop.
const tileDelay = (i: number) => ({ '--delay': `${100 + i * 30}ms` }) as CSSProperties;

// Each ticket keeps the same slight tilt as newer ones push it along the rail.
const TILTS = ['-0.9deg', '0.7deg', '-0.3deg'];

export function heat(closeness: number): { label: string; tone: string } {
  if (closeness === 100) return { label: 'Correct!', tone: 'exact' };
  if (closeness >= 80) return { label: 'Scorching', tone: 'scorching' };
  if (closeness >= 60) return { label: 'Hot', tone: 'hot' };
  if (closeness >= 40) return { label: 'Warm', tone: 'warm' };
  return { label: 'Cold', tone: 'cold' };
}

/** One guess: its hint tiles and closeness, on a small ticket that swings when swiped. */
function MiniTicket({ guess: g, n }: { guess: GuessResult; n: number }) {
  const ref = useRef<HTMLLIElement>(null);
  useSwing(ref);
  const h = heat(g.closeness);
  return (
    <li
      ref={ref}
      className={`mini-ticket ${g.correct ? 'exact' : ''}`}
      style={{ '--tilt': TILTS[n % TILTS.length] } as CSSProperties}
    >
      <div className="mini-head">
        <span className="guess-no">#{n}</span>
        <span className="emoji" aria-hidden>{g.dish.emoji}</span>
        <span className="mini-name">{g.dish.name}</span>
      </div>
      <div className="mini-tiles">
        {COLUMNS.map((c, i) => {
          const a = g.attributes.find((x) => x.key === c.key)!;
          return (
            <span
              key={c.key}
              className={`tile ${a.match}`}
              style={tileDelay(i)}
              title={a.note}
            >
              <span className="tile-label">{c.label}</span>
              {/* Single long words ("Pescatarian") don't fit a tile at the normal size. */}
              <span className={`tile-value ${/\S{10,}/.test(a.value) ? 'long' : ''}`}>
                {a.value}
                {a.direction && <span className="arrow" aria-label={a.direction === 'up' ? 'spicier' : 'milder'}> {a.direction === 'up' ? '▲' : '▼'}</span>}
              </span>
            </span>
          );
        })}
      </div>
      <div className={`closeness ${h.tone}`} style={tileDelay(COLUMNS.length)}>
        <span className="meter"><span style={{ width: `${g.closeness}%` }} /></span>
        <span className="closeness-text">{g.closeness}% · {h.label}</span>
      </div>
    </li>
  );
}

/** Every guess so far, newest first, each as a small order ticket of hint tiles. */
export default function GuessBoard({ guesses }: { guesses: GuessResult[] }) {
  const newestFirst = [...guesses].reverse();
  const boardRef = useRef<HTMLOListElement>(null);

  // On narrow screens the board is a sideways strip; bring the new guess into
  // view (the browser would otherwise stay snapped to the previous one).
  useEffect(() => {
    boardRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [guesses.length]);

  return (
    <section className="board-wrap" aria-label="Your guesses">
      <div className="rail small" />
      {!guesses.length && <p className="board-empty">Your guesses will hang here.</p>}
      {guesses.length > 0 && (
        <ol className="board" ref={boardRef}>
          {newestFirst.map((g, rowIdx) => (
            <MiniTicket key={g.dish.id} guess={g} n={guesses.length - rowIdx} />
          ))}
        </ol>
      )}
      {guesses.length > 0 && (
        <p className="legend">
          <span className="swatch exact" /> Match
          <span className="swatch partial" /> Close
          <span className="swatch miss" /> Miss
          <span>▲▼ spicier / milder</span>
          <span className="muted hover-hint">Hover a tile for details</span>
        </p>
      )}
    </section>
  );
}
