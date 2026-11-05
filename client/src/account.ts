// Account calls: Better Auth's endpoints under /api/auth, plus the game's own
// /api/account and /api/history (server/index.ts). Plain fetch, no SDK.
import type { AccountInfo, GameHistory } from '../../shared/types';

/**
 * Remembers that this browser has signed in, so anonymous visitors don't spend
 * a request asking "who am I?" on every page load. The session cookie itself
 * is httpOnly and unreadable here.
 */
const SIGNED_IN_KEY = 'grubblio:signed-in';

export function maybeSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

function setSignedIn(on: boolean) {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // Storage unavailable: we'll just check with the server each time.
  }
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Better Auth error codes, in the game's voice.
const MESSAGES: Record<string, string> = {
  INVALID_OTP: "That code isn't right.",
  OTP_EXPIRED: 'That code has expired. Send a new one.',
  TOO_MANY_ATTEMPTS: 'Too many wrong tries. Send a new code.',
  INVALID_EMAIL_OR_PASSWORD: 'Wrong email or password.',
  INVALID_EMAIL: "That doesn't look like an email address.",
  PASSWORD_TOO_SHORT: 'Use at least 8 characters.',
  PASSWORD_TOO_LONG: 'Use at most 128 characters.',
  EMAIL_NOT_VERIFIED: 'Verify your email first.',
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = res.status === 429
      ? 'Too many tries. Wait a minute, then try again.'
      : MESSAGES[data.code] ?? data.error ?? data.message ?? 'Something went wrong. Try again.';
    throw new AuthError(res.status, message);
  }
  return data as T;
}

/** The signed-in player, or null. */
export async function getAccount(): Promise<AccountInfo | null> {
  try {
    const account = await call<AccountInfo>('/api/account');
    setSignedIn(true);
    return account;
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) {
      setSignedIn(false);
      return null;
    }
    throw e;
  }
}

/** Emails a code that signs in, creating the account if the email is new. */
export const sendSignInCode = (email: string) =>
  call('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });

export async function signInWithCode(email: string, otp: string, name?: string) {
  await call('/api/auth/sign-in/email-otp', { email, otp, ...(name && { name }) });
  setSignedIn(true);
}

export async function signInWithPassword(email: string, password: string) {
  await call('/api/auth/sign-in/email', { email, password });
  setSignedIn(true);
}

/** First password, for an account made with a code. */
export const setPassword = (password: string) => call('/api/account/password', { password });

export const sendResetCode = (email: string) => call('/api/auth/email-otp/request-password-reset', { email });

export const resetPassword = (email: string, otp: string, password: string) =>
  call('/api/auth/email-otp/reset-password', { email, otp, password });

export async function signOut() {
  await call('/api/auth/sign-out', {}).catch(() => {});
  setSignedIn(false);
}

/** Past games; `today` is the player's local date, for the daily streak. */
export const getHistory = (today: string) => call<GameHistory>(`/api/history?today=${today}`);
