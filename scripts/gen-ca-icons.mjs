// One-off asset generator for the combat-tasks interface. Downloads:
//   - the 6 tier icons from the OSRS wiki
//   - a monster icon per distinct combat-achievement monster (wiki pageimage)
// into public/images/osrs-ca/ (tiers) and public/images/osrs-monsters/.
// Run locally; output is committed so CI/runtime never fetches the wiki.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const UA = 'charlies-showcase/1.0 (personal fan site; contact github.com/cmcconne)';
const WIKI = 'https://oldschool.runescape.wiki';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

mkdirSync('public/images/osrs-ca', { recursive: true });
mkdirSync('public/images/osrs-monsters', { recursive: true });

// --- Tier icons -------------------------------------------------------------
const tiers = ['easy', 'medium', 'hard', 'elite', 'master', 'grandmaster'];
for (const t of tiers) {
  const url = `${WIKI}/images/Combat_Achievements_-_${t}_tier_icon.png`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.ok) {
    writeFileSync(
      `public/images/osrs-ca/tier-${t}.png`,
      Buffer.from(await res.arrayBuffer()),
    );
    console.log(`tier ${t} ok`);
  } else {
    console.error(`tier ${t} FAILED ${res.status}`);
  }
  await sleep(120);
}

// --- Monster icons ----------------------------------------------------------
const tasks = JSON.parse(readFileSync('scripts/osrs-ca-tasks.json', 'utf8'));
const monsters = [...new Set(tasks.map((t) => t.monster))];
console.log(`\n${monsters.length} distinct monsters`);

// Resolve pageimage thumbnails in batches.
const thumbs = {};
for (let i = 0; i < monsters.length; i += 40) {
  const batch = monsters.slice(i, i + 40);
  const url =
    `${WIKI}/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail` +
    `&pithumbsize=64&pilimit=50&redirects=1&titles=${batch.map(encodeURIComponent).join('|')}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const data = await res.json();
  // Map any redirect normalisations back to the requested title.
  const redirect = {};
  for (const r of data.query?.redirects ?? []) redirect[r.to] = r.from;
  for (const p of Object.values(data.query?.pages ?? {})) {
    const requested = redirect[p.title] ?? p.title;
    if (p.thumbnail?.source) thumbs[requested] = p.thumbnail.source;
  }
  await sleep(200);
}

let ok = 0;
const missing = [];
for (const m of monsters) {
  const src = thumbs[m];
  if (!src) {
    missing.push(m);
    continue;
  }
  try {
    const res = await fetch(src, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(res.status);
    writeFileSync(
      `public/images/osrs-monsters/${slug(m)}.png`,
      Buffer.from(await res.arrayBuffer()),
    );
    ok++;
  } catch (err) {
    missing.push(m);
    console.error(`  ${m}: ${err.message}`);
  }
  await sleep(80);
}
console.log(`\nmonster icons: ${ok}/${monsters.length} downloaded`);
if (missing.length) console.log('missing:', missing.join(', '));
