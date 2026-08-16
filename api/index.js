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
import app from '../server/src/index.js';
import { seedUsers } from '../server/src/seed.js';

// A cold start gets a brand-new instance, so make sure the demo/admin
// accounts exist. It runs once per instance, not on every request.
let ready = null;
function ensureSeeded() {
  if (!ready) ready = seedUsers().catch(err => console.error('[seed]', err));
  return ready;
}

export default async function handler(req, res) {
  await ensureSeeded();
  return app(req, res);
}
