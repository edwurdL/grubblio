// Types shared between the Express API and the React client.

export type Match = 'exact' | 'partial' | 'miss';

/** Public info about a dish — safe to send to the client for autocomplete. */
export interface DishSummary {
  id: string;
  name: string;
  aliases: string[];
  emoji: string;
}

export type AttributeKey = 'family' | 'origin' | 'diet' | 'palate' | 'course' | 'method' | 'spice' | 'ingredients';

export interface AttributeResult {
  key: AttributeKey;
  /** The guessed dish's value for this attribute, as displayed. */
  value: string;
  match: Match;
  /** For ordered attributes (spice): which way the answer lies. */
  direction?: 'up' | 'down';
  /** Short explanation shown on hover, e.g. "Same region: Europe". */
  note?: string;
}

export interface GuessResult {
  dish: DishSummary;
  correct: boolean;
  attributes: AttributeResult[];
  /** 0–100 overall "how close was that" score. */
  closeness: number;
}

export interface AnswerReveal {
  id: string;
  name: string;
  emoji: string;
  country: string;
  region: string;
  blurb: string;
  ingredients: string[];
  image: string | null;
  imageCredit: string | null;
  /** Page of the original photo on the stock/source site. */
  imageCreditUrl: string | null;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  puzzleId: string;
  label: string;
  maxGuesses: number;
  /** Ingredients revealed so far, in reveal order. */
  ingredients: string[];
  totalIngredients: number;
  /** Oldest first. */
  guesses: GuessResult[];
  status: GameStatus;
  /** Only present once the game is over. */
  answer?: AnswerReveal;
}

/** Free text → dish. `exact` is set only for a full name/alias match. */
export interface ResolveResponse {
  exact: DishSummary | null;
  suggestions: DishSummary[];
}

export interface StateRequest {
  puzzleId: string;
  guesses: string[];
}

// ── Accounts and game history ────────────────────────────

/** The signed-in player, from GET /api/account. */
export interface AccountInfo {
  name: string;
  email: string;
  /** False until the player sets a password after signing up with a code. */
  hasPassword: boolean;
}

export type PlayMode = 'daily' | 'rush';

export interface HistoryGame {
  /** A date (YYYY-MM-DD) for a Daily dish; an opaque id for Rush hour. */
  puzzleId: string;
  status: GameStatus;
  guesses: number;
  /** ms since epoch. */
  startedAt: number;
  /** Only for finished games. */
  answer: DishSummary | null;
}

export interface ModeStats {
  /** Finished games. */
  played: number;
  won: number;
  /** 0–100. */
  winRate: number;
  /** Wins by guess count: index 0 = solved in 1 guess. */
  distribution: number[];
  /** Daily dish only: consecutive days won. */
  currentStreak?: number;
  maxStreak?: number;
}

export interface ModeHistory {
  stats: ModeStats;
  /** Newest first. */
  games: HistoryGame[];
}

/** GET /api/history */
export interface GameHistory {
  daily: ModeHistory;
  rush: ModeHistory;
}
