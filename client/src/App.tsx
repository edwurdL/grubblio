import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { DishSummary, GameState } from '../../shared/types';
import { ApiError, fetchPuzzle, fetchState } from './api';
import { celebrate, takeDamage } from './screenFx';
import GuessBoard, { Legend } from './components/GuessBoard';
import GuessInput from './components/GuessInput';
import CreditsModal from './components/CreditsModal';
import HelpModal from './components/HelpModal';
import KitchenBackground from './components/KitchenBackground';
import OrderTicket from './components/OrderTicket';
import { ChefHat, Speaker } from './components/Pixel';
import SideCharacters from './components/SideCharacters';
import Plate from './components/Plate';
import ResultCard from './components/ResultCard';
import { useFitToViewport } from './useFitToViewport';
import { useSound } from './useSound';

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
  const [showCredits, setShowCredits] = useState(false);
  /** "Take a break": everything but the top bar fades away to show the restaurant. */
  const [onBreak, setOnBreak] = useState(false);
  useEffect(() => {
    if (!onBreak) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOnBreak(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBreak]);
  /** Bumped on every new game, so a fresh ticket is hung even for the same puzzle. */
  const [round, setRound] = useState(0);

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
      const next = await fetchState({ puzzleId: game.puzzleId, guesses: [...game.guesses.map((g) => g.dish.id), dish.id] });
      apply(next);
      if (next.guesses.at(-1)?.correct) {
        sound.play('bite');
        celebrate();
      } else {
        sound.play(next.status === 'lost' ? 'gameOver' : 'plateBreak');
        takeDamage(flashRef.current);
      }
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
      setRound((r) => r + 1);
      sound.play('pageTurn');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stageRef = useRef<HTMLDivElement>(null);
  const orderColRef = useRef<HTMLDivElement>(null);
  const playingHeight = useRef(0);
  // When the result card replaces the ticket, hold the column at its in-game
  // height so the page zoom (and the chef and customer) don't change size.
  useLayoutEffect(() => {
    const col = orderColRef.current;
    if (!col) return;
    if (game?.status === 'playing') {
      col.style.minHeight = '';
      playingHeight.current = col.offsetHeight;
    } else if (playingHeight.current) {
      col.style.minHeight = `${playingHeight.current}px`;
    }
  });
  const flashRef = useRef<HTMLDivElement>(null);
  // Always leave room under the page for the pinned legend, so the first
  // guess doesn't change the zoom.
  useFitToViewport(stageRef, 60);

  // Every guess while playing is a miss (a right one ends the game), so the
  // music speeds up with each, hitting 2× on the last plate.
  const playing = game?.status === 'playing';
  const sound = useSound(playing ? 1 + game.guesses.length / (game.maxGuesses - 1) : 1);

  const volumeShown = sound.muted ? 0 : sound.volume;

  // Opening a menu turns a page, like the new-order ticket.
  const openHelp = () => {
    setShowHelp(true);
    sound.play('pageTurn');
  };
  const openCredits = () => {
    setShowHelp(false);
    setShowCredits(true);
    sound.play('pageTurn');
  };

  const guessedIds = new Set(game?.guesses.map((g) => g.dish.id));
  const remaining = game ? game.maxGuesses - game.guesses.length : 0;

  return (
    <div className={`app ${onBreak ? 'on-break' : ''}`}>
      <KitchenBackground />
      <div className="stage" ref={stageRef}>
        <header className="topbar">
          <div className="brand">
            <ChefHat />
            <h1>Grubbl.io</h1>
          </div>
          {game && <span className="puzzle-label">{game.label}</span>}
          <nav className="topbar-actions">
            <button className="ghost" onClick={() => newGame('practice')}>New order</button>
            {game?.puzzleId !== 'test' && <button className="ghost" onClick={() => newGame()}>Test puzzle</button>}
            <button className="ghost" aria-pressed={onBreak} onClick={() => setOnBreak(!onBreak)}>
              {onBreak ? 'Back to it' : 'Take a break'}
            </button>
            <button className="ghost credits-btn" onClick={openCredits}>Credits</button>
            {/* Click to mute; hover (or focus) for a volume slider. */}
            <div className="sound-control">
              <button className="icon sound" aria-label="Sound" aria-pressed={!sound.muted} onClick={sound.toggle}>
                <Speaker on={!sound.muted} />
              </button>
              <div className="volume-pop">
                <label className="volume-panel">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumeShown}
                    aria-label="Volume"
                    style={{ '--fill': `${volumeShown * 100}%` } as CSSProperties}
                    onChange={(e) => sound.setVolume(Number(e.target.value))}
                  />
                  <span className="volume-value" aria-hidden>{Math.round(volumeShown * 100)}%</span>
                </label>
              </div>
            </div>
            <button className="icon" aria-label="How to play" onClick={openHelp}>?</button>
          </nav>
        </header>

        <main>
          {error && <p className="error" role="alert">{error}</p>}
          {!game ? (
            <p className="loading">Setting the table…</p>
          ) : (
            <>
              <div ref={orderColRef} className={`order-col ${game.status === 'playing' ? '' : 'over'}`}>
                <SideCharacters game={game} />
                {/* Once the game is over the result card lists every ingredient, so it takes the ticket's spot. */}
                <div className="rail">
                  {game.status === 'playing'
                    ? <OrderTicket key={round} game={game} />
                    : <ResultCard game={game} onPractice={() => newGame('practice')} />}
                </div>

                {game.status === 'playing' && (
                  <GuessInput
                    guessed={guessedIds}
                    disabled={busy}
                    onGuess={guess}
                    aside={
                      <span className="plates" role="img" aria-label={`${remaining} guesses left`}>
                        {Array.from({ length: game.maxGuesses }, (_, i) => (
                          <Plate key={i} broken={i < game.guesses.length} fresh={i === game.guesses.length - 1} />
                        ))}
                        <span className="plates-left" aria-hidden>{remaining} left</span>
                      </span>
                    }
                  />
                )}
              </div>

              <GuessBoard guesses={game.guesses} />
            </>
          )}
        </main>
      </div>

      {game && game.guesses.length > 0 && <Legend />}
      <div className="damage-flash" ref={flashRef} aria-hidden />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} onCredits={openCredits} />}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </div>
  );
}
