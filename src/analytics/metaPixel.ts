// ============================================================
//  Optional Meta Pixel integration.
//
//  The Pixel ID is intentionally supplied at build time through
//  VITE_META_PIXEL_ID, never hard-coded in the repository.
//  Without an ID this module is a no-op and the site behaves as usual.
// ============================================================

type PixelValue = string | number | boolean | null | undefined;
type PixelParams = Record<string, PixelValue>;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq & { queue?: unknown[]; loaded?: boolean; version?: string; push?: (...args: unknown[]) => void };
    _fbq?: Window['fbq'];
  }
}

const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || '').trim();
let initialized = false;

function allowed() {
  return Boolean(PIXEL_ID && typeof window !== 'undefined' && navigator.doNotTrack !== '1');
}

export function initMetaPixel() {
  if (!allowed() || initialized) return false;
  initialized = true;

  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    }) as Fbq & { callMethod?: Fbq; queue?: unknown[]; loaded?: boolean; version?: string; push?: (...args: unknown[]) => void };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  window.fbq?.('init', PIXEL_ID);
  window.fbq?.('track', 'PageView');
  return true;
}

export function trackMeta(event: string, params?: PixelParams) {
  if (!allowed()) return;
  if (!initialized) initMetaPixel();
  window.fbq?.('track', event, params || {});
}

export {};
