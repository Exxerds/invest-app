# Start here

Short map of the project and the three things you need to do to put it online.

---

## Run it locally

```bash
npm install
npm run dev
```

- Website: http://localhost:3000
- API: http://localhost:4000

Staff bootstrap accounts are configured with `STAFF_*` variables in
`server/.env` and are intentionally not stored in this repository.
See `server/.env.example` and `server/scripts/update-staff-credentials.js`.

Locally the data lives in `server/data.json` — no database needed.

---

## Going live: three steps

### 1. Database (mandatory)

Vercel has no permanent disk, so without a database every registration is
lost. Create a free Postgres at [neon.tech](https://neon.tech) and copy the
connection string.

### 2. Deploy

Push to GitHub → import into Vercel → add the environment variables.
Full walkthrough: **[DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md)**

### 3. E-mail

Without SMTP a new user never receives the confirmation link and cannot log
in. Full walkthrough: **[EMAIL-SETUP.md](./EMAIL-SETUP.md)**

---

## Environment variables at a glance

| Name | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | **yes** | Postgres connection; without it data is not persisted on Vercel |
| `JWT_SECRET` | **yes** | Signs sessions. The server refuses to start in production without it |
| `NODE_ENV` | **yes** | `production` |
| `SITE_URL` | **yes** | Address used in e-mail links |
| `SMTP_*` | **yes** | Real e-mail delivery — see EMAIL-SETUP.md |
| `CORS_ORIGIN` | no | Only if the API sits on another domain |

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Before you let real people in

- [ ] Change or delete the demo accounts above
- [ ] Remove the demo login buttons in `src/components/modals/LoginModal.tsx`
- [ ] Enable database backups at your provider
- [ ] Check the KYC flow end to end (upload → approve → notification)

---

## What is real and what is still a mock-up

**Works for real, saved in the database:**
registration, login, e-mail confirmation, password reset, password change by
an admin, blocking accounts, KYC upload and review, notifications.

**Still demo data** (lives in `src/data/mockData.ts`, resets on refresh):
client portfolios, leads, trades and PnL, deposit/withdrawal requests,
analytics figures, call history.

**Buttons that intentionally say "not available yet":**
user activity log, push delivery, login-as-client, PDF statement.
The wiring is in place; each needs roughly a day of work.

The full history and roadmap: **[PROJECT_TZ.md](./PROJECT_TZ.md)**

---

## Documentation

| File | About |
|---|---|
| `DEPLOY-VERCEL.md` | Deploying to Vercel step by step |
| `EMAIL-SETUP.md` | When letters are sent and how to configure SMTP |
| `DEPLOY.md` | Alternative: deploying to a normal VPS |
| `PROJECT_TZ.md` | Project memory: everything done, everything planned |
| `README.md` | Stack and troubleshooting |
