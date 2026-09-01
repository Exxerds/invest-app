/**
 * Meta Pixel (Facebook Pixel) integration.
 *
 * The pixel ID below is the production ID for this site. It is embedded in the
 * client bundle on purpose — Meta Pixel IDs are public and are meant to be
 * visible in the page source.
 *
 * To track a different/demo pixel temporarily, set it in a root `.env` file:
 *
 *   VITE_META_PIXEL_ID=123456789012345
 *
 * When neither the env var nor the default below is set, every call becomes a
 * no-op so the app keeps working without analytics.
 */

/** Meta Pixel ID configured for this project (1633191371495886). */
const DEFAULT_META_PIXEL_ID = '1633191371495886';

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => unknown;
  push?: Fbq;
  loaded?: boolean;
  version?: string;
  queue?: unknown[][];
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const PIXEL_ID =
  String(import.meta.env.VITE_META_PIXEL_ID ?? '').trim() || DEFAULT_META_PIXEL_ID;

let initialized = false;
let scriptPending = false;
let initFailed = false;

/**
 * Injects the official Meta Pixel snippet once and initialises it with the
 * configured ID. Safe to call many times — it only runs on the first call.
 */
export function initMetaPixel(): void {
  if (!PIXEL_ID || initialized || initFailed) return;

  const win = window as Window & { fbq?: Fbq; _fbq?: Fbq };

  if (!win.fbq) {
    win.fbq = function (...args: unknown[]) {
      const self = win.fbq as Fbq;
      if (self.callMethod) {
        self.callMethod(...args);
      } else if (self.queue) {
        self.queue.push(args);
      }
    } as Fbq;
    win._fbq = win._fbq || win.fbq;

    const api = win.fbq as unknown as Fbq & { push: Fbq; loaded: boolean; version: string; queue: unknown[][] };
    api.push = api;
    api.loaded = true;
    api.version = '2.0';
    api.queue = [];

    if (!scriptPending) {
      scriptPending = true;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      }
    }
  }

  try {
    win.fbq?.('init', PIXEL_ID);
    initialized = true;
  } catch {
    initFailed = true;
  }
}

/**
 * Track a standard Meta Pixel event (PageView, Lead, CompleteRegistration,
 * Login, InitiateCheckout, Purchase, etc).
 */
export function trackMetaPixel(event: string, data?: Record<string, unknown>): void {
  initMetaPixel();
  const win = window as Window & { fbq?: Fbq };
  if (!PIXEL_ID || !win.fbq) return;
  try {
    win.fbq('track', event, data ?? {});
  } catch {
    /* never break the UI because of analytics */
  }
}

/**
 * Track a custom event under a custom name (these show up in Events Manager
 * as custom events and need to be configured there to appear in ads).
 */
export function trackCustomMetaPixel(event: string, data?: Record<string, unknown>): void {
  initMetaPixel();
  const win = window as Window & { fbq?: Fbq };
  if (!PIXEL_ID || !win.fbq) return;
  try {
    win.fbq('trackCustom', event, data ?? {});
  } catch {
    /* never break the UI because of analytics */
  }
}

/** Convenience helper for the standard PageView event. */
export function trackPageView(): void {
  trackMetaPixel('PageView');
}

/** Returns the configured pixel ID (empty string when disabled). */
export function getMetaPixelId(): string {
  return PIXEL_ID;
}
