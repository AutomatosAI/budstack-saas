// Convert full-page retina shots into guide-ready embeds:
// 1400px-wide JPEGs (quality 78) in embeds/ — small enough that a
// multi-screenshot guide page stays well under artifact size limits.
//   node scripts/docs-shots/prep-embeds.mjs
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "shots");
const out = join(here, "embeds");
mkdirSync(out, { recursive: true });

let total = 0;
for (const f of readdirSync(src).filter((f) => f.endsWith(".png"))) {
  const dest = join(out, f.replace(/\.png$/, ".jpg"));
  await sharp(join(src, f)).resize({ width: 1400 }).jpeg({ quality: 78 }).toFile(dest);
  const kb = Math.round(statSync(dest).size / 1024);
  total += kb;
  console.log(`  ${f.replace(".png", ".jpg").padEnd(30)} ${kb} KB`);
}
console.log(`\nTotal embeds: ${Math.round(total / 1024 * 10) / 10} MB`);
