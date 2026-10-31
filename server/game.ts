import type { AnswerReveal, AttributeResult, DishSummary, GameState, GuessResult, Match } from '../shared/types';
import {
  COURSE_GROUP, DIET_SCALE, DISH_BY_ID, FAMILY_GROUP, METHOD_GROUP, REGION_OF, SPICE_LABELS, type Dish,
} from './dishes';
import { imageFor } from './images';

export const MAX_GUESSES = 9;
export const INITIAL_INGREDIENTS = 3;

export function summarize(d: Dish): DishSummary {
  return { id: d.id, name: d.name, aliases: d.aliases ?? [], emoji: d.emoji };
}

function sameGroup<T extends string>(groups: Partial<Record<T, string>>, a: T, b: T): boolean {
  return groups[a] !== undefined && groups[a] === groups[b];
}

const SCORE: Record<Match, number> = { exact: 1, partial: 0.5, miss: 0 };
const WEIGHTS: Record<AttributeResult['key'], number> = {
  family: 25, origin: 15, diet: 10, palate: 10, course: 5, method: 10, spice: 5, ingredients: 20,
};

export function compare(guess: Dish, answer: Dish): GuessResult {
  const correct = guess.id === answer.id;
  const attrs: AttributeResult[] = [];

  attrs.push(
    guess.family === answer.family
      ? { key: 'family', value: guess.family, match: 'exact' }
      : sameGroup(FAMILY_GROUP, guess.family, answer.family)
        ? { key: 'family', value: guess.family, match: 'partial', note: `Related: ${FAMILY_GROUP[guess.family]}` }
        : { key: 'family', value: guess.family, match: 'miss' },
  );

  const guessRegion = REGION_OF[guess.country];
  attrs.push(
    guess.country === answer.country
      ? { key: 'origin', value: guess.country, match: 'exact' }
      : guessRegion === REGION_OF[answer.country]
        ? { key: 'origin', value: guess.country, match: 'partial', note: `Same region: ${guessRegion}` }
        : { key: 'origin', value: guess.country, match: 'miss', note: guessRegion },
  );

  const dietGap = Math.abs(DIET_SCALE.indexOf(guess.diet) - DIET_SCALE.indexOf(answer.diet));
  attrs.push({
    key: 'diet', value: guess.diet,
    match: dietGap === 0 ? 'exact' : dietGap === 1 ? 'partial' : 'miss',
    note: dietGap === 1 ? 'One step away' : undefined,
  });

  const sharedPalate = guess.palate.filter((p) => answer.palate.includes(p));
  const palateExact = sharedPalate.length === guess.palate.length && guess.palate.length === answer.palate.length;
  attrs.push({
    key: 'palate', value: guess.palate.join(', '),
    match: palateExact ? 'exact' : sharedPalate.length ? 'partial' : 'miss',
    note: !palateExact && sharedPalate.length ? `Shared: ${sharedPalate.join(', ')}` : undefined,
  });

  attrs.push({
    key: 'course', value: guess.course,
    match: guess.course === answer.course ? 'exact' : sameGroup(COURSE_GROUP, guess.course, answer.course) ? 'partial' : 'miss',
  });

  attrs.push(
    guess.method === answer.method
      ? { key: 'method', value: guess.method, match: 'exact' }
      : sameGroup(METHOD_GROUP, guess.method, answer.method)
        ? { key: 'method', value: guess.method, match: 'partial', note: `Same style: ${METHOD_GROUP[guess.method]}` }
        : { key: 'method', value: guess.method, match: 'miss' },
  );

  const spiceGap = answer.spice - guess.spice;
  attrs.push({
    key: 'spice', value: SPICE_LABELS[guess.spice],
    match: spiceGap === 0 ? 'exact' : Math.abs(spiceGap) === 1 ? 'partial' : 'miss',
    direction: spiceGap > 0 ? 'up' : spiceGap < 0 ? 'down' : undefined,
  });

  const shared = guess.ingredients.filter((i) => answer.ingredients.includes(i)).length;
  const ingredientRatio = Math.min(1, shared / Math.ceil(answer.ingredients.length / 2));
  attrs.push({
    key: 'ingredients', value: `${shared} shared`,
    match: correct ? 'exact' : ingredientRatio >= 0.5 ? 'partial' : 'miss',
    note: `${shared} of this dish's ingredients are in the answer`,
  });

  let closeness = 100;
  if (!correct) {
    const total = attrs.reduce(
      (sum, a) => sum + WEIGHTS[a.key] * (a.key === 'ingredients' ? ingredientRatio : SCORE[a.match]), 0,
    );
    closeness = Math.min(99, Math.round(total));
  }

  return { dish: summarize(guess), correct, attributes: attrs, closeness };
}

function reveal(d: Dish): AnswerReveal {
  const img = imageFor(d.id);
  return {
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    country: d.country,
    region: REGION_OF[d.country],
    blurb: d.blurb ?? `A ${d.palate.join(', ').toLowerCase()} ${d.family.toLowerCase()} from ${d.country}.`,
    ingredients: d.ingredients,
    image: img?.url ?? null,
    imageCredit: img?.credit ?? null,
    imageCreditUrl: img?.creditUrl ?? null,
  };
}

export class GuessError extends Error {}

/**
 * Rebuild the full game state from the list of guessed dish ids. The server is
 * stateless per player: the client keeps its guess list and replays it.
 */
export function buildState(puzzleId: string, label: string, answer: Dish, guessIds: string[]): GameState {
  if (guessIds.length > MAX_GUESSES) throw new GuessError(`At most ${MAX_GUESSES} guesses`);
  if (new Set(guessIds).size !== guessIds.length) throw new GuessError('Duplicate guess');

  const guesses: GuessResult[] = [];
  for (const id of guessIds) {
    const dish = DISH_BY_ID.get(id);
    if (!dish) throw new GuessError(`Unknown dish: ${id}`);
    if (guesses.at(-1)?.correct) throw new GuessError('Puzzle already solved');
    guesses.push(compare(dish, answer));
  }

  const won = guesses.at(-1)?.correct ?? false;
  const status = won ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  const wrong = guesses.filter((g) => !g.correct).length;
  const over = status !== 'playing';

  const shown = over ? answer.ingredients.length : Math.min(answer.ingredients.length, INITIAL_INGREDIENTS + wrong);

  return {
    puzzleId,
    label,
    maxGuesses: MAX_GUESSES,
    ingredients: answer.ingredients.slice(0, shown),
    totalIngredients: answer.ingredients.length,
    guesses,
    status,
    answer: over ? reveal(answer) : undefined,
  };
}
