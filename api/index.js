// ============================================================
//  Vercel serverless entry point.
//
//  Vercel turns every file in /api into a function. This one
//  simply hands the request to the same Express app used
//  locally, so there is a single codebase for both worlds.
//
//  vercel.json routes /api/* here; the built site in /dist is
//  served by Vercel's CDN.
// ============================================================
import app, { ensureSeeded } from '../server/src/index.js';

/**
 * A cold start gets a brand-new instance and, with PostgreSQL, a database that
 * may not have the tables or the demo accounts yet. ensureSeeded() creates the
 * schema and the accounts exactly once per instance.
 *
 * It must never throw: an exception here escapes the function and Vercel
 * answers 502, which is precisely the error the site used to show on sign-in.
 */
export default async function handler(req, res) {
  try {
    await ensureSeeded();
  } catch (err) {
    console.error('[api] Bootstrap failed:', err);
  }

  try {
    return app(req, res);
  } catch (err) {
    console.error('[api] Unhandled error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
}
