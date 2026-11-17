// Accounts, with Better Auth (https://better-auth.com). Users, sessions and
// login codes live in the same D1 database as the puzzles (migrations/).
//
// An account can only be created by proving you own the email first: sign-up
// is "email me a code" (the email-OTP plugin), and the account is created when
// the right code comes back. The player then sets a password
// (POST /api/account/password). The plain email + password sign-up endpoint is
// switched off, since it would create the account before the email is checked.
//
// Players can rename themselves, change their password and delete their
// account (which deletes their game history too) from My games → Account.
//
// Bot protection: with TURNSTILE_SECRET_KEY set, the two endpoints that send
// emails need a Cloudflare Turnstile token, so scripts can't burn through the
// email quota. Without it they're only rate-limited.
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { captcha } from 'better-auth/plugins/captcha';
import { emailOTP } from 'better-auth/plugins/email-otp';
import type { D1Database } from './daily';
import { CODE_TTL_MINUTES, sendCode, type EmailEnv } from './email';

export interface AuthEnv extends EmailEnv {
  DB: D1Database;
  /** Signs session cookies. Set in production with `wrangler secret put BETTER_AUTH_SECRET`. */
  BETTER_AUTH_SECRET?: string;
  /** Turnstile widget's secret key (`wrangler secret put TURNSTILE_SECRET_KEY`). Turns bot protection on. */
  TURNSTILE_SECRET_KEY?: string;
  /** Turnstile widget's public site key (a var in wrangler.jsonc); sent to the browser. */
  TURNSTILE_SITE_KEY?: string;
}

/** Endpoints that send an email, and so need a Turnstile token when bot protection is on. */
export const CAPTCHA_ENDPOINTS = ['/email-otp/send-verification-otp', '/email-otp/request-password-reset'];

// Local dev only; production refuses to start without BETTER_AUTH_SECRET, since
// anyone could forge session cookies with this public value.
const DEV_SECRET = 'grubblio-dev-only-auth-secret-do-not-use-in-production';

const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

/**
 * Better Auth's settings. `send` delivers a code; `origin` is the site's own
 * origin (https://grubbl.io in production), which cookies and CSRF checks use.
 */
export function authOptions(
  db: unknown,
  origin: string,
  secret: string,
  send: (to: string, code: string, type: Parameters<typeof sendCode>[4]) => Promise<void>,
  waitUntil?: (p: Promise<unknown>) => void,
  turnstileSecret?: string,
) {
  return {
    appName: 'Grubblio',
    baseURL: origin,
    basePath: '/api/auth',
    secret,
    database: db as BetterAuthOptions['database'],
    trustedOrigins: [origin, 'https://grubbl.io', 'https://www.grubbl.io'],
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true, // Accounts come from a verified code instead (see top).
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      deleteUser: {
        // Needs the password, or a session from the last day for code-only accounts.
        enabled: true,
        // Game history goes too. (The foreign key would cascade anyway; this
        // doesn't rely on D1 enforcing it.)
        beforeDelete: async (user) => {
          await (db as D1Database).prepare('DELETE FROM plays WHERE user_id = ?').bind(user.id).run();
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 60, // 60 days…
      updateAge: 60 * 60 * 24, // …extended at most once a day while in use
      // Signed copy of the session in a cookie, so most requests skip the D1 lookup.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: true,
      // Workers have many short-lived instances, so in-memory counts wouldn't hold.
      storage: 'database',
      // Checked on every page load; limiting it would cost a D1 write each time.
      customRules: { '/get-session': false },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      ...(waitUntil && { backgroundTasks: { handler: waitUntil } }),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_TTL_MINUTES * 60,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        // Send in the background, so response times don't reveal whether an email has an account.
        sendVerificationOTP: async ({ email, otp, type }) => {
          const sending = send(email, otp, type);
          if (waitUntil) waitUntil(sending);
          else await sending;
        },
      }),
      ...(turnstileSecret
        ? [captcha({
          provider: 'cloudflare-turnstile',
          secretKey: turnstileSecret,
          endpoints: CAPTCHA_ENDPOINTS,
          // Tokens issued for another site (or a copied widget) are refused. Not
          // in local dev: Cloudflare's test keys report the hostname example.com.
          ...(!isLocal(origin) && { allowedHostnames: [new URL(origin).hostname, 'grubbl.io', 'www.grubbl.io'] }),
        })]
        : []),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(env: AuthEnv, origin: string, waitUntil: (p: Promise<unknown>) => void) {
  const dev = isLocal(origin);
  const secret = env.BETTER_AUTH_SECRET ?? (dev ? DEV_SECRET : undefined);
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set: npx wrangler secret put BETTER_AUTH_SECRET');
  const send = (to: string, code: string, type: Parameters<typeof sendCode>[4]) => sendCode(env, dev, to, code, type);
  return betterAuth(authOptions(env.DB, origin, secret, send, waitUntil, env.TURNSTILE_SECRET_KEY));
}

/** The Turnstile site key the browser should use, or null when bot protection is off. */
export const turnstileSiteKey = (env: AuthEnv) =>
  env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null;

export type Auth = ReturnType<typeof createAuth>;
