// Fetches Charlie's League of Legends stats from Riot's API and writes them to
// public/lol-stats.json. Run in CI with RIOT_API_KEY in the environment.
//
// If RIOT_API_KEY is missing, the script exits 0 without touching the file, so
// the committed placeholder stays in place (local builds, no-key deploys).

import { writeFileSync } from 'node:fs';

const API_KEY = process.env.RIOT_API_KEY;

// --- Account config -------------------------------------------------------
const GAME_NAME = 'Naked and Afraid';
const TAG_LINE = 'lost';
const PLATFORM = 'na1'; // summoner-v4 / league-v4 routing
const REGION = 'americas'; // account-v1 routing for NA
const OUT = 'public/lol-stats.json';
// -------------------------------------------------------------------------

if (!API_KEY) {
  console.log('RIOT_API_KEY not set — keeping the committed placeholder.');
  process.exit(0);
}

const MATCH_COUNT = 20;

const headers = { 'X-Riot-Token': API_KEY };

async function riot(url, retries = 2) {
  const res = await fetch(url, { headers });
  // Respect Riot's rate limits — back off and retry on 429.
  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get('retry-after') ?? 2);
    console.log(`  rate limited, waiting ${wait + 1}s…`);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    return riot(url, retries - 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} for ${url}\n${body}`);
  }
  return res.json();
}

/**
 * Rule-based per-game coaching notes. Each entry is { tag, text }; tags are
 * stable keys so recurring themes can be counted across games.
 */
function buildInsights(x, durMin) {
  const good = [];
  const bad = [];
  if (x.remake) return { good, bad };

  const isSupport = x.position === 'UTILITY';
  const isJungle = x.position === 'JUNGLE';
  const isLaner = ['TOP', 'MIDDLE', 'BOTTOM'].includes(x.position ?? '');
  const kda = (x.kills + x.assists) / Math.max(1, x.deaths);

  // Deaths / KDA
  if (x.deaths >= 8) {
    bad.push({ tag: 'deaths', text: `High deaths (${x.deaths}) — prioritise safer positioning and tracking the enemy jungler` });
  } else if (x.deaths <= 2 && durMin >= 20) {
    good.push({ tag: 'discipline', text: `Only ${x.deaths} death${x.deaths === 1 ? '' : 's'} — disciplined play` });
  }
  if (kda >= 4) {
    good.push({ tag: 'kda', text: `Strong KDA (${kda.toFixed(1)})` });
  }

  // Kill participation
  if (x.killParticipation != null) {
    if (x.killParticipation >= 65) {
      good.push({ tag: 'kp', text: `High kill participation (${x.killParticipation}%)` });
    } else if (x.killParticipation < 35) {
      bad.push({ tag: 'kp', text: `Low kill participation (${x.killParticipation}%) — look to convert your lead into map plays` });
    }
  }

  // CS (not meaningful for support)
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

  // Vision
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

  // Damage
  if (x.damageShare != null) {
    if (x.damageShare >= 28) {
      good.push({ tag: 'damage', text: `Carried the damage (${x.damageShare}% of team total)` });
    } else if (x.damageShare <= 12 && isLaner) {
      bad.push({ tag: 'damage', text: `Low damage share (${x.damageShare}%) — look for more fight impact or side-lane pressure` });
    }
  }

  // Highlights
  if (x.soloKills >= 2) good.push({ tag: 'solo-kills', text: `${x.soloKills} solo kills` });
  if (x.firstBlood) good.push({ tag: 'first-blood', text: 'Drew first blood' });
  if (x.largestMultiKill >= 3) {
    const names = { 3: 'Triple kill', 4: 'QUADRA kill', 5: 'PENTAKILL' };
    good.push({ tag: 'multikill', text: `${names[x.largestMultiKill]}!` });
  }

  return { good: good.slice(0, 4), bad: bad.slice(0, 4) };
}

/** Aggregate the last N games into averages + recurring themes. */
function buildSummary(matches) {
  const real = matches.filter((m) => !m.remake);
  if (!real.length) return null;
  const avg = (fn, digits = 1) =>
    +(real.reduce((s, m) => s + fn(m), 0) / real.length).toFixed(digits);

  const countTags = (kind) => {
    const counts = {};
    for (const m of real) {
      for (const i of m.insights?.[kind] ?? []) {
        counts[i.tag] = (counts[i.tag] ?? 0) + 1;
      }
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

try {
  const account = await riot(
    `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
      `${encodeURIComponent(GAME_NAME)}/${encodeURIComponent(TAG_LINE)}`,
  );
  const puuid = account.puuid;

  const summoner = await riot(
    `https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
  );

  const entries = await riot(
    `https://${PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
  );

  const ranked = entries.map((e) => {
    const games = e.wins + e.losses;
    return {
      queue: e.queueType,
      tier: e.tier,
      rank: e.rank,
      leaguePoints: e.leaguePoints,
      wins: e.wins,
      losses: e.losses,
      winRate: games ? Math.round((e.wins / games) * 100) : 0,
    };
  });

  // Latest Data Dragon version, for item icons on the site.
  let ddragonVersion = null;
  try {
    const vers = await (
      await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
    ).json();
    ddragonVersion = vers[0] ?? null;
  } catch {
    /* icons just won't render */
  }

  // Champion id -> name/title/tags, from Data Dragon (labels mastery + pool).
  const champById = {};
  try {
    if (ddragonVersion) {
      const cj = await (
        await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`,
        )
      ).json();
      for (const c of Object.values(cj.data ?? {})) {
        champById[c.key] = { name: c.name, title: c.title, tags: c.tags ?? [] };
      }
    }
  } catch {
    /* names fall back to champion ids */
  }

  // Champion mastery — top champions by mastery points (champion-mastery-v4).
  let championMastery = [];
  try {
    const mast = await riot(
      `https://${PLATFORM}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=12`,
    );
    championMastery = mast.map((x) => ({
      championId: x.championId,
      name: champById[x.championId]?.name ?? null,
      level: x.championLevel,
      points: x.championPoints,
      chest: !!x.chestGranted,
      tokens: x.tokensEarned ?? 0,
      lastPlay: x.lastPlayTime ?? null,
    }));
  } catch (err) {
    console.error(`  champion mastery skipped: ${err.message}`);
  }

  // Recent matches (match-v5 uses regional routing, same as account-v1).
  const matchIds = await riot(
    `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids` +
      `?start=0&count=${MATCH_COUNT}`,
  );

  const matches = [];
  for (const id of matchIds) {
    try {
      const m = await riot(
        `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${id}`,
      );
      const p = m.info.participants.find((x) => x.puuid === puuid);
      if (!p) continue;

      const durMin = Math.max(1, m.info.gameDuration / 60);
      const ch = p.challenges ?? {};
      const cs = (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
      const remake =
        m.info.gameDuration < 300 || p.gameEndedInEarlySurrender === true;

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
          m.info.gameEndTimestamp ??
          m.info.gameCreation + m.info.gameDuration * 1000,
        // --- deeper stats -------------------------------------------------
        position: p.teamPosition || null,
        cs,
        csPerMin: +(cs / durMin).toFixed(1),
        goldPerMin: Math.round((p.goldEarned ?? 0) / durMin),
        damage: p.totalDamageDealtToChampions ?? 0,
        damageShare:
          ch.teamDamagePercentage != null
            ? Math.round(ch.teamDamagePercentage * 100)
            : null,
        visionScore: p.visionScore ?? 0,
        visionPerMin: +((p.visionScore ?? 0) / durMin).toFixed(2),
        killParticipation:
          ch.killParticipation != null
            ? Math.round(ch.killParticipation * 100)
            : null,
        soloKills: ch.soloKills ?? 0,
        controlWards: ch.controlWardsPlaced ?? p.visionWardsBoughtInGame ?? 0,
        wardsPlaced: p.wardsPlaced ?? 0,
        largestMultiKill: p.largestMultiKill ?? 0,
        firstBlood: !!p.firstBloodKill,
        csLead:
          ch.maxCsAdvantageOnLaneOpponent != null
            ? Math.round(ch.maxCsAdvantageOnLaneOpponent)
            : null,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
          .filter((x) => x > 0),
        remake,
      };
      match.insights = buildInsights(match, durMin);
      matches.push(match);
    } catch (err) {
      console.error(`  skipped match ${id}: ${err.message}`);
    }
  }

  const summary = buildSummary(matches);

  const data = {
    riotId: `${account.gameName}#${account.tagLine}`,
    updatedAt: new Date().toISOString(),
    summonerLevel: summoner.summonerLevel,
    profileIconId: summoner.profileIconId,
    ddragonVersion,
    ranked,
    championMastery,
    matches,
    summary,
  };

  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(
    `Wrote ${OUT} — ${ranked.length} ranked queue(s), ${championMastery.length} mastery, ${matches.length} match(es).`,
  );
} catch (err) {
  console.error('Failed to fetch LoL stats:', err.message);
  process.exit(1);
}
