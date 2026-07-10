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

const headers = { 'X-Riot-Token': API_KEY };

async function riot(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} for ${url}\n${body}`);
  }
  return res.json();
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

  const data = {
    riotId: `${account.gameName}#${account.tagLine}`,
    updatedAt: new Date().toISOString(),
    summonerLevel: summoner.summonerLevel,
    profileIconId: summoner.profileIconId,
    ranked,
  };

  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${OUT} — ${ranked.length} ranked queue(s).`);
} catch (err) {
  console.error('Failed to fetch LoL stats:', err.message);
  process.exit(1);
}
