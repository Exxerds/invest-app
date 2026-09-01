# Meta Pixel

The site has an optional Meta Pixel integration. It is disabled when no ID is
provided, so it does not change the site until configured.

## 1. Get the Pixel ID

In Meta Events Manager create/select a Web Pixel and copy its numeric Pixel ID.
Do not put the ID in source code or send access tokens to anyone.

## 2. Configure the build

On the VPS, create or edit `/opt/oakhaven/.env` and add:

```env
VITE_META_PIXEL_ID=YOUR_NUMERIC_PIXEL_ID
```

This is a **frontend build variable**. It belongs in `/opt/oakhaven/.env`, not
in `server/.env`. Keep the value private from Git and screenshots.

## 3. Build and restart

```bash
cd /opt/oakhaven
sudo -u oakhaven npm run build
sudo systemctl restart oakhaven
```

## Events sent

- `PageView` — first page load;
- `ViewContent` — visitor selects an account tier;
- `Lead` — contact form is successfully submitted;
- `CompleteRegistration` — registration succeeds;
- `Purchase` — a real client investment is saved by the server.

The integration does not send passwords, JWTs, account balances or the full
form contents. If the Pixel ID is empty, all tracking calls are no-ops.
