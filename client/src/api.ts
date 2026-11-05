import type { GameState, ResolveResponse, StateRequest } from '../../shared/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

export const resolveGuess = (q: string) => call<ResolveResponse>(`/api/resolve?q=${encodeURIComponent(q)}`);

/** The daily puzzle for a YYYY-MM-DD date (the player's local date). */
export const fetchDaily = (date: string) => call<GameState>(`/api/puzzle?date=${date}`);

export const fetchPractice = () => call<GameState>('/api/puzzle?mode=practice');

export const fetchState = (req: StateRequest) =>
  call<GameState>('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
