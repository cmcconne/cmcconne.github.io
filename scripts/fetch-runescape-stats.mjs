// Fetches Charlie's Old School RuneScape stats from the public OSRS Hiscores
// and writes them to public/runescape-stats.json. No API key required.
// A failed fetch exits non-zero; the deploy step is continue-on-error, so the
// last committed data stays in place.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PLAYER = 'Stupid Hands';
const OUT = 'public/runescape-stats.json';
const URL =
  'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=' +
  encodeURIComponent(PLAYER);

const res = await fetch(URL);
if (!res.ok) {
  console.error(`OSRS Hiscores fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const data = await res.json();

const byName = Object.fromEntries(data.skills.map((s) => [s.name, s]));
const lvl = (n) => byName[n]?.level ?? 1;

// Standard OSRS combat level formula.
const base = 0.25 * (lvl('Defence') + lvl('Hitpoints') + Math.floor(lvl('Prayer') / 2));
const melee = 0.325 * (lvl('Attack') + lvl('Strength'));
const range = 0.325 * Math.floor(1.5 * lvl('Ranged'));
const mage = 0.325 * Math.floor(1.5 * lvl('Magic'));
const combatLevel = Math.floor(base + Math.max(melee, range, mage));

const overall = byName['Overall'];
const skills = data.skills
  .filter((s) => s.name !== 'Overall')
  .map((s) => ({ name: s.name, level: s.level, xp: s.xp, rank: s.rank }));

const out = {
  username: PLAYER,
  updatedAt: new Date().toISOString(),
  overall: { level: overall.level, xp: overall.xp, rank: overall.rank },
  combatLevel,
  skills,
};

// Enrich with RuneProfile (collection log, recent items/activities, clan).
// Best-effort: any failure just leaves the Hiscores data as-is.
let rpItems = [];
try {
  const rpRes = await fetch(
    `https://api.runeprofile.com/profiles/${encodeURIComponent(PLAYER)}`,
    { headers: { 'User-Agent': 'charlies-showcase (personal site)' } },
  );
  if (!rpRes.ok) throw new Error(`${rpRes.status} ${rpRes.statusText}`);
  const rp = await rpRes.json();

  rpItems = rp.items ?? [];
  const itemNames = Object.fromEntries((rp.items ?? []).map((i) => [i.id, i.name]));
  const questNames = Object.fromEntries((rp.quests ?? []).map((q) => [q.id, q.name]));
  const iso = (d) => d.replace(' ', 'T').slice(0, 23) + 'Z';

  out.clan = rp.clan ? { name: rp.clan.name, title: rp.clan.title } : undefined;
  out.collectionCount = (rp.items ?? []).length;

  const caTiers = rp.combatAchievementTiers ?? [];
  out.combatAchievements = {
    points: rp.totalCombatAchievementPoints ?? 0,
    tierReached: rp.combatAchievementTierReached ?? 0,
    tierReachedName:
      caTiers.find((t) => t.id === rp.combatAchievementTierReached)?.name ?? null,
    tiers: caTiers.map((t) => ({
      name: t.name,
      completed: t.completedCount,
      total: t.tasksCount,
    })),
  };
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

  console.log(
    `RuneProfile: ${out.collectionCount} clog items, ${out.recentItems.length} recent, ${out.recentActivities.length} activities.`,
  );
} catch (err) {
  console.error(`RuneProfile enrich skipped: ${err.message}`);
}

// Fetch the RuneProfile 3D player/pet models (binary PLY) for native rendering.
try {
  mkdirSync('public/models', { recursive: true });
  const mRes = await fetch(
    `https://api.runeprofile.com/profiles/models/${encodeURIComponent(PLAYER.toLowerCase())}?pet=true`,
    { headers: { 'User-Agent': 'charlies-showcase (personal site)' } },
  );
  if (!mRes.ok) throw new Error(`${mRes.status} ${mRes.statusText}`);
  const m = await mRes.json();
  if (m.playerModelBase64) {
    writeFileSync('public/models/osrs-player.ply', Buffer.from(m.playerModelBase64, 'base64'));
    out.hasModel = true;
  }
  if (m.petModelBase64) {
    writeFileSync('public/models/osrs-pet.ply', Buffer.from(m.petModelBase64, 'base64'));
    out.hasPet = true;
  }
  console.log(`Models: player=${!!m.playerModelBase64} pet=${!!m.petModelBase64}`);
} catch (err) {
  console.error(`Model fetch skipped: ${err.message}`);
}

// Build the browsable collection log feed (structure from RuneProfile's
// open-source repo + item names from RuneLite + obtained/KC data above).
// Skipped when RuneProfile items were unavailable, keeping the committed feed.
try {
  if (!rpItems.length) throw new Error('no RuneProfile items this run');
  const structure = JSON.parse(
    readFileSync('scripts/osrs-clog-structure.json', 'utf8'),
  );
  const namesRes = await fetch(
    'https://static.runelite.net/cache/item/names.json',
  );
  if (!namesRes.ok) throw new Error(`names.json ${namesRes.status}`);
  const names = await namesRes.json();

  const owned = new Map(rpItems.map((i) => [i.id, i.quantity ?? 1]));
  const activityScores = Object.fromEntries(
    (data.activities ?? []).map((a) => [a.name, a.score]),
  );

  const tabs = structure.map((t) => ({
    name: t.name,
    pages: t.pages.map((p) => {
      const items = p.items.map((id) => ({
        id,
        name: names[String(id)] ?? `Item ${id}`,
        q: owned.get(id) ?? 0,
      }));
      const kc = Object.entries(p.hiscore ?? {}).map(([act, label]) => ({
        label,
        count: Math.max(0, activityScores[act] ?? 0),
      }));
      return {
        name: p.name,
        aliases: p.aliases ?? [],
        kc,
        obtained: items.filter((i) => i.q > 0).length,
        total: items.length,
        items,
      };
    }),
  }));

  const allIds = new Set(
    structure.flatMap((t) => t.pages.flatMap((p) => p.items)),
  );
  const obtainedCount = [...allIds].filter((id) => owned.has(id)).length;
  writeFileSync(
    'public/osrs-clog.json',
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      obtained: obtainedCount,
      total: allIds.size,
      tabs,
    }) + '\n',
  );
  console.log(
    `Wrote public/osrs-clog.json — ${obtainedCount}/${allIds.size} across ${tabs.reduce((s, t) => s + t.pages.length, 0)} pages.`,
  );
} catch (err) {
  console.error(`Collection log feed skipped: ${err.message}`);
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT} — total ${overall.level}, combat ${combatLevel}, ${skills.length} skills.`,
);
