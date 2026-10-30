import { useCallback, useEffect, useState } from 'react';
import type { DishSummary, GameState } from '../../shared/types';
import { ApiError, fetchPuzzle, fetchState } from './api';
import GuessBoard from './components/GuessBoard';
import GuessInput from './components/GuessInput';
import HelpModal from './components/HelpModal';
import IngredientList from './components/IngredientList';
import KitchenBackground from './components/KitchenBackground';
import Plate from './components/Plate';
import ResultCard from './components/ResultCard';

const SAVE_KEY = 'grubblio:current';

interface Saved {
  puzzleId: string;
  guesses: string[];
}

function load(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function save(state: GameState) {
  try {
    const saved: Saved = { puzzleId: state.puzzleId, guesses: state.guesses.map((g) => g.dish.id) };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // Storage unavailable (private mode etc.) — progress just won't persist.
  }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const apply = useCallback((state: GameState) => {
    setGame(state);
    save(state);
  }, []);

  useEffect(() => {
    const saved = load();
    // Saved practice puzzles live in server memory and vanish on restart, so
    // fall back to a fresh test puzzle if the server no longer knows the id.
    (saved ? fetchState(saved) : Promise.reject(new ApiError(404, 'none')))
      .catch(() => fetchPuzzle())
      .then(apply)
      .catch((e) => setError(e.message));
    if (!saved) setShowHelp(true);
  }, [apply]);

  const guess = async (dish: DishSummary) => {
    if (!game || busy) return;
    setBusy(true);
    setError(null);
    try {
      apply(await fetchState({ puzzleId: game.puzzleId, guesses: [...game.guesses.map((g) => g.dish.id), dish.id] }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const newGame = async (mode?: 'practice') => {
    setError(null);
    try {
      const state = await fetchPuzzle(mode);
      // Restarting the fixed test puzzle should clear previous guesses too.
      apply(state);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const guessedIds = new Set(game?.guesses.map((g) => g.dish.id));
  const remaining = game ? game.maxGuesses - game.guesses.length : 0;

  return (
    <div className="app">
      <KitchenBackground />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>🍽️</span>
          <h1>Grubbl.io</h1>
          {game && <span className="puzzle-label">{game.label}</span>}
        </div>
        <nav className="topbar-actions">
          <button className="ghost" onClick={() => newGame('practice')}>New practice</button>
          {game?.puzzleId !== 'test' && <button className="ghost" onClick={() => newGame()}>Test puzzle</button>}
          <button className="icon" aria-label="How to play" onClick={() => setShowHelp(true)}>?</button>
        </nav>
      </header>

      <main>
        {error && <p className="error" role="alert">{error}</p>}
        {!game ? (
          <p className="loading">Setting the table…</p>
        ) : (
          <>
            {game.status !== 'playing' && <ResultCard game={game} onPractice={() => newGame('practice')} />}

            <section className="panel">
              <div className="panel-head">
                <h2>Ingredients</h2>
                <span className="muted">{game.ingredients.length} of {game.totalIngredients} revealed</span>
              </div>
              <IngredientList game={game} />
            </section>

            {game.status === 'playing' && (
              <section className="guess-area">
                <GuessInput guessed={guessedIds} disabled={busy} onGuess={guess} />
                <div className="tries" aria-label={`${remaining} guesses left`}>
                  {Array.from({ length: game.maxGuesses }, (_, i) => (
                    <Plate key={i} broken={i < game.guesses.length} fresh={i === game.guesses.length - 1} />
                  ))}
                  <span className="muted">{remaining} left</span>
                </div>
              </section>
            )}

            <GuessBoard guesses={game.guesses} />
          </>
        )}
      </main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
