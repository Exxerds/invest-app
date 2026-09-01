// ============================================================
//  Meta (Facebook) Pixel — installed once, fired on key events.
//
//  The Pixel ID is read from the build-time env var
//  `VITE_META_PIXEL_ID`. If it is empty the snippet is not loaded
//  at all, so every developer / preview environment runs clean.
//
//  Set it (e.g. in `.env.local` or the Vercel dashboard):
//    VITE_META_PIXEL_ID=1234567890123456
//
//  Events fired:
//    PageView              every page load
//    Lead                  lead form submitted on the landing page
//    CompleteRegistration  a new client account is created
// ============================================================

const PIXEL_ID: string = (import.meta.env.VITE_META_PIXEL_ID as string | undefined) || '';

let loaded = false;

/** True when a Pixel ID is configured and the script is (or can be) active. */
export function metaPixelEnabled(): boolean {
  return typeof window !== 'undefined' && !!PIXEL_ID;
}

/**
 * Load the Meta Pixel base snippet and fire a PageView.
 * Safe to call more than once — it only runs the first time.
 */
export function initMetaPixel(): void {
  if (typeof window === 'undefined' || loaded) return;
  if (!PIXEL_ID) return;

  loaded = true;

  /* eslint-disable */
  // Standard Meta queued loader — establishes window.fbq before the real
  // script arrives, so early events are queued and replayed by fbevents.js.
  (function (
    f: any, b: any, e: any, v: any, n: any, t: any, s: any,
  ) {
    if (f.fbq) return;
    n = f.fbq = function () {
      // eslint-disable-next-line prefer-rest-params
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(
    window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js',
    undefined, undefined, undefined,
  );
  /* eslint-enable */

  (window as any).fbq?.('init', PIXEL_ID);
  (window as any).fbq?.('track', 'PageView');
}

/**
 * Fire a Meta Pixel conversion event.
 * Example: trackMetaPixel('Lead', { content_name: 'Silver' });
 * Always a no-op when Pixel is not configured.
 */
export function trackMetaPixel(
  event: string,
  data: Record<string, unknown> = {},
): void {
  if (!metaPixelEnabled()) return;
  initMetaPixel();
  (window as any).fbq?.('track', event, data);
}

export default { initMetaPixel, trackMetaPixel, metaPixelEnabled };
