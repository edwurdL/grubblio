import { useRef } from 'react';
import type { GameState } from '../../../shared/types';
import { titleCase } from '../format';
import { useSwing } from '../useSwing';
import { Cloche, hash, IngredientIcon } from './Pixel';

// Redacted-line widths for hidden ingredients, so the ticket doesn't look ruled.
const BLANK_WIDTHS = [62, 46, 74, 54, 40, 66, 50, 58];

/** The ingredient list while the game is on, printed as a kitchen order ticket hanging from the rail. */
export default function OrderTicket({ game }: { game: GameState }) {
  // Most a player can ever see before their last guess: the opening three
  // plus one per wrong guess.
  const reachable = Math.min(game.totalIngredients, 3 + game.maxGuesses - 1);
  const locked = Math.max(0, reachable - game.ingredients.length);
  const id = hash(game.puzzleId);
  const ref = useRef<HTMLElement>(null);
  useSwing(ref);

  return (
    <section className="ticket" aria-label="Ingredients" ref={ref}>
      <div className="ticket-title">
        <h2>Ingredients</h2>
        <span aria-label={`${game.ingredients.length} of ${game.totalIngredients} revealed`}>
          {game.ingredients.length} / {game.totalIngredients}
        </span>
      </div>
      <hr />
      <ol className="ticket-lines">
        {game.ingredients.map((ing, i) => (
          <li key={ing} className={i === game.ingredients.length - 1 && i >= 3 ? 'new' : ''}>
            <span className="line-num">{i + 1}</span>
            <IngredientIcon name={ing} />
            <span className="line-name">{titleCase(ing)}</span>
          </li>
        ))}
        {Array.from({ length: locked }, (_, i) => (
          <li key={`locked-${i}`} className="locked" aria-label="Hidden ingredient">
            <span className="line-num">{game.ingredients.length + i + 1}</span>
            <Cloche />
            <span className="blank" style={{ width: `${BLANK_WIDTHS[(game.ingredients.length + i) % BLANK_WIDTHS.length]}%` }} />
          </li>
        ))}
      </ol>
      <hr />
      <div className="ticket-meta">
        <span>Order #{String(id % 1000).padStart(3, '0')} · Table {(id % 12) + 1}</span>
        <span>Next item on a miss</span>
      </div>
    </section>
  );
}
