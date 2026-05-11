/**
 * Yandex Metrika integration. The counter ID is injected at build time via
 * the `VITE_YM_COUNTER_ID` env var — when it's missing (e.g. local dev) the
 * helpers all no-op so we don't poison local sessions with prod traffic.
 *
 * Click Family uses a dedicated counter (NOT shared with Letstrip) so the
 * session/funnel data isn't mixed.
 */
declare global {
  interface Window {
    ym?: ((id: number, ...args: unknown[]) => void) & { a?: unknown[]; l?: number };
  }
}

const COUNTER_ID_RAW = import.meta.env.VITE_YM_COUNTER_ID;
const COUNTER_ID = COUNTER_ID_RAW ? Number(COUNTER_ID_RAW) : 0;
export const isEnabled = () => COUNTER_ID > 0;

const TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js';
let inited = false;

/** Inject the Metrika tag once. Safe to call repeatedly. */
export const initMetrika = (): void => {
  if (inited || !isEnabled()) return;
  inited = true;

  // Hand-rolled equivalent of Metrika's boot snippet. The queue function is
  // installed on `window.ym` so any call before the script loads is buffered
  // and replayed once tag.js is ready.
  if (!window.ym) {
    const queue: { a: unknown[]; l: number } & ((..._: unknown[]) => void) = ((...args: unknown[]) => {
      (queue.a = queue.a || []).push(args);
    }) as never;
    queue.a = [];
    queue.l = Date.now();
    window.ym = queue as unknown as Window['ym'];
  }
  if (!Array.from(document.scripts).some((s) => s.src === TAG_SRC)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = TAG_SRC;
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }

  // `defer: true` — let RouteTracker fire the first hit so SPA navigation
  // doesn't double-count the initial page. The rest mirrors the snippet
  // Метрика generates for static sites (clickmap, trackLinks, webvisor,
  // accurateTrackBounce, ecommerce dataLayer).
  window.ym?.(COUNTER_ID, 'init', {
    defer: true,
    ssr: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    ecommerce: 'dataLayer',
  });
};

/** Record an SPA page-view. Pass the new URL (or omit for current location). */
export const trackPageView = (url?: string): void => {
  if (!isEnabled()) return;
  initMetrika();
  window.ym?.(COUNTER_ID, 'hit', url ?? location.pathname + location.search);
};

/** Record a custom event with optional params. Use for funnel steps. */
export const trackEvent = (event: string, params?: Record<string, unknown>): void => {
  if (!isEnabled()) return;
  initMetrika();
  window.ym?.(COUNTER_ID, 'reachGoal', event, params);
};
