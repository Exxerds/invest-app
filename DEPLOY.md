# Deployment guide — TradeNation

How to put the site online so that **registration and login keep working**.

---

## How it works in production

Locally you run two servers: the site on `:3000` and the API on `:4000`.
**In production there is only one.** After `npm run build` the site is compiled
into `dist/`, and the Node server serves both the pages and `/api/...` from the
same address.

That single detail is what makes auth work after deployment:

- the browser calls `/api/auth/login` on the **same domain** → no CORS issues
- no API address is hard-coded anywhere in the front-end
- moving to another domain requires **no code changes**

---

## 1. Requirements

- A VPS (Ubuntu 22.04+) or any host that runs Node.js
- Node.js 20 or newer
- A domain pointed at the server's IP

---

## 2. Upload and build

```bash
git clone <your-repo> /var/www/tradenation
cd /var/www/tradenation

npm install       # installs both root and server dependencies
npm run build     # compiles the site into dist/
```

---

## 3. Configure the environment

```bash
cp server/.env.example server/.env
nano server/.env
```

Minimum for a live site:

```ini
NODE_ENV=production
PORT=4000

# REQUIRED — generate your own:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<paste the generated string>

# Your real address — used for links inside e-mails
SITE_URL=https://yourdomain.com

# Real e-mail delivery (Brevo / Mailgun / SendGrid / SES / Postmark)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=TradeNation <no-reply@yourdomain.com>
```

> The server **refuses to start** in production if `JWT_SECRET` is missing or
> left at the default value — otherwise anyone could forge an admin session.

---

## 4. Run it permanently

Without a process manager the site dies when you close the terminal.

```bash
sudo npm install -g pm2

pm2 start server/src/index.js --name tradenation
pm2 save
pm2 startup          # run the command it prints — survives a reboot
```

Useful:

```bash
pm2 logs tradenation     # live logs
pm2 restart tradenation  # after an update
pm2 status
```

---

## 5. nginx + HTTPS

`/etc/nginx/sites-available/tradenation`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 15M;   # KYC document uploads

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tradenation /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# free HTTPS certificate
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

`proxy_pass` points at `127.0.0.1` on purpose: `localhost` can resolve to IPv6
first and break the connection.

---

## 6. Before letting real users in

- [ ] Remove the demo login buttons in `src/components/modals/LoginModal.tsx`
- [ ] Change the seeded passwords (`admin@trade.io` etc.) or delete those accounts
- [ ] Set up backups of **`server/data.json` AND `server/uploads/`**
      (the uploads folder holds clients' identity documents)
      ```
      0 3 * * * tar czf /backup/tradenation-$(date +\%F).tar.gz \
          /var/www/tradenation/server/data.json /var/www/tradenation/server/uploads
      ```
- [ ] Move from the JSON file to PostgreSQL — a flat file rewrites itself on every
      save and will lose records under concurrent traffic

---

## 7. Updating a live site

```bash
cd /var/www/tradenation
git pull
npm install
npm run build
pm2 restart tradenation
```

---

## Troubleshooting

**Login says the API is unavailable**
`pm2 logs tradenation` — the server is probably not running or crashed on start.

**"Cannot GET /"**
The site was not built. Run `npm run build`, then `pm2 restart tradenation`.

**Confirmation e-mails do not arrive**
Check the SMTP block in `server/.env`. Without it letters are only written to
`server/mails/`. Also verify SPF/DKIM records at your provider, or the mail
will land in spam.

**Refresh on a deep link returns 404**
Make sure nginx proxies everything to Node (the config above) rather than
serving files directly.
