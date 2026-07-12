/**
 * Cloudflare Worker — real-time League of Legends data proxy.
 *
 * The browser can't call Riot directly (Riot sends no CORS headers, and the
 * API key must stay secret), so this Worker holds the key server-side and
 * exposes two JSON endpoints the showcase site polls:
 *
 *   GET  /          → { live: LiveGame | null, checkedAt }
 *   GET  /matches   → { matches: Match[], summary, updatedAt, checkedAt }
 *                     (Ranked Solo/Duo only — same shape as lol-stats.json)
 *
 * Configuration:
 *   RIOT_API_KEY  (secret)  Riot production API key.  REQUIRED.
 *                           Set with:  npx wrangler secret put RIOT_API_KEY
 *   ALLOW_ORIGIN  (var)     Allowed CORS origin. Default: https://cmcconne.github.io
 *   GAME_NAME / TAG_LINE / PLATFORM / REGION (vars)  Account + Riot routing.
 */

const DEFAULTS = {
  ALLOW_ORIGIN: 'https://cmcconne.github.io',
  GAME_NAME: 'Naked and Afraid',
  TAG_LINE: 'lost',
  PLATFORM: 'na1', // spectator-v5 / summoner routing
  REGION: 'americas', // account-v1 / match-v5 routing
  OSRS_PLAYER: 'Stupid Hands', // Old School RuneScape display name
};

const MATCH_COUNT = 20;
const RANKED_SOLO = 420;

// Per-isolate caches — persist across requests on a warm isolate.
let puuidCache = null; // the account puuid never changes
let champNames = null; // { [numericKey]: displayName }
let iconMaps = null; // { runeIcon, styleIcon, spellIcon }
let liveCache = { at: 0, data: null };
let matchCache = { at: 0, data: null };
let osrsCache = { at: 0, data: null };
let womCache = { at: 0, data: null };
const LIVE_TTL_MS = 20000; // shared live-game snapshot
const MATCH_TTL_MS = 180000; // shared match list (3 min — matches change slowly)
const OSRS_TTL_MS = 180000; // shared OSRS stats (3 min — XP changes slowly)
const WOM_TTL_MS = 300000; // shared Wise Old Man gains (5 min)

export default {
  async fetch(request, env) {
    const cfg = { ...DEFAULTS };
    for (const k of ['ALLOW_ORIGIN', 'GAME_NAME', 'TAG_LINE', 'PLATFORM', 'REGION', 'OSRS_PLAYER']) {
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

    const path = new URL(request.url).pathname.replace(/\/+$/, '');

    try {
      // Old School RuneScape stats — no Riot key needed (different game).
      if (path.endsWith('/osrs')) {
        if (Date.now() - osrsCache.at < OSRS_TTL_MS) {
          return json({ ...osrsCache.data, checkedAt: osrsCache.at, cached: true }, 200, cors);
        }
        const data = await getOsrs(cfg);
        osrsCache = { at: Date.now(), data };
        return json({ ...data, checkedAt: osrsCache.at }, 200, cors);
      }

      // Wise Old Man — weekly gains + boss kill counts. No Riot key needed.
      if (path.endsWith('/wom')) {
        if (Date.now() - womCache.at < WOM_TTL_MS) {
          return json({ ...womCache.data, checkedAt: womCache.at, cached: true }, 200, cors);
        }
        const data = await getWom(cfg);
        womCache = { at: Date.now(), data };
        return json({ ...data, checkedAt: womCache.at }, 200, cors);
      }

      // Everything below is League and needs the Riot key.
      const key = env.RIOT_API_KEY;
      if (!key) return json({ error: 'proxy not configured' }, 500, cors);

      if (path.endsWith('/matches')) {
        if (Date.now() - matchCache.at < MATCH_TTL_MS) {
          return json({ ...matchCache.data, checkedAt: matchCache.at, cached: true }, 200, cors);
        }
        const puuid = await getPuuid(cfg, key);
        const data = await getMatches(cfg, key, puuid);
        matchCache = { at: Date.now(), data };
        return json({ ...data, checkedAt: matchCache.at }, 200, cors);
      }

      // Default: live game.
      if (Date.now() - liveCache.at < LIVE_TTL_MS) {
        return json({ live: liveCache.data, checkedAt: liveCache.at, cached: true }, 200, cors);
      }
      const puuid = await getPuuid(cfg, key);
      const live = await getLive(cfg, key, puuid);
      liveCache = { at: Date.now(), data: live };
      return json({ live, checkedAt: liveCache.at }, 200, cors);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 502, cors);
    }
  },
};

// --- Riot helpers -----------------------------------------------------------

async function riot(url, key) {
  const r = await fetch(url, { headers: { 'X-Riot-Token': key } });
  if (r.status === 404) return null; // e.g. not in a game
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
  if (!g) return null;
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

// Community Dragon icon maps — rune keystones, rune trees, summoner spells.
async function getIconMaps() {
  if (iconMaps) return iconMaps;
  const CD =
    'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
  const cdUrl = (p) => `${CD}/${p.replace('/lol-game-data/assets/', '').toLowerCase()}`;
  const runeIcon = {};
  const styleIcon = {};
  const spellIcon = {};
  try {
    const [perks, styles, spells] = await Promise.all([
      fetch(`${CD}/v1/perks.json`).then((r) => r.json()),
      fetch(`${CD}/v1/perkstyles.json`).then((r) => r.json()),
      fetch(`${CD}/v1/summoner-spells.json`).then((r) => r.json()),
    ]);
    for (const p of perks ?? []) runeIcon[p.id] = cdUrl(p.iconPath);
    for (const s of styles.styles ?? []) styleIcon[s.id] = cdUrl(s.iconPath);
    for (const s of spells ?? []) spellIcon[s.id] = cdUrl(s.iconPath);
  } catch {
    /* icons just won't render */
  }
  iconMaps = { runeIcon, styleIcon, spellIcon };
  return iconMaps;
}

// --- Matches (Ranked Solo/Duo) ---------------------------------------------

async function getMatches(cfg, key, puuid) {
  const { runeIcon, styleIcon, spellIcon } = await getIconMaps();

  const matchIds =
    (await riot(
      `https://${cfg.REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids` +
        `?queue=${RANKED_SOLO}&start=0&count=${MATCH_COUNT}`,
      key,
    )) || [];

  const matches = [];
  for (const id of matchIds) {
    try {
      const m = await riot(
        `https://${cfg.REGION}.api.riotgames.com/lol/match/v5/matches/${id}`,
        key,
      );
      if (!m) continue;
      const p = m.info.participants.find((x) => x.puuid === puuid);
      if (!p) continue;

      const durMin = Math.max(1, m.info.gameDuration / 60);
      const ch = p.challenges ?? {};
      const cs = (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
      const remake = m.info.gameDuration < 300 || p.gameEndedInEarlySurrender === true;

      const team = m.info.teams?.find((t) => t.teamId === p.teamId);
      const enemy = m.info.teams?.find((t) => t.teamId !== p.teamId);
      const obj = (t, k) => t?.objectives?.[k]?.kills ?? 0;
      const objCounts = (t) => ({
        dragons: obj(t, 'dragon'),
        barons: obj(t, 'baron'),
        towers: obj(t, 'tower'),
        heralds: obj(t, 'riftHerald'),
        grubs: obj(t, 'horde'),
        inhibs: obj(t, 'inhibitor'),
      });

      const perkStyles = p.perks?.styles ?? [];
      const keystoneId = perkStyles[0]?.selections?.[0]?.perk ?? null;
      const secondaryStyleId = perkStyles[1]?.style ?? null;

      const match = {
        matchId: id,
        champion: p.championName,
        championId: p.championId,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        queueId: m.info.queueId,
        durationSec: m.info.gameDuration,
        endTimestamp:
          m.info.gameEndTimestamp ?? m.info.gameCreation + m.info.gameDuration * 1000,
        position: p.teamPosition || null,
        cs,
        csPerMin: +(cs / durMin).toFixed(1),
        goldPerMin: Math.round((p.goldEarned ?? 0) / durMin),
        damage: p.totalDamageDealtToChampions ?? 0,
        damageShare:
          ch.teamDamagePercentage != null ? Math.round(ch.teamDamagePercentage * 100) : null,
        visionScore: p.visionScore ?? 0,
        visionPerMin: +((p.visionScore ?? 0) / durMin).toFixed(2),
        killParticipation:
          ch.killParticipation != null ? Math.round(ch.killParticipation * 100) : null,
        soloKills: ch.soloKills ?? 0,
        controlWards: ch.controlWardsPlaced ?? p.visionWardsBoughtInGame ?? 0,
        wardsPlaced: p.wardsPlaced ?? 0,
        largestMultiKill: p.largestMultiKill ?? 0,
        firstBlood: !!p.firstBloodKill,
        csLead:
          ch.maxCsAdvantageOnLaneOpponent != null
            ? Math.round(ch.maxCsAdvantageOnLaneOpponent)
            : null,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(
          (x) => x > 0,
        ),
        objectives: { team: objCounts(team), enemy: objCounts(enemy) },
        runes: {
          keystone: keystoneId ? runeIcon[keystoneId] ?? null : null,
          secondary: secondaryStyleId ? styleIcon[secondaryStyleId] ?? null : null,
        },
        spells: [p.summoner1Id, p.summoner2Id].map((sid) => spellIcon[sid] ?? null),
        remake,
      };
      match.insights = buildInsights(match, durMin);
      matches.push(match);
    } catch {
      /* skip a match that fails to load */
    }
  }

  return { matches, summary: buildSummary(matches), updatedAt: new Date().toISOString() };
}

// Rule-based per-game coaching notes (mirrors scripts/fetch-lol-stats.mjs).
function buildInsights(x, durMin) {
  const good = [];
  const bad = [];
  if (x.remake) return { good, bad };

  const isSupport = x.position === 'UTILITY';
  const isJungle = x.position === 'JUNGLE';
  const isLaner = ['TOP', 'MIDDLE', 'BOTTOM'].includes(x.position ?? '');
  const kda = (x.kills + x.assists) / Math.max(1, x.deaths);

  if (x.deaths >= 8) {
    bad.push({ tag: 'deaths', text: `High deaths (${x.deaths}) — prioritise safer positioning and tracking the enemy jungler` });
  } else if (x.deaths <= 2 && durMin >= 20) {
    good.push({ tag: 'discipline', text: `Only ${x.deaths} death${x.deaths === 1 ? '' : 's'} — disciplined play` });
  }
  if (kda >= 4) good.push({ tag: 'kda', text: `Strong KDA (${kda.toFixed(1)})` });

  if (x.killParticipation != null) {
    if (x.killParticipation >= 65) {
      good.push({ tag: 'kp', text: `High kill participation (${x.killParticipation}%)` });
    } else if (x.killParticipation < 35) {
      bad.push({ tag: 'kp', text: `Low kill participation (${x.killParticipation}%) — look to convert your lead into map plays` });
    }
  }

  if (!isSupport && x.position) {
    if (x.csPerMin >= 7.5) {
      good.push({ tag: 'cs', text: `Excellent farming (${x.csPerMin} CS/min)` });
    } else if (x.csPerMin < 5 && !isJungle) {
      bad.push({ tag: 'cs', text: `Low CS (${x.csPerMin}/min) — tighten up last-hitting and wave management` });
    } else if (x.csPerMin < 4.5 && isJungle) {
      bad.push({ tag: 'cs', text: `Low camp efficiency (${x.csPerMin} CS/min) — keep camps on respawn timers` });
    }
  }
  if (x.csLead != null && x.csLead >= 20) {
    good.push({ tag: 'laning', text: `Won lane hard (+${x.csLead} CS on your opponent)` });
  }

  if (isSupport) {
    if (x.visionPerMin >= 1.5) good.push({ tag: 'vision', text: `Great vision control (${x.visionPerMin}/min)` });
    else if (x.visionPerMin < 1) bad.push({ tag: 'vision', text: `Vision score ${x.visionScore} is low for a support — keep wards cycling` });
  } else if (x.position) {
    if (x.visionPerMin >= 1) good.push({ tag: 'vision', text: `Strong vision game (${x.visionPerMin}/min)` });
    else if (x.visionPerMin < 0.4) bad.push({ tag: 'vision', text: `Low vision score (${x.visionScore}) — ward river/objectives on rotations` });
  }
  if (x.controlWards === 0 && durMin >= 20) {
    bad.push({ tag: 'control-wards', text: 'No control wards bought — 75g swings objective fights' });
  }

  if (x.damageShare != null) {
    if (x.damageShare >= 28) {
      good.push({ tag: 'damage', text: `Carried the damage (${x.damageShare}% of team total)` });
    } else if (x.damageShare <= 12 && isLaner) {
      bad.push({ tag: 'damage', text: `Low damage share (${x.damageShare}%) — look for more fight impact or side-lane pressure` });
    }
  }

  if (x.soloKills >= 2) good.push({ tag: 'solo-kills', text: `${x.soloKills} solo kills` });
  if (x.firstBlood) good.push({ tag: 'first-blood', text: 'Drew first blood' });
  if (x.largestMultiKill >= 3) {
    const names = { 3: 'Triple kill', 4: 'QUADRA kill', 5: 'PENTAKILL' };
    good.push({ tag: 'multikill', text: `${names[x.largestMultiKill]}!` });
  }

  return { good: good.slice(0, 4), bad: bad.slice(0, 4) };
}

function buildSummary(matches) {
  const real = matches.filter((m) => !m.remake);
  if (!real.length) return null;
  const avg = (fn, digits = 1) =>
    +(real.reduce((s, m) => s + fn(m), 0) / real.length).toFixed(digits);

  const countTags = (kind) => {
    const counts = {};
    for (const m of real) {
      for (const i of m.insights?.[kind] ?? []) counts[i.tag] = (counts[i.tag] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag, count]) => ({ tag, count }));
  };

  const nonSupport = real.filter((m) => m.position && m.position !== 'UTILITY');
  return {
    games: real.length,
    wins: real.filter((m) => m.win).length,
    avgKda: avg((m) => (m.kills + m.assists) / Math.max(1, m.deaths)),
    avgDeaths: avg((m) => m.deaths),
    avgCsPerMin: nonSupport.length
      ? +(nonSupport.reduce((s, m) => s + m.csPerMin, 0) / nonSupport.length).toFixed(1)
      : null,
    avgKp: avg((m) => m.killParticipation ?? 0, 0),
    avgVisionPerMin: avg((m) => m.visionPerMin, 2),
    strengths: countTags('good'),
    focusAreas: countTags('bad'),
  };
}

// --- Old School RuneScape ---------------------------------------------------
// Live core stats: Hiscores (skills/overall/combat) + RuneProfile recent
// activity. Mirrors scripts/fetch-runescape-stats.mjs. The heavier feeds
// (collection log, combat achievements, quests/diaries, 3D models) change
// rarely and stay on the 6-hourly cron.
async function getOsrs(cfg) {
  const player = cfg.OSRS_PLAYER;

  const hsRes = await fetch(
    `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(player)}`,
  );
  if (!hsRes.ok) throw new Error(`hiscores ${hsRes.status}`);
  const hs = await hsRes.json();

  const byName = Object.fromEntries((hs.skills || []).map((s) => [s.name, s]));
  const lvl = (n) => byName[n]?.level ?? 1;
  const base = 0.25 * (lvl('Defence') + lvl('Hitpoints') + Math.floor(lvl('Prayer') / 2));
  const melee = 0.325 * (lvl('Attack') + lvl('Strength'));
  const range = 0.325 * Math.floor(1.5 * lvl('Ranged'));
  const mage = 0.325 * Math.floor(1.5 * lvl('Magic'));
  const combatLevel = Math.floor(base + Math.max(melee, range, mage));

  const overall = byName['Overall'];
  const out = {
    username: player,
    overall: { level: overall.level, xp: overall.xp, rank: overall.rank },
    combatLevel,
    skills: (hs.skills || [])
      .filter((s) => s.name !== 'Overall')
      .map((s) => ({ name: s.name, level: s.level, xp: s.xp, rank: s.rank })),
    updatedAt: new Date().toISOString(),
  };

  // Recent items + activities from RuneProfile (best-effort).
  try {
    const rp = await (
      await fetch(`https://api.runeprofile.com/profiles/${encodeURIComponent(player)}`, {
        headers: { 'User-Agent': 'charlies-showcase (personal site)' },
      })
    ).json();
    const itemNames = Object.fromEntries((rp.items ?? []).map((i) => [i.id, i.name]));
    const questNames = Object.fromEntries((rp.quests ?? []).map((q) => [q.id, q.name]));
    const iso = (d) => d.replace(' ', 'T').slice(0, 23) + 'Z';

    out.recentItems = (rp.recentItems ?? []).map((r) => ({
      itemId: r.data.itemId,
      name: itemNames[r.data.itemId],
    }));
    out.recentActivities = (rp.recentActivities ?? [])
      .map((a) => {
        const date = iso(a.createdAt);
        if (a.type === 'quest_completed') {
          return { kind: 'quest', date, label: questNames[a.data.questId] ?? 'Quest completed' };
        }
        if (a.type === 'valuable_drop') {
          return { kind: 'drop', date, itemId: a.data.itemId, name: itemNames[a.data.itemId], value: a.data.value };
        }
        if (a.type === 'xp_milestone') {
          return { kind: 'xp', date, skill: a.data.name, xp: a.data.xp };
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    /* activities are optional */
  }

  return out;
}

// --- Wise Old Man (weekly gains + boss KCs) ---------------------------------
// wiseoldman.net tracks OSRS progress over time. Returns this week's XP/kill
// gains and the account's boss kill counts. WOM sends CORS, but proxying here
// keeps it cached and consistent with the other feeds.
async function getWom(cfg) {
  const player = encodeURIComponent(cfg.OSRS_PLAYER);
  const headers = { 'User-Agent': 'charlies-showcase/1.0 (personal fan site)' };
  const gainUrl = (p) =>
    `https://api.wiseoldman.net/v2/players/${player}/gained?period=${p}`;
  const [detRes, wRes, mRes, yRes, recRes] = await Promise.all([
    fetch(`https://api.wiseoldman.net/v2/players/${player}`, { headers }),
    fetch(gainUrl('week'), { headers }),
    fetch(gainUrl('month'), { headers }),
    fetch(gainUrl('year'), { headers }),
    fetch(`https://api.wiseoldman.net/v2/players/${player}/records`, { headers }),
  ]);
  if (!detRes.ok) throw new Error(`wom ${detRes.status}`);
  const det = await detRes.json();

  // Boss kill counts from the latest snapshot (for the KC highlight).
  const bossSnap = det.latestSnapshot?.data?.bosses || {};
  const bossMetrics = new Set(Object.keys(bossSnap));
  const bosses = Object.values(bossSnap)
    .filter((b) => (b.kills ?? 0) > 0)
    .map((b) => ({ metric: b.metric, kills: b.kills, rank: b.rank }))
    .sort((a, b) => b.kills - a.kills);

  // Personal-best kill records per period (day/week/month), boss/raid only.
  const records = { day: {}, week: {}, month: {} };
  try {
    const raw = recRes.ok ? await recRes.json() : [];
    for (const r of Array.isArray(raw) ? raw : []) {
      if (records[r.period] && bossMetrics.has(r.metric)) {
        records[r.period][r.metric] = r.value;
      }
    }
  } catch {
    /* records optional */
  }

  const buildPeriod = (gain) => {
    const g = gain?.data;
    if (!g) return null;
    const skills = Object.values(g.skills || {})
      .filter((s) => s.metric !== 'overall' && (s.experience?.gained ?? 0) > 0)
      .map((s) => ({ metric: s.metric, gained: s.experience.gained, level: s.level?.end ?? null }))
      .sort((a, b) => b.gained - a.gained);
    const pBosses = Object.values(g.bosses || {})
      .filter((b) => (b.kills?.gained ?? 0) > 0)
      .map((b) => ({ metric: b.metric, gained: b.kills.gained }))
      .sort((a, b) => b.gained - a.gained);
    const ehbGained = Object.values(g.bosses || {}).reduce((s, b) => s + (b.ehb?.gained ?? 0), 0);
    return {
      startsAt: gain.startsAt,
      endsAt: gain.endsAt,
      xpGained: g.skills?.overall?.experience?.gained ?? 0,
      ehpGained: +(g.skills?.overall?.ehp?.gained ?? 0).toFixed(1),
      ehbGained: +ehbGained.toFixed(1),
      skills,
      bosses: pBosses,
    };
  };

  const periods = {
    week: buildPeriod(wRes.ok ? await wRes.json() : null),
    month: buildPeriod(mRes.ok ? await mRes.json() : null),
    year: buildPeriod(yRes.ok ? await yRes.json() : null),
  };

  return { updatedAt: det.updatedAt, periods, bosses, records };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
