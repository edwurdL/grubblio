import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { AccountInfo, GameHistory, HistoryGame, ModeHistory, PlayMode } from '../../../shared/types';
import {
  getAccount, getHistory, resetPassword, sendResetCode, sendSignInCode, setPassword, signInWithCode,
  signInWithPassword, signOut,
} from '../account';
import Modal from './Modal';

type View = 'sign-in' | 'sign-up' | 'code' | 'password' | 'forgot' | 'reset' | 'games';

interface Props {
  account: AccountInfo | null;
  /** The player's local date (YYYY-MM-DD). */
  today: string;
  onAccount: (account: AccountInfo | null) => void;
  onClose: () => void;
}

/**
 * Signing in and up, and the signed-in player's past games.
 *
 * Creating an account always starts with an emailed code: the account exists
 * only once the code is entered, then the player picks a password.
 */
export default function AccountModal({ account, today, onAccount, onClose }: Props) {
  const [view, setView] = useState<View>(account ? (account.hasPassword ? 'games' : 'password') : 'sign-in');
  const [email, setEmail] = useState(account?.email ?? '');
  const [name, setName] = useState('');
  const [password, setPasswordText] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const go = (next: View) => {
    setView(next);
    setError(null);
    setInfo(null);
    setCode('');
    setPasswordText('');
    setConfirm('');
  };

  /** Runs a form action with a busy state and friendly errors. */
  const run = (action: () => Promise<void>) => async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** After any successful sign-in: load the account and finish setup if needed. */
  const signedIn = async () => {
    const acct = await getAccount();
    onAccount(acct);
    go(acct && !acct.hasPassword ? 'password' : 'games');
  };

  const checkNewPassword = () => {
    if (password.length < 8) throw new Error('Use at least 8 characters.');
    if (password !== confirm) throw new Error("The passwords don't match.");
  };

  const titleId = 'account-title';
  let body: ReactNode;

  if (view === 'sign-in') {
    body = (
      <>
        <h2 id={titleId}>Sign in</h2>
        <p className="muted">Keep your Daily dish streak and every Rush hour, on any device.</p>
        <form className="auth-form" onSubmit={run(async () => {
          await signInWithPassword(email.trim(), password);
          await signedIn();
        })}>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus />
          <Field label="Password" type="password" value={password} onChange={setPasswordText} autoComplete="current-password" />
          <Status error={error} info={info} />
          <button className="primary" disabled={busy || !email || !password}>Sign in</button>
        </form>
        <div className="auth-links">
          <button className="link" onClick={() => go('sign-up')}>Create an account</button>
          <button className="link" onClick={() => go('forgot')}>Forgot password?</button>
        </div>
      </>
    );
  } else if (view === 'sign-up') {
    body = (
      <>
        <h2 id={titleId}>Create an account</h2>
        <p className="muted">We'll email you a 6-digit code to check the address is yours. Your account is made once you enter it.</p>
        <form className="auth-form" onSubmit={run(async () => {
          await sendSignInCode(email.trim());
          go('code');
        })}>
          <Field label="Name" value={name} onChange={setName} autoComplete="nickname" maxLength={40} autoFocus />
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Status error={error} info={info} />
          <button className="primary" disabled={busy || !email || !name.trim()}>Email me a code</button>
        </form>
        <div className="auth-links">
          <button className="link" onClick={() => go('sign-in')}>I already have an account</button>
        </div>
      </>
    );
  } else if (view === 'code') {
    body = (
      <>
        <h2 id={titleId}>Check your email</h2>
        <p>Enter the 6-digit code we sent to <strong>{email}</strong>. It expires in 10 minutes.</p>
        <form className="auth-form" onSubmit={run(async () => {
          await signInWithCode(email.trim(), code.trim(), name.trim());
          await signedIn();
        })}>
          <CodeField value={code} onChange={setCode} />
          <Status error={error} info={info} />
          <button className="primary" disabled={busy || code.length !== 6}>Verify</button>
        </form>
        <div className="auth-links">
          <button className="link" disabled={busy} onClick={run(async () => {
            await sendSignInCode(email.trim());
            setInfo('New code sent.');
          })}>Send a new code</button>
          <button className="link" onClick={() => go('sign-up')}>Use a different email</button>
        </div>
      </>
    );
  } else if (view === 'password') {
    body = (
      <>
        <h2 id={titleId}>Choose a password</h2>
        <p>Your email is verified. Last step: pick a password to sign in with as <strong>{account?.email ?? email}</strong>.</p>
        <form className="auth-form" onSubmit={run(async () => {
          checkNewPassword();
          await setPassword(password);
          if (account) onAccount({ ...account, hasPassword: true });
          go('games');
        })}>
          <Field label="Password (8+ characters)" type="password" value={password} onChange={setPasswordText} autoComplete="new-password" autoFocus />
          <Field label="Same again" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <Status error={error} info={info} />
          <button className="primary" disabled={busy || !password || !confirm}>Save password</button>
        </form>
      </>
    );
  } else if (view === 'forgot') {
    body = (
      <>
        <h2 id={titleId}>Reset password</h2>
        <p className="muted">We'll email you a code to set a new one.</p>
        <form className="auth-form" onSubmit={run(async () => {
          await sendResetCode(email.trim());
          go('reset');
        })}>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus />
          <Status error={error} info={info} />
          <button className="primary" disabled={busy || !email}>Email me a code</button>
        </form>
        <div className="auth-links">
          <button className="link" onClick={() => go('sign-in')}>Back to sign in</button>
        </div>
      </>
    );
  } else if (view === 'reset') {
    body = (
      <>
        <h2 id={titleId}>New password</h2>
        <p>If <strong>{email}</strong> has an account, we've sent it a 6-digit code.</p>
        <form className="auth-form" onSubmit={run(async () => {
          checkNewPassword();
          await resetPassword(email.trim(), code.trim(), password);
          await signInWithPassword(email.trim(), password);
          await signedIn();
        })}>
          <CodeField value={code} onChange={setCode} />
          <Field label="New password (8+ characters)" type="password" value={password} onChange={setPasswordText} autoComplete="new-password" />
          <Field label="Same again" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <Status error={error} info={info} />
          <button className="primary" disabled={busy || code.length !== 6 || !password || !confirm}>Set password</button>
        </form>
        <div className="auth-links">
          <button className="link" disabled={busy} onClick={run(async () => {
            await sendResetCode(email.trim());
            setInfo('New code sent.');
          })}>Send a new code</button>
          <button className="link" onClick={() => go('sign-in')}>Back to sign in</button>
        </div>
      </>
    );
  } else {
    body = (
      <MyGames
        titleId={titleId}
        account={account}
        today={today}
        onSignOut={async () => {
          await signOut();
          onAccount(null);
          go('sign-in');
        }}
      />
    );
  }

  return <Modal titleId={titleId} onClose={onClose}>{body}</Modal>;
}

function Field({ label, onChange, ...input }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input {...input} type={input.type ?? 'text'} required onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CodeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="auth-field">
      <span>Code</span>
      <input
        className="code-input"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        autoFocus
        required
      />
    </label>
  );
}

function Status({ error, info }: { error: string | null; info: string | null }) {
  if (error) return <p className="auth-error" role="alert">{error}</p>;
  if (info) return <p className="auth-info" role="status">{info}</p>;
  return null;
}

// ── Signed in: past games ──────────────────────────────

const MODE_LABEL: Record<PlayMode, string> = { daily: 'Daily dish', rush: 'Rush hour' };

function MyGames({ titleId, account, today, onSignOut }: {
  titleId: string;
  account: AccountInfo | null;
  today: string;
  onSignOut: () => Promise<void>;
}) {
  const [mode, setMode] = useState<PlayMode>('daily');
  const [history, setHistory] = useState<GameHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHistory(today).then(setHistory, (e) => setError((e as Error).message));
  }, [today]);

  return (
    <>
      <h2 id={titleId}>{account?.name || 'My games'}</h2>
      {account && <p className="muted">{account.email}</p>}
      <div className="tabs" role="tablist">
        {(['daily', 'rush'] as const).map((m) => (
          <button key={m} role="tab" className="ghost" aria-selected={mode === m} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!history && !error && <p className="muted">Fetching your orders…</p>}
      {history && <ModePanel mode={mode} history={history[mode]} today={today} />}
      <div className="modal-actions">
        <button className="ghost" onClick={onSignOut}>Sign out</button>
      </div>
    </>
  );
}

function ModePanel({ mode, history, today }: { mode: PlayMode; history: ModeHistory; today: string }) {
  const { stats, games } = history;
  if (!games.length) {
    return <p className="muted">No {MODE_LABEL[mode]} games yet. Games you play while signed in show up here.</p>;
  }
  const most = Math.max(1, ...stats.distribution);
  return (
    <>
      <div className="stat-row">
        <Stat value={stats.played} label="Played" />
        <Stat value={`${stats.winRate}%`} label="Won" />
        {mode === 'daily'
          ? <><Stat value={stats.currentStreak ?? 0} label="Streak" /><Stat value={stats.maxStreak ?? 0} label="Best" /></>
          : <Stat value={stats.won} label="Wins" />}
      </div>

      <h3>Solved in</h3>
      <div className="dist">
        {stats.distribution.map((n, i) => (
          <div className="dist-row" key={i}>
            <span>{i + 1}</span>
            <span className={`dist-bar ${n ? 'some' : ''}`} style={{ width: `${Math.max(8, (n / most) * 100)}%` }}>{n}</span>
          </div>
        ))}
      </div>

      <h3>Recent</h3>
      <ul className="game-list">
        {games.map((g) => <GameRow key={g.puzzleId} game={g} mode={mode} today={today} />)}
      </ul>
    </>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <span className="stat-num">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function GameRow({ game, mode, today }: { game: HistoryGame; mode: PlayMode; today: string }) {
  // A Daily dish is named by its puzzle date; a Rush hour by when it was played.
  const when = mode === 'daily'
    ? (game.puzzleId === today ? 'Today' : shortDate(Date.parse(`${game.puzzleId}T12:00:00`)))
    : shortDate(game.startedAt);
  const result = game.status === 'won'
    ? `Solved in ${game.guesses}`
    : game.status === 'lost' ? 'Missed' : `In progress · ${game.guesses} ${game.guesses === 1 ? 'guess' : 'guesses'}`;
  return (
    <li>
      <span className="game-when">{when}</span>
      <span className="game-dish">{game.answer ? `${game.answer.emoji} ${game.answer.name}` : '❓ Not revealed'}</span>
      <span className={`game-result tile ${game.status === 'won' ? 'exact' : game.status === 'lost' ? 'miss' : 'partial'}`}>{result}</span>
    </li>
  );
}
