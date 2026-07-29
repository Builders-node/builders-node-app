// One-shot: generate PWA / favicon PNGs from public/app-icon-source.png.
// Run with: node scripts/gen-pwa-icons.mjs
//
// The source is expected to already be a square, opaque icon (dark background
// + centered logo with safe-area), so we just resize — no white padding, no
// re-composition. This matches the "Avatar dark bg" brand asset.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const src = await readFile(resolve(publicDir, 'app-icon-source.png'));

const outputs = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  // Apple touch icon: 180x180 opaque (source is already opaque).
  { name: 'apple-touch-icon.png', size: 180 },
  // Maskable: same 512 opaque icon; the safe area is already baked in.
  { name: 'maskable-512.png', size: 512 },
  // Favicon PNGs for the browser tab.
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 },
];

for (const { name, size } of outputs) {
  await sharp(src).resize(size, size).png().toFile(resolve(publicDir, name));
}

console.log(`✓ Generated ${outputs.length} icons in`, publicDir);
