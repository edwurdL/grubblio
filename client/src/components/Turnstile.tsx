import { useEffect, useRef } from 'react';

// Cloudflare Turnstile, the bot check on forms that send an email. Only used
// when the server reports a site key (GET /api/config); the script is loaded
// the first time a check is shown, never on the game screen.

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('The bot check failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Renders the check and reports its token, or null while there's no valid one.
 * A token works once: give the component a new `key` after using it.
 */
export default function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const report = useRef(onToken);
  report.current = onToken;

  useEffect(() => {
    let widget: string | undefined;
    let cancelled = false;
    loadScript().then(
      () => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widget = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          // Invisible unless Cloudflare wants the visitor to click something.
          appearance: 'interaction-only',
          theme: 'light',
          callback: (token: string) => report.current(token),
          'expired-callback': () => report.current(null),
          'error-callback': () => report.current(null),
        });
      },
      () => report.current(null),
    );
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey]);

  return <div ref={ref} className="turnstile" />;
}
