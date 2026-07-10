// Fetches Charlie's playgroup.gg casual Commander stats via their public API
// (https://playgroup.gg/api-docs). Requires PLAYGROUP_API_KEY (generated in
// account settings). Without the key it exits 0 and leaves the committed
// placeholder in place, so the Playgroup tab simply stays hidden.

import { writeFileSync } from 'node:fs';

const API_KEY = process.env.PLAYGROUP_API_KEY;
const OUT = 'public/playgroup-stats.json';
const BASE = 'https://playgroup.gg/api/public/v1';

if (!API_KEY) {
  console.log('PLAYGROUP_API_KEY not set — keeping the committed placeholder.');
  process.exit(0);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: 'application/json',
  'User-Agent': 'charlies-showcase/1.0 (personal site)',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
}

try {
  // Who am I? (resolves the user id from the key)
  const me = await api('/me');
  console.log(`Authenticated as ${me.username} (id ${me.id}).`);

  // Tracked decks with stats.
  await sleep(200);
  const rawDecks = await api(`/users/${me.id}/decks`);
  const decks = [];
  for (const d of rawDecks) {
    const deck = {
      name: d.name,
      commander: d.commander?.name ?? null,
      partner: d.partner?.name ?? null,
      art: d.commander?.art_crop_url ?? d.cover_image ?? null,
      partnerArt: d.partner?.art_crop_url ?? null,
      colors: d.color_identity ?? [],
      winRate: d.win_rate_percentage ?? null,
      wins: d.games_won ?? 0,
      losses: d.games_lost ?? 0,
      powerLevel: d.power_level ?? null,
      bracket: d.bracket ?? null,
      wincon: d.most_popular_wincon ?? null,
      url: d.url ?? null,
      decklistUrl: d.decklist_url ?? null,
      elo: null,
    };
    // Global deck ELO.
    try {
      await sleep(200);
      const elo = await api(`/decks/${d.id}/elo_history`);
      deck.elo = elo.current_rating ?? null;
    } catch {
      /* best-effort */
    }
    decks.push(deck);
  }
  // Most-played first.
  decks.sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  // Playgroups + recent games.
  await sleep(200);
  const rawGroups = await api(`/users/${me.id}/playgroups`);
  const playgroups = [];
  for (const g of rawGroups) {
    const group = {
      name: g.name,
      gameCount: g.game_count ?? 0,
      memberCount: g.member_count ?? 0,
      recentGames: [],
    };
    try {
      await sleep(200);
      const games = await api(`/playgroups/${g.id}/games?limit=8`);
      group.recentGames = games.map((game) => {
        const winner = (game.participations ?? []).find((p) => p.winner);
        return {
          endedAt: game.ended_at,
          rounds: game.total_rounds ?? null,
          winCon: game.win_con ?? null,
          players: (game.participations ?? []).length,
          winnerName: winner?.user_name ?? null,
          winnerDeck: winner?.deck_name ?? null,
          wonByMe: winner?.user_id === me.id,
          myDeck:
            (game.participations ?? []).find((p) => p.user_id === me.id)
              ?.deck_name ?? null,
        };
      });
    } catch (err) {
      console.error(`  games skipped for "${g.name}": ${err.message}`);
    }
    playgroups.push(group);
  }

  const out = {
    updatedAt: new Date().toISOString(),
    username: me.username,
    profileUrl: `https://playgroup.gg/profiles/${encodeURIComponent(
      (me.username ?? '').toLowerCase(),
    )}`,
    totals: {
      games: me.games_played ?? 0,
      wins: me.games_won ?? 0,
      losses: me.games_lost ?? 0,
      winRate: me.global_winrate ?? 0,
    },
    decks,
    playgroups,
  };

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(
    `Wrote ${OUT} — ${decks.length} decks, ${playgroups.length} playgroup(s), ${out.totals.games} games.`,
  );
} catch (err) {
  console.error(`Playgroup fetch failed: ${err.message}`);
  process.exit(1);
}
