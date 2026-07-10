// One-off asset generator: downloads each ranked-tier emblem from Community
// Dragon, trims the transparent padding, and writes the tight versions to
// public/images/ranks/. Run locally after `npm i sharp --no-save`; the output
// PNGs are committed so CI/runtime never needs sharp.

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const TIERS = [
  'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald',
  'diamond', 'master', 'grandmaster', 'challenger',
];
const OUT_DIR = 'public/images/ranks';
mkdirSync(OUT_DIR, { recursive: true });

for (const tier of TIERS) {
  const url =
    'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/' +
    `global/default/images/ranked-emblem/emblem-${tier}.png`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`skip ${tier}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // Trim transparent padding, then downscale to ~2x display size to keep files small.
  const out = await sharp(buf)
    .trim({ threshold: 10 })
    .resize({ height: 224, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const meta = await sharp(out).metadata();
  writeFileSync(`${OUT_DIR}/${tier}.png`, out);
  console.log(`${tier}: ${meta.width}x${meta.height}`);
}
