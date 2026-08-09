// Home-screen icons.
//
// The four files that were in public/ were all the same JPEG, renamed to .png
// and .ico, at whatever size the original happened to be — while the manifest
// declared them image/png at 192 and 512. Browsers often sniff past that, but
// Android's install prompt is fussier, and a maskable icon has to be the size
// it claims.
//
// The mark is the app's own visual language: a last-layer diagram. Rendered
// here from one SVG so every size is genuinely the same drawing.

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
mkdirSync(PUBLIC, { recursive: true });

const BG = "#09090b";
const YELLOW = "#f5d915";

/**
 * @param padding fraction of the canvas left empty around the mark. Maskable
 * icons get more, because Android crops them to whatever shape it likes and
 * anything in the outer ~10% can be shaved off.
 */
function markSvg(size, padding) {
  const inner = size * (1 - padding * 2);
  const origin = size * padding;
  const cell = inner / 3.4;
  const gap = (inner - cell * 3) / 2;
  const radius = cell * 0.16;

  const squares = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = origin + col * (cell + gap);
      const y = origin + row * (cell + gap);
      squares.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${radius.toFixed(2)}" fill="${YELLOW}"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  ${squares.join("\n  ")}
</svg>`;
}

const TARGETS = [
  { file: "pwa-192x192.png", size: 192, padding: 0.16 },
  { file: "pwa-512x512.png", size: 512, padding: 0.16 },
  { file: "pwa-maskable-512x512.png", size: 512, padding: 0.26 },
  { file: "apple-touch-icon.png", size: 180, padding: 0.16 },
  { file: "favicon.png", size: 48, padding: 0.12 },
];

for (const { file, size, padding } of TARGETS) {
  const svg = Buffer.from(markSvg(size, padding));
  const png = await sharp(svg).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(PUBLIC, file), png);
  console.log(`wrote public/${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}

// The old favicon.ico was a renamed JPEG. Nothing references it any more.
const stale = join(PUBLIC, "favicon.ico");
if (existsSync(stale)) {
  rmSync(stale);
  console.log("removed public/favicon.ico (it was a JPEG, and unreferenced)");
}
