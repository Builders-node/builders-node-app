// One-shot: generate the PNG icons a PWA / iOS home screen needs from the SVG logo.
// Run with: node scripts/gen-pwa-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const srcSvg = resolve(publicDir, 'terminus-logo-small.svg');
const brand = '#EA5404';

const svg = await readFile(srcSvg);

// Straight renders (transparent background) for browsers/manifests that
// composite themselves.
await sharp(svg).resize(192, 192).png().toFile(resolve(publicDir, 'icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(resolve(publicDir, 'icon-512.png'));

// Apple touch icon: must be opaque + no transparency + no rounded corners
// (iOS applies its own). White background, 180x180.
await sharp(svg)
  .resize(160, 160, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(resolve(publicDir, 'apple-touch-icon.png'));

// Maskable icon: logo centered with generous padding (Android safe area is
// the middle 80%), full brand-colour background so any mask shape looks good.
const size = 512;
const inner = Math.round(size * 0.6);
const padded = await sharp(svg)
  .resize(inner, inner, { fit: 'contain', background: { r: 234, g: 84, b: 4, alpha: 1 } })
  .png()
  .toBuffer();
await sharp({
  create: { width: size, height: size, channels: 4, background: brand },
})
  .composite([{ input: padded, gravity: 'center' }])
  .png()
  .toFile(resolve(publicDir, 'maskable-512.png'));

console.log('✓ Generated PWA icons in', publicDir);
