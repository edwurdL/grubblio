import { useRef, useState, type KeyboardEvent } from 'react';
import type { DishSummary } from '../../../shared/types';
import { resolveGuess } from '../api';

interface Props {
  guessed: Set<string>;
  disabled: boolean;
  onGuess: (dish: DishSummary) => void;
}

export default function GuessInput({ guessed, disabled, onGuess }: Props) {
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** "Did you mean" candidates for the last submitted text. */
  const [candidates, setCandidates] = useState<DishSummary[]>([]);
  /** Highlighted row in the "Did you mean" dropdown. */
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reject = (msg: string) => {
    setMessage(msg);
    setShake(true);
  };

  const accept = (dish: DishSummary) => {
    if (guessed.has(dish.id)) return reject(`You already guessed ${dish.name}.`);
    onGuess(dish);
    setText('');
    setCandidates([]);
    setMessage(null);
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (!text.trim() || checking) return;
    // Pressing Enter while the dropdown is open confirms the highlighted row.
    if (candidates.length) return accept(candidates[active]);
    setChecking(true);
    try {
      const { exact, suggestions } = await resolveGuess(text);
      if (exact) return accept(exact);
      const fresh = suggestions.filter((d) => !guessed.has(d.id));
      if (fresh.length) {
        setCandidates(fresh);
        setActive(0);
        setMessage(null);
      } else if (suggestions.length) {
        reject(`You already guessed ${suggestions[0].name}.`);
      } else {
        reject("We don't know that dish. Try another name.");
      }
    } catch (e) {
      reject((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const dismiss = () => setCandidates([]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return dismiss();
    if (!candidates.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const step = e.key === 'ArrowDown' ? 1 : -1;
    setActive((i) => (i + step + candidates.length) % candidates.length);
  };

  const open = candidates.length > 0;

  return (
    <div className="guess-input">
      <form
        className={`input-row ${shake ? 'shake' : ''}`}
        onAnimationEnd={() => setShake(false)}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="input-wrap">
          <input
            ref={inputRef}
            value={text}
            disabled={disabled}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="Name the dish…"
            aria-label="Guess a dish"
            role="combobox"
            aria-expanded={open}
            aria-controls="dym-list"
            aria-activedescendant={open ? `dym-${candidates[active].id}` : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setCandidates([]);
              setMessage(null);
            }}
            onKeyDown={onKeyDown}
            onBlur={dismiss}
          />
          {open && (
            <ul className="dym-list" id="dym-list" role="listbox" aria-label="Did you mean">
              <li className="dym-head" aria-hidden>
                <span>Did you mean…</span>
                <span className="dym-hint">↑↓ · Enter · Esc</span>
              </li>
              {candidates.map((d, i) => (
                <li
                  key={d.id}
                  id={`dym-${d.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={`dym-option ${i === active ? 'active' : ''}`}
                  // Keep focus in the input so the blur handler doesn't close the list first.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => accept(d)}
                >
                  <span className="emoji" aria-hidden>{d.emoji}</span>
                  <span className="dym-name">{d.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="primary" type="submit" disabled={disabled || checking || !text.trim()}>
          Guess
        </button>
      </form>

      {message && <p className="input-message" role="status">{message}</p>}
    </div>
  );
}
