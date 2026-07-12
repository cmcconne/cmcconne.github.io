# League live-game proxy (Cloudflare Worker)

Real-time "Live now" tracker for the League section. The browser polls this
Worker every 30 s; the Worker holds the Riot key and calls Riot's spectator API.

Browsers can't call Riot directly — Riot sends no CORS headers and the key must
stay secret — so this small proxy is required for genuine real-time data.

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
