import type { GameState } from '../../../shared/types';
import { titleCase } from '../format';

export default function IngredientList({ game }: { game: GameState }) {
  const over = game.status !== 'playing';
  // Most a player can ever see before their last guess: the opening three
  // plus one per wrong guess.
  const reachable = over ? game.totalIngredients : Math.min(game.totalIngredients, 3 + game.maxGuesses - 1);
  const locked = Math.max(0, reachable - game.ingredients.length);

  return (
    <ol className="ingredients">
      {game.ingredients.map((ing, i) => (
        <li key={ing} className={`chip ${!over && i === game.ingredients.length - 1 && i >= 3 ? 'new' : ''}`}>
          <span className="chip-num">{i + 1}</span>
          {titleCase(ing)}
        </li>
      ))}
      {Array.from({ length: locked }, (_, i) => (
        <li key={`locked-${i}`} className="chip locked" aria-label="Hidden ingredient">
          <span className="chip-num">{game.ingredients.length + i + 1}</span>?
        </li>
      ))}
    </ol>
  );
}
