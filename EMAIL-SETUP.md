# E-mail setup

Everything about the letters the platform sends: when they go out, how to
switch real delivery on, and how to test it.

---

## 1. When does the platform send an e-mail?

There are exactly **two** automatic letters today. Both are part of the login
flow, so without working e-mail new users cannot get in.

### A. "Confirm your email" — after registration

**Trigger:** a visitor fills in the Register form on the landing page.

**What happens:**
1. The account is created with status `pending` — it **cannot log in yet**
2. A letter goes to the address given, with a confirmation button
3. The link looks like `https://yoursite.com/confirm-email?token=…`
4. Clicking it switches the account to `active` and signs the person in
5. **The link is valid for 1 hour** and works only once

If the letter never arrives, the person is stuck at `pending`. That is the
single most important reason to configure SMTP.

### B. "Password reset" — forgotten password

**Trigger:** the visitor clicks *Forgot password?* in the login window.

**What happens:**
1. A letter with a reset button is sent
2. The link is `https://yoursite.com/reset-password?token=…`
3. It opens a form for the new password
4. **Valid for 1 hour**, one use only
5. Afterwards the old password stops working — trying it gives
   *"Invalid email or password"*

> For security the site answers *"If such email is registered — we sent a
> link"* even when the address is unknown. That prevents outsiders from
> discovering which e-mails have accounts.

### What does NOT send an e-mail

| Action | Client is informed how |
|---|---|
| An admin changes the client's password | No letter — tell the client yourself |
| KYC document approved / rejected | In-app notification |
| Account blocked | No letter |
| Deposit / withdrawal request | In-app notification |
| "Happy letter" mass mailing | Prepared in the CRM, not yet wired to SMTP |

If you want any of these to be e-mailed too, say the word — the sending
helper is already there, it only needs to be called.

---

## 2. Without SMTP (development mode)

If `SMTP_HOST` is empty the platform **does not fail** — it just does not
deliver anything:

- the letter is written to `server/mails/*.html` (open it in a browser)
- the link is printed in the terminal:

```
[mail] Letter for john@example.com: "Confirm your email"
[mail] File: server/mails/1786894756-john_example_com.html
[mail] 🔗 http://localhost:3000/confirm-email?token=5624c9d5b6…
```

Copy that link into the browser and the account activates. Perfect for local
work — **never acceptable in production.**

---

## 3. Turning on real delivery

### Which provider?

Do **not** use a personal Gmail/Yandex mailbox: they throttle sending and
your letters will land in spam. Use a transactional service — the free tiers
are more than enough to start.

| Service | Free tier | Notes |
|---|---|---|
| **Brevo** (ex-Sendinblue) | 300 letters/day | Easiest start, recommended |
| **Mailgun** | 100/day | Solid, needs a card |
| **SendGrid** | 100/day | Popular |
| **Amazon SES** | ~$0.10 per 1000 | Cheapest at volume, slower approval |
| **Postmark** | 100/month | Best deliverability |

### Example: Brevo

1. Register at [brevo.com](https://www.brevo.com)
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain**
3. Add the DNS records Brevo shows you (SPF, DKIM) at your registrar —
   **this step decides whether letters land in the inbox or in spam**
4. **SMTP & API → SMTP** — copy the login and the master password

Your values:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your Brevo login>
SMTP_PASS=<SMTP master password>
SMTP_FROM=TradeNation <no-reply@yourdomain.com>
```

> `SMTP_SECURE` is `false` for port 587 and `true` for port 465. Mixing them
> up is the most common cause of a connection timeout.

---

## 4. Where to put the settings

### On Vercel

**Settings → Environment Variables**, add for *Production* and *Preview*:

| Name | Example |
|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `9a1b2c@smtp-brevo.com` |
| `SMTP_PASS` | `xsmtpsib-…` |
| `SMTP_FROM` | `TradeNation <no-reply@yourdomain.com>` |
| `SITE_URL` | `https://yourdomain.com` |

Then **Deployments → … → Redeploy** — variables are only picked up by a new
deployment.

> `SITE_URL` matters: it is the address used inside the letters. Get it wrong
> and clients receive links pointing at the wrong site.

### Locally

```bash
cp server/.env.example server/.env
```

Fill the same values in `server/.env` and restart `npm run dev`.

---

## 5. Checking that it works

1. Open the site and register with a **real** address of yours
2. The letter should arrive within a minute
3. Click the button in it → the account activates and you are signed in
4. Sign out → *Forgot password?* → the second letter arrives
5. Set a new password → sign in with it
6. Try the **old** password → *"Invalid email or password"*

If all six steps pass, e-mail is fully configured.

---

## 6. Troubleshooting

**No letters at all**
`SMTP_HOST` is empty or the deployment was not redeployed after adding the
variables. Check **Deployments → Functions → Logs** — a failure is logged
there.

**Letters go to spam**
SPF and DKIM records are missing at your DNS provider. Add them, then test
the result at [mail-tester.com](https://www.mail-tester.com) — aim for 8+/10.

**Connection timeout**
`SMTP_PORT` and `SMTP_SECURE` disagree: 587 → `false`, 465 → `true`.

**"Invalid login"**
Providers expect the **SMTP key**, not your account password. Copy it from
the SMTP section of the dashboard.

**The link in the letter points at localhost**
`SITE_URL` was not set on the server.

**"Link is invalid or expired"**
The link lives one hour and works once. Request a new one.

**A client never received the confirmation**
Activate the account manually: set its `status` to `active` in the database,
or delete the record so the person can register again.
