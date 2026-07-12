/**
 * Cloudflare Worker — real-time League of Legends live-game proxy.
 *
 * The browser can't call Riot directly (Riot sends no CORS headers, and the
 * API key must stay secret), so this Worker holds the key server-side and
 * exposes one JSON endpoint the showcase site polls for the current game.
 *
 * Configuration:
 *   RIOT_API_KEY  (secret)  Riot production API key.  REQUIRED.
 *                           Set with:  npx wrangler secret put RIOT_API_KEY
 *   ALLOW_ORIGIN  (var)     Allowed CORS origin. Default: https://cmcconne.github.io
 *   GAME_NAME / TAG_LINE / PLATFORM / REGION (vars)  Account + Riot routing.
 *                           Defaults match the site's account; override in
 *                           wrangler.toml [vars] if needed.
 *
 * Response:  { live: LiveGame | null, checkedAt: number }
 *   LiveGame = { queueId, championId, champion, gameLength, startTime }
 */

const DEFAULTS = {
  ALLOW_ORIGIN: 'https://cmcconne.github.io',
  GAME_NAME: 'Naked and Afraid',
  TAG_LINE: 'lost',
  PLATFORM: 'na1', // spectator-v5 / summoner routing
  REGION: 'americas', // account-v1 routing
};

// Per-isolate caches — persist across requests on a warm isolate.
let puuidCache = null; // the account puuid never changes
let champNames = null; // { [numericKey]: displayName }
let liveCache = { at: 0, data: null }; // shields Riot from every visitor poll
const LIVE_TTL_MS = 20000; // serve a shared snapshot for up to 20s

export default {
  async fetch(request, env) {
    const cfg = { ...DEFAULTS };
    for (const k of ['ALLOW_ORIGIN', 'GAME_NAME', 'TAG_LINE', 'PLATFORM', 'REGION']) {
      if (env[k]) cfg[k] = env[k];
    }

    const cors = {
      'Access-Control-Allow-Origin': cfg.ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, cors);

    const key = env.RIOT_API_KEY;
    if (!key) return json({ error: 'proxy not configured' }, 500, cors);

    // Serve a very recent shared result without hitting Riot again.
    if (Date.now() - liveCache.at < LIVE_TTL_MS) {
      return json({ live: liveCache.data, checkedAt: liveCache.at, cached: true }, 200, cors);
    }

    try {
      const puuid = await getPuuid(cfg, key);
      const live = await getLive(cfg, key, puuid);
      liveCache = { at: Date.now(), data: live };
      return json({ live, checkedAt: liveCache.at }, 200, cors);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 502, cors);
    }
  },
};

async function riot(url, key) {
  const r = await fetch(url, { headers: { 'X-Riot-Token': key } });
  if (r.status === 404) return null; // e.g. not currently in a game
  if (!r.ok) throw new Error(`riot ${r.status}`);
  return r.json();
}

async function getPuuid(cfg, key) {
  if (puuidCache) return puuidCache;
  const acct = await riot(
    `https://${cfg.REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
      `${encodeURIComponent(cfg.GAME_NAME)}/${encodeURIComponent(cfg.TAG_LINE)}`,
    key,
  );
  if (!acct || !acct.puuid) throw new Error('account not found');
  puuidCache = acct.puuid;
  return puuidCache;
}

async function getLive(cfg, key, puuid) {
  const g = await riot(
    `https://${cfg.PLATFORM}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`,
    key,
  );
  if (!g) return null; // 404 → not in a game
  const me = (g.participants || []).find((p) => p.puuid === puuid);
  return {
    queueId: g.gameQueueConfigId ?? null,
    championId: (me && me.championId) ?? null,
    champion: await champName(me && me.championId),
    gameLength: g.gameLength ?? 0,
    startTime: g.gameStartTime ?? null,
  };
}

async function champName(id) {
  if (id == null) return null;
  if (!champNames) {
    const vers = await (
      await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
    ).json();
    const cj = await (
      await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${vers[0]}/data/en_US/champion.json`,
      )
    ).json();
    champNames = {};
    for (const c of Object.values(cj.data || {})) champNames[c.key] = c.name;
  }
  return champNames[id] ?? null;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
