# Mux (video) setup

With `VIDEO_DRIVER=local` (the default) videos are stored on disk and played as MP4. Switch to Mux
for real transcoding, adaptive HLS and signed playback.

## 1. Credentials

1. Create a Mux account and an environment (Development is fine).
2. Settings → Access Tokens → create a token with **Mux Video** read/write. Copy the id and secret
   into `.env` as `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET`.
3. Settings → Signing Keys → create a key for **Video**. Copy the key id into `MUX_SIGNING_KEY` and
   the base64-encoded private key (as downloaded) into `MUX_PRIVATE_KEY`.
4. Set `VIDEO_DRIVER=mux` and restart the API. Assets are created with `test: true` outside
   production (watermarked, auto-deleted after 24h, free).

## 2. Webhooks

Mux needs a public URL. In development expose the API with a tunnel, for example:

```bash
npx cloudflared tunnel --url http://localhost:4400
```

Then Settings → Webhooks → add `https://<tunnel>/api/webhooks/mux` and copy the signing secret
into `MUX_WEBHOOK_SECRET`. Events used: `video.upload.asset_created`, `video.asset.ready`,
`video.asset.errored`, `video.upload.errored`, `video.upload.cancelled`.

Without a tunnel the builder still works: `GET /api/media/assets/:id` polls Mux for the asset state
while it is pending or processing.

## 3. How playback is protected

Playback policies are `signed`, so every HLS and thumbnail URL carries a short-lived JWT minted by
the API only after it has checked that the viewer owns the asset, is staff, or is enrolled in a
course whose lesson is unlocked.
