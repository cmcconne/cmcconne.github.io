// Fetches Charlie's Old School RuneScape stats from the public OSRS Hiscores
// and writes them to public/runescape-stats.json. No API key required.
// A failed fetch exits non-zero; the deploy step is continue-on-error, so the
// last committed data stays in place.

import { writeFileSync } from 'node:fs';

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

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT} — total ${overall.level}, combat ${combatLevel}, ${skills.length} skills.`,
);
