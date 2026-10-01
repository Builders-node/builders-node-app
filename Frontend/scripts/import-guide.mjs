/**
 * Turn a Claude Design canvas export into the guide page we serve.
 *
 *   node scripts/import-guide.mjs ~/Downloads/"Builders Node Private Guide.zip"
 *
 * The export is not a static document — it ships `support.js` and a few dozen
 * template bindings that drive the contents list, the flight widget and the
 * mobile layout. So it is served as it was authored rather than rewritten into
 * components: anything else would mean reimplementing that runtime and
 * re-doing it on every edit of the guide.
 *
 * What this does do is make it fit on the web:
 *
 *  - drops `uploads/`, which is the same images again under their original
 *    filenames and is never referenced;
 *  - re-encodes the photos (one was 5921px wide and 10MB) and keeps the result
 *    only when it is actually smaller — re-encoding an already-tight file
 *    makes it bigger;
 *  - repoints the page at whatever extension each image ended up with;
 *  - fills in the "last updated" line, and the reader's name from `?name=`.
 *
 * Images are converted to JPEG where they were PNG: the page sits on white, so
 * an alpha channel buys nothing and costs megabytes.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/**
 * Not `/guide`, and not guessable. The page is static, so this path is the only
 * thing standing between a reader's key and the open web — the unlock endpoint
 * is the one place it is written down besides here.
 */
const PUBLIC_DIR = path.join(here, '..', 'public', 'g', 'winter-2026-k7m2qx');
/** The long edge, in pixels. Above this nothing on the page gets sharper. */
const MAX_EDGE = 1800;

const zip = process.argv[2];
if (!zip) {
  console.error('Usage: node scripts/import-guide.mjs <export.zip>');
  process.exit(1);
}

const work = mkdtempSync(path.join(tmpdir(), 'guide-'));
execFileSync('unzip', ['-q', zip, '-d', work]);

const sourceHtml = path.join(work, 'Guide.dc.html');
const sourceImages = path.join(work, 'images');

rmSync(PUBLIC_DIR, { recursive: true, force: true });
mkdirSync(path.join(PUBLIC_DIR, 'images'), { recursive: true });
copyFileSync(path.join(work, 'support.js'), path.join(PUBLIC_DIR, 'support.js'));

const sizeOf = (file) => statSync(file).size;
let before = 0;
let after = 0;

for (const name of readdirSync(sourceImages)) {
  const from = path.join(sourceImages, name);
  const original = sizeOf(from);
  before += original;

  // sips can't re-encode video, and avif/webp are already doing their job.
  if (/\.(mp4|avif|webp)$/i.test(name)) {
    copyFileSync(from, path.join(PUBLIC_DIR, 'images', name));
    after += original;
    continue;
  }

  const stem = name.replace(/\.[^.]+$/, '');
  const candidate = path.join(work, `${stem}.candidate.jpg`);
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', String(MAX_EDGE), from, '--out', candidate], {
      stdio: 'ignore',
    });
  } catch {
    copyFileSync(from, path.join(PUBLIC_DIR, 'images', name));
    after += original;
    continue;
  }

  if (sizeOf(candidate) < original) {
    copyFileSync(candidate, path.join(PUBLIC_DIR, 'images', `${stem}.jpg`));
    after += sizeOf(candidate);
  } else {
    copyFileSync(from, path.join(PUBLIC_DIR, 'images', name));
    after += original;
  }
}

const shipped = new Set(readdirSync(path.join(PUBLIC_DIR, 'images')));
let html = readFileSync(sourceHtml, 'utf8');

// Point the page at the extension each image actually ended up with.
html = html.replace(/src="images\/([^"]+)"/g, (whole, file) => {
  if (shipped.has(file)) return whole;
  const stem = file.replace(/\.[^.]+$/, '');
  const found = ['jpg', 'png', 'webp', 'avif', 'mp4'].map((ext) => `${stem}.${ext}`).find((c) => shipped.has(c));
  if (!found) {
    console.warn(`  ! no asset for ${file}`);
    return whole;
  }
  return `src="images/${found}"`;
});

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
html = html.replace('Last updated [date]', `Last updated ${today}`);

/**
 * The reader's name.
 *
 * The page is a static file, so it cannot be rendered per person — the name
 * rides in the query string the unlock step builds. Written with `textContent`
 * and never as HTML, because it arrived in a URL.
 */
html = html.replace(
  '</body>',
  `<script>
(function () {
  var raw = new URLSearchParams(location.search).get('name') || '';
  var name = raw.trim().slice(0, 60);
  if (!name) return;

  function fill() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.indexOf('[Name]') !== -1) {
        // textContent, never innerHTML: this value arrived in a query string.
        node.nodeValue = node.nodeValue.split('[Name]').join(name);
      }
    }
  }

  // The runtime renders asynchronously and re-renders on its own (opening the
  // contents list, resizing), each time restoring the placeholder from the
  // props schema. So this watches rather than running once. It cannot loop:
  // the only write happens where '[Name]' is present, and after it there is
  // none left to find.
  fill();
  new MutationObserver(fill).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
</script>
</body>`,
);

writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);
rmSync(work, { recursive: true, force: true });

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
console.log(`Guide imported to ${path.relative(path.join(here, '..'), PUBLIC_DIR)}`);
console.log(`Assets: ${mb(before)} → ${mb(after)}`);
