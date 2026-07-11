// Fetches Charlie's Old School RuneScape stats from the public OSRS Hiscores
// and writes them to public/runescape-stats.json. No API key required.
// A failed fetch exits non-zero; the deploy step is continue-on-error, so the
// last committed data stays in place.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

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

// Fetch WikiSync — the OSRS Wiki's own account-keyed RuneLite sync service
// (sync.runescape.wiki, the same source as the wiki's on-page "Look up" button).
// Provides the obtained collection-log item ids and completed combat-achievement
// indices. Best-effort: a failure leaves ws null and the committed feeds in place.
let ws = null;
try {
  const wsRes = await fetch(
    `https://sync.runescape.wiki/runelite/player/${encodeURIComponent(PLAYER)}/STANDARD`,
    {
      headers: {
        'User-Agent': 'charlies-showcase/1.0 (personal fan site)',
        Accept: 'application/json',
      },
    },
  );
  if (!wsRes.ok) throw new Error(`${wsRes.status} ${wsRes.statusText}`);
  ws = await wsRes.json();
  console.log(
    `WikiSync: ${(ws.collection_log ?? []).length} clog items, ${(ws.combat_achievements ?? []).length} combat achievements.`,
  );
} catch (err) {
  console.error(`WikiSync fetch skipped: ${err.message}`);
}

// Latest activities come from RuneProfile — WikiSync has no activity feed, and
// RuneProfile is already used for the character render, so this adds no new
// dependency. Best-effort: a failure just omits the panel.
try {
  const rpRes = await fetch(
    `https://api.runeprofile.com/profiles/${encodeURIComponent(PLAYER)}`,
    { headers: { 'User-Agent': 'charlies-showcase (personal site)' } },
  );
  if (!rpRes.ok) throw new Error(`${rpRes.status} ${rpRes.statusText}`);
  const rp = await rpRes.json();
  const itemNames = Object.fromEntries((rp.items ?? []).map((i) => [i.id, i.name]));
  const questNames = Object.fromEntries((rp.quests ?? []).map((q) => [q.id, q.name]));
  const iso = (d) => d.replace(' ', 'T').slice(0, 23) + 'Z';

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
  console.log(`RuneProfile: ${out.recentActivities.length} activities.`);
} catch (err) {
  console.error(`Activities fetch skipped: ${err.message}`);
}

// Fetch the RuneProfile 3D player/pet models (binary PLY) for native rendering.
// This is the one thing no wiki source provides, so it stays on RuneProfile.
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
// open-source repo + item names from RuneLite + obtained item ids from
// WikiSync + KC from the Hiscores). Skipped when WikiSync was unavailable,
// keeping the committed feed. WikiSync gives obtained ids but not quantities,
// so q is a 0/1 obtained flag.
try {
  if (!ws?.collection_log?.length) throw new Error('no WikiSync collection log this run');
  const structure = JSON.parse(
    readFileSync('scripts/osrs-clog-structure.json', 'utf8'),
  );
  const namesRes = await fetch(
    'https://static.runelite.net/cache/item/names.json',
  );
  if (!namesRes.ok) throw new Error(`names.json ${namesRes.status}`);
  const names = await namesRes.json();

  const owned = new Set(ws.collection_log);
  const activityScores = Object.fromEntries(
    (data.activities ?? []).map((a) => [a.name, a.score]),
  );

  const tabs = structure.map((t) => ({
    name: t.name,
    pages: t.pages.map((p) => {
      const items = p.items.map((id) => ({
        id,
        name: names[String(id)] ?? `Item ${id}`,
        q: owned.has(id) ? 1 : 0,
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
    `Wrote public/osrs-clog.json — ${obtainedCount}/${allIds.size} across ${tabs.reduce((s, t) => s + t.pages.length, 0)} pages (WikiSync).`,
  );
} catch (err) {
  console.error(`Collection log feed skipped: ${err.message}`);
}

// Combat tasks feed: wiki task list (name/desc/tier/type/comp%) grouped by
// monster. Completion comes from WikiSync — the OSRS Wiki's own account-keyed
// service (sync.runescape.wiki, same source as the wiki's "Look up" button).
try {
  if (!ws?.combat_achievements) throw new Error('no WikiSync combat achievements this run');
  const TIER_POINTS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
  const wikiTasks = JSON.parse(readFileSync('scripts/osrs-ca-tasks.json', 'utf8'));
  const idxNames = JSON.parse(readFileSync('scripts/osrs-ca-index.json', 'utf8'));
  const slug = (s) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Hiscores pixel icon for a boss: normalise the name to the hiscores
  // game_icon key (self-hosted under public/images/osrs-hiscores/ by
  // scripts/gen-hiscores-icons.mjs). A few CA groupings need an alias because
  // the hiscores names them differently; ~21 slayer-type monsters have no
  // hiscores icon and fall back to the wiki icon in the component.
  const HS_ALIAS = {
    barrows: 'barrowschests',
    whisperer: 'thewhisperer',
    leviathan: 'theleviathan',
    royaltitans: 'theroyaltitans',
    moonsofperil: 'lunarchests',
    thenightmare: 'nightmare',
    themimic: 'mimic',
    corruptedhunllef: 'thecorruptedgauntlet',
    crystallinehunllef: 'thegauntlet',
    fortiscolosseum: 'colosseumglory',
    theatreofbloodentrymode: 'theatreofblood',
    tombsofamascutentrymode: 'tombsofamascut',
  };
  const hsIcon = (name) => {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = HS_ALIAS[norm] ?? norm;
    return existsSync(`public/images/osrs-hiscores/${key}.png`) ? key : null;
  };

  // Completed combat achievements by task index, from WikiSync (fetched above).
  const done = new Set();
  for (const i of ws.combat_achievements ?? []) {
    const name = idxNames[String(i)];
    if (name) done.add(name);
  }

  const groups = new Map();
  for (const t of wikiTasks) {
    if (!groups.has(t.monster)) groups.set(t.monster, []);
    groups.get(t.monster).push({
      name: t.name,
      tier: t.tier,
      type: t.type,
      description: t.description,
      comp: t.comp,
      done: done.has(t.name),
    });
  }

  const monsters = [...groups.entries()]
    .map(([monster, list]) => {
      const name = monster === 'N/A' ? 'General' : monster;
      return {
        name,
        icon: slug(monster),
        hs: hsIcon(name),
        tasks: list.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)),
        done: list.filter((t) => t.done).length,
        total: list.length,
      };
    })
    .sort((a, b) => b.done - a.done || a.name.localeCompare(b.name));

  const totalDone = wikiTasks.filter((t) => done.has(t.name)).length;
  const points = wikiTasks.reduce(
    (s, t) => s + (done.has(t.name) ? TIER_POINTS[t.tier] ?? 0 : 0),
    0,
  );
  writeFileSync(
    'public/osrs-ca.json',
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      hasCompletion: done.size > 0,
      done: totalDone,
      total: wikiTasks.length,
      points,
      monsters,
    }) + '\n',
  );
  console.log(
    `Wrote public/osrs-ca.json — ${totalDone}/${wikiTasks.length} tasks (${points} pts) across ${monsters.length} monsters (WikiSync).`,
  );
} catch (err) {
  console.error(`Combat tasks feed skipped: ${err.message}`);
}

// Quests + achievement diaries feed (WikiSync, wiki-official). WikiSync gives
// quest names + state (0 = not started, 1 = in progress, 2 = complete) and, per
// diary area, each tier's completion + per-task boolean list.
try {
  if (!ws?.quests || !ws?.achievement_diaries) {
    throw new Error('no WikiSync quests/diaries this run');
  }

  // Miniquest names from the OSRS Wiki (Category:Miniquests), so quests can be
  // split from miniquests. Strip "/Quick guide" subpages and the "(miniquest)"
  // disambiguation; only names that also appear in WikiSync get flagged, which
  // filters out the category's non-quest members. Best-effort → empty on failure.
  const miniSet = new Set();
  try {
    const cmRes = await fetch(
      'https://oldschool.runescape.wiki/api.php?action=query&list=categorymembers&cmtitle=Category:Miniquests&cmlimit=500&cmtype=page&format=json',
      { headers: { 'User-Agent': 'charlies-showcase/1.0 (personal fan site)', Accept: 'application/json' } },
    );
    if (!cmRes.ok) throw new Error(`categorymembers ${cmRes.status}`);
    const cm = await cmRes.json();
    for (const m of cm.query?.categorymembers ?? []) {
      if (m.title.includes('/')) continue;
      miniSet.add(m.title.replace(/\s*\(miniquest\)$/, ''));
    }
  } catch (err) {
    console.error(`Miniquest list skipped: ${err.message}`);
  }

  const allQuests = Object.entries(ws.quests)
    .filter(([name]) => name !== '.')
    .map(([name, state]) => ({ name, state, mini: miniSet.has(name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const quests = allQuests.filter((q) => !q.mini);
  const miniquests = allQuests.filter((q) => q.mini);
  const questsDone = quests.filter((q) => q.state === 2).length;
  const questsStarted = quests.filter((q) => q.state === 1).length;
  const miniDone = miniquests.filter((q) => q.state === 2).length;
  const miniStarted = miniquests.filter((q) => q.state === 1).length;

  const TIER_ORDER = ['Easy', 'Medium', 'Hard', 'Elite'];
  const diaries = Object.entries(ws.achievement_diaries)
    .map(([area, tiers]) => {
      const list = TIER_ORDER.map((tier) => {
        const d = tiers[tier] ?? { complete: false, tasks: [] };
        const tasks = d.tasks ?? [];
        return {
          tier,
          complete: !!d.complete,
          done: tasks.filter(Boolean).length,
          total: tasks.length,
        };
      });
      return { area, tiers: list, complete: list.every((t) => t.complete) };
    })
    .sort((a, b) => a.area.localeCompare(b.area));
  const tiersComplete = diaries.reduce(
    (s, d) => s + d.tiers.filter((t) => t.complete).length,
    0,
  );
  const tiersTotal = diaries.reduce((s, d) => s + d.tiers.length, 0);

  writeFileSync(
    'public/osrs-quests-diaries.json',
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      quests: {
        done: questsDone,
        started: questsStarted,
        total: quests.length,
        list: quests,
        mini: {
          done: miniDone,
          started: miniStarted,
          total: miniquests.length,
          list: miniquests,
        },
      },
      diaries: {
        areasComplete: diaries.filter((d) => d.complete).length,
        areasTotal: diaries.length,
        tiersComplete,
        tiersTotal,
        list: diaries,
      },
    }) + '\n',
  );
  console.log(
    `Wrote public/osrs-quests-diaries.json — quests ${questsDone}/${quests.length}, miniquests ${miniDone}/${miniquests.length}, diary tiers ${tiersComplete}/${tiersTotal} across ${diaries.length} areas (WikiSync).`,
  );
} catch (err) {
  console.error(`Quests/diaries feed skipped: ${err.message}`);
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT} — total ${overall.level}, combat ${combatLevel}, ${skills.length} skills.`,
);
