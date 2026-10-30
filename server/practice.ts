// Practice puzzles are stateless: the puzzle id carries its answer, AES-GCM
// encrypted with PUZZLE_SECRET, so nothing is stored server-side and players
// can neither read the answer out of the id nor forge one.

const PREFIX = 'practice-';
// Pad dish ids to one length before encrypting; otherwise the ciphertext length
// would give away the answer's id length.
const PADDED = 48;

let cached: { secret: string; key: ReturnType<typeof crypto.subtle.importKey> } | null = null;

function key(secret: string) {
  if (cached?.secret !== secret) {
    const key = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(secret))
      .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
    cached = { secret, key };
  }
  return cached.key;
}

export async function sealPracticeId(dishId: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(dishId.padEnd(PADDED));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), plain));
  const bytes = new Uint8Array(iv.length + sealed.length);
  bytes.set(iv);
  bytes.set(sealed, iv.length);
  return PREFIX + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The dish id inside a practice puzzle id, or null if it isn't a valid one. */
export async function openPracticeId(puzzleId: string, secret: string): Promise<string | null> {
  if (!puzzleId.startsWith(PREFIX)) return null;
  try {
    const b64 = puzzleId.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(secret), bytes.slice(12));
    return new TextDecoder().decode(plain).trimEnd();
  } catch {
    return null; // Malformed, tampered with, or sealed with another secret.
  }
}
