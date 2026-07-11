// One-off: download the Old School Hiscores boss/activity pixel icons and
// self-host them under public/images/osrs-hiscores/. Re-run when Jagex adds
// bosses. Icons are Jagex IP, used for a personal fan page.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'public/images/osrs-hiscores';
mkdirSync(OUT, { recursive: true });

const ua = { 'User-Agent': 'Mozilla/5.0 (charlies-showcase personal fan site)' };
const page =
  'https://secure.runescape.com/m=hiscore_oldschool/a=13/overall?category_type=1&table=0';

const html = await (await fetch(page, { headers: ua })).text();
const names = [
  ...new Set([...html.matchAll(/game_icon_([a-z0-9]+)\.png/gi)].map((m) => m[1])),
].sort();
console.log(`Found ${names.length} hiscores icons.`);

let ok = 0;
for (const n of names) {
  const r = await fetch(`https://www.runescape.com/img/rsp777/game_icon_${n}.png`, {
    headers: ua,
  });
  if (!r.ok) {
    console.error(`  skip ${n}: ${r.status}`);
    continue;
  }
  writeFileSync(`${OUT}/${n}.png`, Buffer.from(await r.arrayBuffer()));
  ok++;
}
console.log(`Downloaded ${ok}/${names.length} → ${OUT}`);
