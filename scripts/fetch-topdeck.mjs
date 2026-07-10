// Fetches Charlie's TopDeck tournament stats from the public profile stats
// endpoint (no API key needed) and writes public/topdeck-stats.json.
//
// If TOPDECK_API_KEY is set, each event is additionally enriched via the
// authenticated v2 API with the commander(s) played, decklist link, and
// per-event game stats, plus commander art from Scryfall.

import { writeFileSync } from 'node:fs';

const PROFILE_ID = 'jsJThSNXDeSSBY1FDBqOpBEnpZC3';
const OUT = 'public/topdeck-stats.json';
const API_KEY = process.env.TOPDECK_API_KEY;

const headers = {
  'User-Agent': 'charlies-showcase/1.0 (personal site)',
  Accept: 'application/json',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`https://topdeck.gg/profile/${PROFILE_ID}/stats`, {
  headers,
});
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
    id: e.id,
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

// --- Authenticated enrichment (optional) ----------------------------------
if (API_KEY) {
  console.log('TOPDECK_API_KEY set — enriching events with decklist data…');
  for (const e of events) {
    try {
      const r = await fetch(
        `https://topdeck.gg/api/v2/tournaments/${encodeURIComponent(e.id)}/players/${PROFILE_ID}`,
        {
          headers: {
            Authorization: API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': headers['User-Agent'],
          },
        },
      );
      if (r.ok) {
        const p = await r.json();
        const cmds = p.deckObj?.Commanders
          ? Object.keys(p.deckObj.Commanders)
          : [];
        if (cmds.length) e.commanders = cmds;
        if (typeof p.decklist === 'string' && /^https?:/.test(p.decklist)) {
          e.decklistUrl = p.decklist;
        }
        if (typeof p.winRate === 'number') {
          e.winRatePct = Math.round(p.winRate * 1000) / 10;
        }
        if (typeof p.byes === 'number' && p.byes > 0) e.byes = p.byes;
        console.log(
          `  ${e.id}: commanders=[${cmds.join(' + ')}] decklist=${!!e.decklistUrl}`,
        );
      } else {
        console.error(`  enrich miss ${e.id}: ${r.status}`);
      }
    } catch (err) {
      console.error(`  enrich error ${e.id}: ${err.message}`);
    }
    await sleep(700); // stay well under TopDeck rate limits
  }

  // Commander art thumbnails from Scryfall for the expanded rows.
  const names = [...new Set(events.flatMap((e) => e.commanders ?? []))];
  const commanderArts = {};
  for (const name of names) {
    try {
      const r = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
        { headers },
      );
      if (r.ok) {
        const c = await r.json();
        const imgs = c.image_uris ?? c.card_faces?.[0]?.image_uris ?? {};
        if (imgs.art_crop) commanderArts[name] = imgs.art_crop;
      }
    } catch {
      /* best-effort */
    }
    await sleep(120);
  }
  if (Object.keys(commanderArts).length) out.commanderArts = commanderArts;
} else {
  console.log('TOPDECK_API_KEY not set — skipping decklist enrichment.');
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT} — ${events.length} events, ELO ${out.elo}, record ${wins}-${losses}-${draws} (${winRate}% WR).`,
);
