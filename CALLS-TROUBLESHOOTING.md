# Oak Haven Yield — call troubleshooting

## What a healthy call looks like

1. Open the call diagnostics drawer from the activity icon in the call dock.
2. `connectionState` is `connected` and `iceConnectionState` is `connected` or
   `completed`.
3. `candidates` contains `relay` when the call is using the VPS TURN relay.
4. `bytesSent` and `bytesReceived` both grow while the two participants speak.
5. Keep the call open for at least two minutes and test audio in both directions.

## Server-side checks

The production server uses coturn for networks that cannot connect peer to peer.
The VPS must allow:

- TCP and UDP `3478`;
- TCP `5349` for TURN-over-TLS;
- UDP and TCP relay ports `49152–65535`;
- matching `TURN_USER` and `TURN_PASS` in `server/.env` and
  `/etc/turnserver.conf`.

Useful commands on the VPS:

```bash
sudo systemctl status coturn --no-pager
sudo systemctl status oakhaven --no-pager
sudo journalctl -u coturn --since "10 minutes ago" --no-pager
```

`401 Unauthorized` before a successful `ALLOCATE` is the normal long-term
credential challenge. `ALLOCATE processed, success` and
`CREATE_PERMISSION processed, success` mean that the TURN server accepted the
browser. `peer usage` must show both received and sent traffic for a working
media relay.

## Browser checks

For Chromium browsers, open `edge://webrtc-internals` or
`chrome://webrtc-internals` before placing the call. Inspect the selected
candidate pair and the inbound/outbound audio bytes. The application
Diagnostics drawer is safe to share: it never includes TURN credentials.
