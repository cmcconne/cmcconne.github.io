// Reads the curated deck list (scripts/mtg-decks-source.json) and enriches each
// deck with commander art + combined colour identity from Scryfall, writing
// public/mtg-decks.json. No API key needed. Best-effort per commander.
//
// Also analyses each deck's card list (live from Moxfield when reachable,
// otherwise the committed snapshot) to surface:
//   - newCards:   cards that debuted in a recent set (non-reprint printings
//                 released within NEW_WINDOW_MONTHS)
//   - spiceCards: rarely-played picks (worst EDHREC ranks in the deck)

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'scripts/mtg-decks-source.json';
const SNAPSHOT = 'scripts/mtg-decklists-snapshot.json';
const OUT = 'public/mtg-decks.json';
const WUBRG = ['W', 'U', 'B', 'R', 'G'];

const NEW_WINDOW_MONTHS = 12;
const NEW_CARDS_MAX = 6;
const SPICE_MAX = 4;
const SPICE_MIN_RANK = 6500; // EDHREC rank must be worse than this to count

const headers = {
  'User-Agent': 'charlies-showcase/1.0 (personal fan site)',
  Accept: 'application/json',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Moxfield deck id from a URL like https://www.moxfield.com/decks/{id}. */
const moxfieldId = (url) => url?.match(/\/decks\/([A-Za-z0-9_-]+)/)?.[1] ?? null;

/** Card names for a deck: live Moxfield if reachable, else the snapshot. */
async function getDecklist(deckId, snapshot) {
  try {
    const res = await fetch(`https://api2.moxfield.com/v3/decks/all/${deckId}`, {
      headers,
    });
    if (res.ok) {
      const d = await res.json();
      const names = Object.values(d.boards?.mainboard?.cards ?? {})
        .map((c) => c.card?.name)
        .filter(Boolean);
      if (names.length) {
        console.log(`  decklist (live): ${names.length} cards`);
        return names;
      }
    }
  } catch {
    /* Moxfield blocks most server-side callers — fall through */
  }
  const names = snapshot[deckId]?.mainboard ?? [];
  if (names.length) console.log(`  decklist (snapshot): ${names.length} cards`);
  return names;
}

/** Batch-resolve card names via Scryfall /cards/collection (75 per request). */
async function scryfallCollection(names) {
  const results = new Map();
  for (let i = 0; i < names.length; i += 75) {
    const identifiers = names
      .slice(i, i + 75)
      .map((n) => ({ name: n.split(' // ')[0] }));
    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    });
    if (res.ok) {
      const data = await res.json();
      for (const c of data.data ?? []) results.set(c.name, c);
    } else {
      console.error(`  scryfall collection miss: ${res.status}`);
    }
    await sleep(150);
  }
  return results;
}

/** Analyse a deck's cards into newCards / spiceCards. */
function analyseCards(cards) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - NEW_WINDOW_MONTHS);

  const chip = (c) => ({
    name: c.name,
    set: c.set_name ?? null,
    date: c.released_at ?? null,
    rank: c.edhrec_rank ?? null,
    art:
      c.image_uris?.art_crop ??
      c.card_faces?.[0]?.image_uris?.art_crop ??
      null,
    uri: c.scryfall_uri ?? null,
  });

  const nonBasic = cards.filter(
    (c) => !(c.type_line ?? '').startsWith('Basic Land'),
  );

  const newCards = nonBasic
    .filter((c) => c.reprint === false && c.released_at && new Date(c.released_at) >= cutoff)
    .sort((a, b) => new Date(b.released_at) - new Date(a.released_at))
    .slice(0, NEW_CARDS_MAX)
    .map(chip);

  const newNames = new Set(newCards.map((c) => c.name));
  const spiceCards = nonBasic
    .filter((c) => (c.edhrec_rank ?? 0) > SPICE_MIN_RANK && !newNames.has(c.name))
    .sort((a, b) => (b.edhrec_rank ?? 0) - (a.edhrec_rank ?? 0))
    .slice(0, SPICE_MAX)
    .map(chip);

  return { newCards, spiceCards };
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));

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

  const deck = {
    name: d.name,
    commanders,
    format: d.format,
    moxfield: d.moxfield || undefined,
    description: d.description || undefined,
    arts,
    colors: WUBRG.filter((c) => colorSet.has(c)),
    scryfallUri,
    newCards: [],
    spiceCards: [],
  };

  // Card-level analysis (new-set cards + low-play-rate spice).
  const deckId = moxfieldId(d.moxfield);
  if (deckId) {
    console.log(`  ${d.name}:`);
    const names = await getDecklist(deckId, snapshot);
    if (names.length) {
      const resolved = await scryfallCollection(names);
      const { newCards, spiceCards } = analyseCards([...resolved.values()]);
      deck.newCards = newCards;
      deck.spiceCards = spiceCards;
      console.log(
        `    new: ${newCards.map((c) => c.name).join(', ') || '—'}`,
      );
      console.log(
        `    spice: ${spiceCards.map((c) => `${c.name} (#${c.rank})`).join(', ') || '—'}`,
      );
    }
  }

  decks.push(deck);
  console.log(`  ${d.name}: [${deck.colors.join('')}]`);
}

const out = { updatedAt: new Date().toISOString(), decks };
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${OUT} — ${decks.length} decks.`);
