// Fetches Charlie's TopDeck tournament stats from the public profile stats
// endpoint (no API key needed) and writes public/topdeck-stats.json.

import { writeFileSync } from 'node:fs';

const PROFILE_ID = 'jsJThSNXDeSSBY1FDBqOpBEnpZC3';
const OUT = 'public/topdeck-stats.json';
const headers = {
  'User-Agent': 'charlies-showcase/1.0 (personal site)',
  Accept: 'application/json',
};

const res = await fetch(
  `https://topdeck.gg/profile/${PROFILE_ID}/stats`,
  { headers },
);
if (!res.ok) {
  console.error(`TopDeck fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const d = await res.json();

// Sum the career record across all years.
let wins = 0, losses = 0, draws = 0, tournaments = 0;
for (const year of Object.values(d.yearlyStats ?? {})) {
  const o = year.overall;
  if (!o) continue;
  wins += o.wins || 0;
  losses += o.losses || 0;
  draws += o.draws || 0;
  tournaments += o.totalTournaments || 0;
}
const games = wins + losses + draws;
const winRate = games ? Math.round((wins / games) * 1000) / 10 : 0;

const elo = d.elos?.[0] ?? null;

const events = Object.values(d.gameFormats ?? {})
  .flat()
  .map((e) => ({
    name: (e.name || '').trim(),
    date: e.date,
    record: e.record,
    placement: e.placement,
    placementNumber: e.placementNumber,
    size: e.size,
    bracketLink: e.bracketLink,
    topCut: e.topCut,
  }))
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

const out = {
  updatedAt: new Date().toISOString(),
  profileUrl: `https://topdeck.gg/profile/${PROFILE_ID}`,
  elo: elo?.elo ?? null,
  eloGames: elo?.gamesPlayed ?? null,
  tdcsPoints: d.tdcsData?.points ?? null,
  totals: { tournaments, wins, losses, draws, winRate },
  events,
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT} — ${events.length} events, ELO ${out.elo}, record ${wins}-${losses}-${draws} (${winRate}% WR).`,
);
