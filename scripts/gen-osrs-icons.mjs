// One-off asset generator: downloads OSRS skill icons from the wiki and saves
// them to public/images/osrs-skills/{skill}.png. Skill list comes from the
// Hiscores so it stays current (e.g. picks up Sailing). Run locally; output is
// committed so CI/runtime never fetches the wiki.

import { mkdirSync, writeFileSync } from 'node:fs';

const PLAYER = 'Stupid Hands';
const OUT_DIR = 'public/images/osrs-skills';
const UA = 'charlies-showcase-asset-fetch (personal site)';
mkdirSync(OUT_DIR, { recursive: true });

const hs = await (
  await fetch(
    'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=' +
      encodeURIComponent(PLAYER),
  )
).json();

const skills = hs.skills.filter((s) => s.name !== 'Overall');

for (const s of skills) {
  const url = `https://oldschool.runescape.wiki/images/${s.name}_icon.png`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    console.error(`skip ${s.name}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`${OUT_DIR}/${s.name.toLowerCase()}.png`, buf);
  console.log(`${s.name} -> ${s.name.toLowerCase()}.png (${buf.length}b)`);
}
