import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { AccountInfo, DishSummary, GameState } from '../../shared/types';
import { getAccount, maybeSignedIn } from './account';
import { fetchDaily, fetchPractice, fetchState } from './api';
import AccountModal from './components/AccountModal';
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

/** The game on screen, daily or practice. */
const SAVE_KEY = 'grubblio:current';
/** The latest daily puzzle's progress, kept apart so a practice game can't overwrite it. */
const DAILY_KEY = 'grubblio:daily';
/** A Rush hour with at least one guess and no result yet. It must be finished before another is dealt. */
const RUSH_KEY = 'grubblio:rush';
const FINISH_FIRST = 'Finish this order before taking a new one.';

interface Saved {
  puzzleId: string;
  guesses: string[];
  /** Local date the game was last saved on. */
  savedOn?: string;
}

/** Daily puzzle ids are dates; practice ids start with "practice-". */
const isDaily = (puzzleId: string) => /^\d{4}-\d{2}-\d{2}$/.test(puzzleId);

/** The player's local date as YYYY-MM-DD; it picks the daily puzzle. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function load(key: string): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function save(state: GameState) {
  try {
    const saved: Saved = { puzzleId: state.puzzleId, guesses: state.guesses.map((g) => g.dish.id), savedOn: today() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    if (isDaily(state.puzzleId)) {
      localStorage.setItem(DAILY_KEY, JSON.stringify(saved));
    } else if (state.status === 'playing' && state.guesses.length) {
      localStorage.setItem(RUSH_KEY, JSON.stringify(saved));
    } else if (state.status !== 'playing' && load(RUSH_KEY)?.puzzleId === state.puzzleId) {
      localStorage.removeItem(RUSH_KEY);
    }
  } catch {
    // Storage unavailable (private mode etc.) — progress just won't persist.
  }
}

/**
 * Rush hour: the unfinished one if there is one, otherwise a new dish. For a
 * signed-in player the server also hands back an unfinished game from another
 * device before dealing a new one.
 */
function openRush(): Promise<GameState> {
  const saved = load(RUSH_KEY);
  if (!saved) return fetchPractice();
  return fetchState(saved)
    .then((state) => {
      if (state.status === 'playing') return state;
      // Finished elsewhere in the meantime: forget it and deal a new one.
      localStorage.removeItem(RUSH_KEY);
      return fetchPractice();
    })
    .catch(() => {
      // The id no longer opens (e.g. the server's secret changed): start over.
      localStorage.removeItem(RUSH_KEY);
      return fetchPractice();
    });
}

/** Today's daily puzzle, with any guesses already made on it. */
function openDaily(): Promise<GameState> {
  const date = today();
  const saved = load(DAILY_KEY);
  return saved?.puzzleId === date
    ? fetchState(saved).catch(() => fetchDaily(date))
    : fetchDaily(date);
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A heads-up in the guess input's hint line, e.g. why Rush hour reopened an old order. */
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  /** The signed-in player, or null when signed out. */
  const [account, setAccount] = useState<AccountInfo | null>(null);
  useEffect(() => {
    // Only browsers that have signed in before ask the server.
    if (maybeSignedIn()) getAccount().then(setAccount, () => {});
  }, []);

  /** Signing in or out from the account dialog. */
  const onAccount = (next: AccountInfo | null) => {
    // Just signed in: replay the games already on this device so they're
    // saved to the account (the server records any game sent by a signed-in player).
    if (next && !account) {
      const games = [load(DAILY_KEY), load(SAVE_KEY)].filter((s) => s?.guesses.length) as Saved[];
      for (const s of games) fetchState(s).catch(() => {});
    }
    setAccount(next);
  };
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
    const saved = load(SAVE_KEY);
    // Resume a practice game started today. Otherwise (first visit, or a new
    // day) open today's daily puzzle.
    const resume = saved && saved.savedOn === today() && !isDaily(saved.puzzleId) ? saved : null;
    (resume ? fetchState(resume).catch(openDaily) : openDaily())
      .then(apply)
      .catch((e) => setError(e.message));
    if (!saved) setShowHelp(true);
  }, [apply]);

  const guess = async (dish: DishSummary) => {
    if (!game || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
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

  /** A Rush hour (resuming an unfinished one first), or back to today's daily (keeping its guesses). */
  const newGame = async (mode: 'practice' | 'daily') => {
    // Picking a game from the top bar ends a break; no need for "Back to it" first.
    setOnBreak(false);
    setError(null);
    setNotice(null);
    // Already on today's Daily dish: leave the ticket hanging.
    if (mode === 'daily' && game?.puzzleId === today()) return;
    // A Rush hour that's been guessed at must be finished before another is dealt.
    const onUnfinishedRush = game && !isDaily(game.puzzleId) && game.status === 'playing' && game.guesses.length > 0;
    if (mode === 'practice' && onUnfinishedRush) {
      setNotice(FINISH_FIRST);
      return;
    }
    try {
      const state = await (mode === 'practice' ? openRush() : openDaily());
      if (mode === 'practice' && state.guesses.length) setNotice(FINISH_FIRST);
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
  const openAccount = () => {
    setShowAccount(true);
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
            <button className="ghost" onClick={() => newGame('daily')}>Daily dish</button>
            <button className="ghost" onClick={() => newGame('practice')}>Rush hour</button>
            <button className="ghost" aria-pressed={onBreak} onClick={() => setOnBreak(!onBreak)}>
              {onBreak ? 'Back to it' : 'Take a break'}
            </button>
            <button className="ghost" onClick={openAccount}>{account ? 'My games' : 'Sign in'}</button>
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
                    notice={notice}
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
      {showAccount && (
        <AccountModal account={account} today={today()} onAccount={onAccount} onClose={() => setShowAccount(false)} />
      )}
    </div>
  );
}
