import { useState } from 'react';
import type { GameState } from '../../../shared/types';
import { titleCase } from '../format';
import { heat } from './GuessBoard';

const TILE = { exact: '🟩', partial: '🟨', miss: '🟥' } as const;

/** "Nov 5" for a daily puzzle (its id is its date), so shared results say which day. */
function dayOf(puzzleId: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleId)) return null;
  return new Date(`${puzzleId}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function shareText(game: GameState): string {
  const score = game.status === 'won' ? game.guesses.length : 'X';
  const rows = game.guesses.map((g) => g.attributes.map((a) => TILE[a.match]).join('') + ` ${g.closeness}%`);
  const title = ['Grubblio', game.label, dayOf(game.puzzleId), `${score}/${game.maxGuesses}`].filter(Boolean).join(' · ');
  return [title, ...rows].join('\n');
}

export default function ResultCard({ game, onPractice }: { game: GameState; onPractice: () => void }) {
  const [copied, setCopied] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const answer = game.answer!;
  const won = game.status === 'won';
  const best = Math.max(...game.guesses.filter((g) => !g.correct).map((g) => g.closeness), 0);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareText(game));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy your result:', shareText(game));
    }
  };

  return (
    <section className={`result ${won ? 'won' : 'lost'}`}>
      <div className="result-photo">
        {answer.image && !photoFailed
          ? <img src={answer.image} alt={answer.name} onError={() => setPhotoFailed(true)} />
          : <span className="photo-fallback">{answer.emoji}</span>}
      </div>
      <div className="result-body">
        <p className="result-kicker">
          {won
            ? `Solved in ${game.guesses.length} ${game.guesses.length === 1 ? 'guess' : 'guesses'}`
            : `Out of guesses · your closest was ${best}% (${heat(best).label.toLowerCase()})`}
        </p>
        <h2>{won ? 'Bon appétit!' : 'The dish was…'} <span className="answer-name">{answer.name}</span></h2>
        <p className="muted">{answer.country} · {answer.region}</p>
        <p className="blurb">{answer.blurb}</p>
        <p className="result-ings">
          {answer.ingredients.map(titleCase).join(' · ')}
        </p>
        <div className="result-actions">
          <button className="primary" onClick={share}>{copied ? 'Copied!' : 'Share result'}</button>
          <button className="ghost" onClick={onPractice}>New order</button>
        </div>
        {answer.imageCredit && (
          <p className="credit">
            Photo:{' '}
            {answer.imageCreditUrl ? (
              <a href={answer.imageCreditUrl} target="_blank" rel="noopener noreferrer">{answer.imageCredit}</a>
            ) : (
              answer.imageCredit
            )}
          </p>
        )}
      </div>
    </section>
  );
}
