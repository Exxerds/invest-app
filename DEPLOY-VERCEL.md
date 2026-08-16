# Deploying to Vercel

Everything — the website, the API, login, registration, password changes and
KYC uploads — runs from a single Vercel project.

**Total time: about 15 minutes.**

---

## Why a database is mandatory here

Vercel is *serverless*: there is no machine that stays alive between requests
and no disk you can write to. A JSON file would be wiped constantly, so every
sign-up would vanish moments after it happened.

The code already handles both worlds:

| | Local (`npm run dev`) | Vercel |
|---|---|---|
| Storage | `server/data.json` | PostgreSQL |
| KYC scans | files in `server/uploads/` | stored inside the database |
| Switch | — | set `DATABASE_URL` |

You do not change any code — only environment variables.

---

## Step 1 — create a free database

Any managed Postgres works. **Neon** has a generous free tier:

1. Sign up at [neon.tech](https://neon.tech) → **Create project**
2. Copy the connection string, it looks like:

```
postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

> Vercel Postgres, Supabase or Railway work exactly the same way —
> the only thing that matters is the connection string.

Tables are created automatically the first time the API runs. No migrations
to execute by hand.

---

## Step 2 — push the project to GitHub

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

---

## Step 3 — import into Vercel

1. [vercel.com/new](https://vercel.com/new) → pick the repository
2. Framework preset: **Other** (`vercel.json` already describes the build)
3. Do **not** press Deploy yet — add the variables first

---

## Step 4 — environment variables

**Settings → Environment Variables**, for Production *and* Preview:

| Name | Value |
|---|---|
| `DATABASE_URL` | the connection string from step 1 |
| `JWT_SECRET` | generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `SITE_URL` | `https://your-project.vercel.app` (or your domain) |

E-mail delivery (registration + password reset). Without it letters are only
logged, so **new users cannot confirm their address**:

| Name | Value |
|---|---|
| `SMTP_HOST` | e.g. `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` for port 587, `true` for 465 |
| `SMTP_USER` | provider login |
| `SMTP_PASS` | provider password |
| `SMTP_FROM` | `TradeNation <no-reply@yourdomain.com>` |

Now press **Deploy**.

---

## Step 5 — check it works

Open the deployed URL and verify:

- [ ] the landing page loads with live quotes
- [ ] **Register** creates an account (a letter is sent)
- [ ] **Log in** with `admin@trade.io` / `admin123`
- [ ] the CRM lists users — proof the database is connected
- [ ] change a client's password, then confirm the old one is rejected
- [ ] upload a KYC document in the client cabinet and approve it in the CRM
- [ ] **reload the page** — everything is still there

`https://<your-app>/api/health` should answer `{"ok":true}`.

---

## Step 6 — secure it before real traffic

- [ ] Change the seeded passwords or delete those accounts:
      `admin@trade.io`, `manager@trade.io`, `client@trade.io`
- [ ] Remove the demo login buttons in `src/components/modals/LoginModal.tsx`
- [ ] Turn on backups in your database provider (Neon keeps history automatically)
- [ ] Add your custom domain in **Settings → Domains** (HTTPS is automatic)

---

## Custom domain

**Settings → Domains → Add**, then point your registrar at Vercel.
Afterwards update `SITE_URL` to the new address so e-mail links stay correct.

---

## Troubleshooting

**Login says the server is unavailable**
`DATABASE_URL` is missing or wrong. Check **Deployments → Functions → Logs**.

**Everything works, but users disappear**
The variable was added only to Preview, not Production — or `DATABASE_URL`
is absent, so the API fell back to the temporary file.

**Confirmation e-mails never arrive**
SMTP is not configured. Until then you can activate an account manually:
set its `status` to `active` in the database.

**`FUNCTION_INVOCATION_TIMEOUT`**
The database is asleep (free tiers pause after inactivity). The next request
wakes it. `vercel.json` already allows up to 30 seconds.

**KYC upload returns 413**
The file is over 8 MB. Ask the client for a smaller scan.

---

## Local development is unchanged

```bash
npm run dev     # site :3000, API :4000, JSON storage
```

To test against the real database locally:

```bash
DATABASE_URL="postgresql://..." npm run dev:api
```
