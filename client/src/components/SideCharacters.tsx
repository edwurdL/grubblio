import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../../../shared/types';
import { Kitchen, randomLook, type Expression, type Look } from '../kitchen';
import { heat } from './GuessBoard';

// A chef left of the order slip who gets more worried with every miss, and a
// customer to its right who reacts to each guess in speech bubbles. They're
// the same animals as the kitchen behind the page, drawn big, and only appear
// when there's room beside the slip (see .side-characters in styles.css).

function chefMood(game: GameState): Expression {
  if (game.status === 'won') return 'happy';
  if (game.status === 'lost') return 'defeated';
  const misses = game.guesses.length;
  if (misses === 0) return 'calm';
  if (misses <= 2) return 'uneasy';
  if (misses <= 4) return 'worried';
  return 'panicked';
}

function customerMood(game: GameState): Expression {
  if (game.status === 'won') return 'excited';
  if (game.status === 'lost') return 'angry';
  const last = game.guesses.at(-1);
  if (!last) return 'calm';
  const tone = heat(last.closeness).tone;
  return tone === 'cold' ? 'unimpressed' : tone === 'warm' ? 'intrigued' : 'excited';
}

const pick = (lines: string[], n: number) => lines[n % lines.length];

const GREETINGS = ["I'll have the chef's special.", 'Surprise me, chef!', 'Whatever smells good, please.'];
const BY_TONE: Record<string, ((dish: string) => string)[]> = {
  cold: [(d) => `${d}? That's not what I ordered.`, (d) => `Not ${d}…`, (d) => `${d}? Nope.`],
  warm: [(d) => `${d}? Hmm, getting closer.`, (d) => `Not ${d}, but warmer.`],
  hot: [(d) => `${d}? Ooh, close!`, (d) => `Almost! Not ${d} though.`],
  scorching: [(d) => `So close! But not ${d}.`, (d) => `${d}? Nearly there!`],
};

/** Everything the customer has said this game, oldest first. */
function customerLines(game: GameState): string[] {
  const seed = game.puzzleId.length;
  const lines = [pick(GREETINGS, seed)];
  game.guesses.forEach((g, i) => {
    if (g.correct) return;
    const say = BY_TONE[heat(g.closeness).tone];
    lines.push(say[(seed + i) % say.length](g.dish.name));
    if (game.status === 'playing' && i === game.maxGuesses - 2) lines.push('Last chance, chef…');
  });
  if (game.status === 'won') lines.push('Delicious! Compliments to the chef!');
  if (game.status === 'lost' && game.answer) lines.push(`I wanted ${game.answer.name}! I'm leaving.`);
  return lines;
}

const SHOWN_LINES = 3;
const TYPING_MS = 650;
const REACT_MS = 1000;
// Drawn small and scaled up with crisp pixels, like the kitchen; CSS sizes
// the canvas to whatever room there is beside the order slip.
const CANVAS_W = 80;
const CANVAS_H = 144;

function Portrait({ look, expression }: { look: Look; expression: Expression }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // The animals are about 40 units wide and 74 tall (with a chef's hat).
    const s = CANVAS_W / 44;
    Kitchen.portrait(ctx, look, expression, CANVAS_W / 2, CANVAS_H - 3 * s, s);
  }, [look, expression]);
  return <canvas ref={ref} className="portrait" width={CANVAS_W} height={CANVAS_H} />;
}

export default function SideCharacters({ game }: { game: GameState }) {
  const [reacting, setReacting] = useState(false);
  const [typing, setTyping] = useState(false);
  const seen = useRef(game.guesses.length);
  const lines = customerLines(game);
  // Same chef all visit; a new customer for every order.
  const [chefLook] = useState(() => randomLook('chef'));
  const customerLook = useMemo(() => randomLook('guest'), [game.puzzleId]);

  // A fresh miss startles the chef for a moment, and the customer "types"
  // before their new line appears. Restored or reset games don't react.
  useEffect(() => {
    const before = seen.current;
    seen.current = game.guesses.length;
    if (game.guesses.length <= before) return;
    setTyping(true);
    const typed = window.setTimeout(() => setTyping(false), TYPING_MS);
    if (game.guesses.at(-1)?.correct) return () => clearTimeout(typed);
    setReacting(true);
    const calmed = window.setTimeout(() => setReacting(false), REACT_MS);
    return () => {
      clearTimeout(typed);
      clearTimeout(calmed);
    };
  }, [game.guesses]);

  const chef = reacting ? 'panicked' : chefMood(game);
  const visible = (typing ? lines.slice(0, -1) : lines).slice(-SHOWN_LINES);

  return (
    <div className="side-characters" aria-hidden>
      <div className={`side-char chef ${reacting ? 'reacting' : ''} mood-${chef}`}>
        <Portrait look={chefLook} expression={chef} />
      </div>
      <div className={`side-char customer mood-${customerMood(game)}`}>
        <Portrait look={customerLook} expression={typing ? 'intrigued' : customerMood(game)} />
        <ol className="bubbles">
          {visible.map((line, i) => (
            <li key={`${lines.indexOf(line)}:${line}`} className={i === visible.length - 1 && !typing ? 'latest' : ''}>
              {line}
            </li>
          ))}
          {typing && <li className="typing latest"><span /><span /><span /></li>}
        </ol>
      </div>
    </div>
  );
}
