// Sends one-time login codes through Resend (https://resend.com), with one
// HTTPS request per email and no SDK. Setup is in the README ("Accounts").
//
// In local dev without RESEND_API_KEY, the code is printed to the dev server's
// console instead, so sign-up works without an email account.

export interface EmailEnv {
  /** Resend API key. Set in production with `wrangler secret put RESEND_API_KEY`. */
  RESEND_API_KEY?: string;
  /** Sender, e.g. "Grubblio <login@grubbl.io>". Its domain must be verified in Resend. */
  EMAIL_FROM?: string;
}

export type CodeType = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

/** How long a code lasts; also passed to the email-OTP plugin. */
export const CODE_TTL_MINUTES = 10;

const SUBJECT: Record<CodeType, string> = {
  'sign-in': 'Your Grubblio code',
  'email-verification': 'Verify your email for Grubblio',
  'forget-password': 'Reset your Grubblio password',
  'change-email': 'Confirm your new Grubblio email',
};

const PURPOSE: Record<CodeType, string> = {
  'sign-in': 'to sign in or finish creating your account',
  'email-verification': 'to verify your email',
  'forget-password': 'to reset your password',
  'change-email': 'to confirm your new email',
};

export async function sendCode(env: EmailEnv, dev: boolean, to: string, code: string, type: CodeType): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (dev) console.log(`\n  [dev] Grubblio ${type} code for ${to}: ${code}\n`);
    else console.error('RESEND_API_KEY is not set, so no login email was sent');
    return;
  }

  const text = [
    `Your Grubblio code is ${code}.`,
    '',
    `Enter it ${PURPOSE[type]}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    "If you didn't ask for this, you can ignore this email.",
  ].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#2a1e19">
<p>Your Grubblio code is</p>
<p style="font:700 32px/1 ui-monospace,monospace;letter-spacing:6px;margin:12px 0">${code}</p>
<p>Enter it ${PURPOSE[type]}. It expires in ${CODE_TTL_MINUTES} minutes.</p>
<p style="color:#74624f;font-size:14px">If you didn't ask for this, you can ignore this email.</p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? 'Grubblio <login@grubbl.io>',
      to: [to],
      subject: SUBJECT[type],
      text,
      html,
    }),
  });
  if (!res.ok) console.error(`Resend refused the ${type} email (${res.status}): ${await res.text()}`);
}
