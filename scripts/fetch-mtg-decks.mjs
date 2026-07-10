// Reads the curated deck list (scripts/mtg-decks-source.json) and enriches each
// deck with commander art + combined colour identity from Scryfall, writing
// public/mtg-decks.json. No API key needed. Best-effort per commander.

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'scripts/mtg-decks-source.json';
const OUT = 'public/mtg-decks.json';
const WUBRG = ['W', 'U', 'B', 'R', 'G'];

const headers = {
  'User-Agent': 'charlies-showcase/1.0 (personal fan site)',
  Accept: 'application/json',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const source = JSON.parse(readFileSync(SRC, 'utf8'));
const decks = [];

for (const d of source) {
  const commanders = d.commanders ?? (d.commander ? [d.commander] : []);
  const arts = [];
  const colorSet = new Set();
  let scryfallUri = null;

  for (const name of commanders) {
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
        { headers },
      );
      if (res.ok) {
        const c = await res.json();
        const imgs = c.image_uris ?? c.card_faces?.[0]?.image_uris ?? {};
        arts.push(imgs.art_crop ?? null);
        (c.color_identity ?? []).forEach((x) => colorSet.add(x));
        if (!scryfallUri) scryfallUri = c.scryfall_uri ?? null;
      } else {
        console.error(`Scryfall miss for "${name}": ${res.status}`);
        arts.push(null);
      }
    } catch (err) {
      console.error(`Scryfall error for "${name}": ${err.message}`);
      arts.push(null);
    }
    await sleep(120); // be polite to Scryfall's rate limit
  }

  decks.push({
    name: d.name,
    commanders,
    format: d.format,
    moxfield: d.moxfield || undefined,
    description: d.description || undefined,
    arts,
    colors: WUBRG.filter((c) => colorSet.has(c)),
    scryfallUri,
  });
  console.log(`  ${d.name}: [${WUBRG.filter((c) => colorSet.has(c)).join('')}]`);
}

const out = { updatedAt: new Date().toISOString(), decks };
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${OUT} — ${decks.length} decks.`);
