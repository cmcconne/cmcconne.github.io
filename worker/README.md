# League live-game proxy (Cloudflare Worker)

Real-time data for the League section. The browser polls this Worker; it holds
the Riot key and calls Riot's APIs. Two endpoints:

- `GET /` — current live game (polled every 30 s). `{ live, checkedAt }`
- `GET /matches` — recent **Ranked Solo/Duo** games + summary (polled every
  2 min, Worker-cached 3 min). Same shape as `lol-stats.json`, so the page
  overlays it on the 6-hourly snapshot to keep recent games fresh.
- `GET /osrs` — Old School RuneScape core stats: Hiscores (skills / overall /
  combat) + RuneProfile recent activity (polled every 2 min, cached 3 min). No
  Riot key needed. The RuneScape page overlays it on its 6-hourly snapshot.
  (The heavy collection-log / combat-achievement / quest-diary / 3D-model feeds
  change rarely and stay on the cron.)

Browsers can't call Riot directly — Riot sends no CORS headers and the key must
stay secret — so this small proxy is required for genuine real-time data.

> After editing `live-game.js` it redeploys automatically: the GitHub Actions
> workflow (`.github/workflows/deploy.yml`, job `deploy-worker`) runs
> `wrangler deploy` whenever `worker/**` changes on a push (or on a manual run).
> You can still deploy by hand with `npx wrangler deploy`. Either way the site
> tolerates an old Worker — `/matches` just returns no data and it falls back
> to the snapshot.

### CI secrets for auto-deploy

Add these repo secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — create at Cloudflare dashboard → My Profile → API
  Tokens → Create Token → **"Edit Cloudflare Workers"** template.
- `CLOUDFLARE_ACCOUNT_ID` — your account id (Cloudflare dashboard → Workers &
  Pages, shown in the right sidebar / the dashboard URL).

`wrangler deploy` does **not** touch the Worker's `RIOT_API_KEY` secret, so the
key stays only in Cloudflare — it never needs to be a GitHub secret. Without the
Cloudflare token the `deploy-worker` job simply skips (it won't fail the run).

## One-time deploy

You need a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free) and a
**Riot production API key** (a personal/dev key expires every 24 h and the
tracker would go dark daily). Get a production key at
<https://developer.riotgames.com/app-type> by registering this site as an app.

```bash
cd worker
npx wrangler login                 # opens the browser to authorize (one time)
npx wrangler secret put RIOT_API_KEY   # paste the production key when prompted
npx wrangler deploy
```

`wrangler deploy` prints the URL, e.g. `https://lol-live.<your-subdomain>.workers.dev`.

## Connect it to the site

Put that URL in the League section config, then commit + push:

```
src/app/data/sections.ts  →  the 'league-of-legends' entry  →  liveApi: 'https://lol-live.<your-subdomain>.workers.dev'
```

Leave `liveApi` empty to disable real-time polling (the site falls back to the
6-hourly snapshot, freshness-gated so it can't show a stale game as live).

## Notes

- The Worker caches each Riot lookup for ~20 s and shares it across all
  visitors, so many pollers cost Riot at most ~3 calls/minute.
- `ALLOW_ORIGIN` defaults to `https://cmcconne.github.io`. For local testing
  (`http://localhost:4200`) either add a `[vars]` override in `wrangler.toml`
  or run `npx wrangler dev` and point `liveApi` at the dev URL.
- Rotate or revoke the key anytime with `npx wrangler secret put RIOT_API_KEY`.
