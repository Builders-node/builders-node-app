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

/**
 * Where the guide's Apply buttons go.
 *
 * Absolute, because the guide is served from the CA subdomain and applying
 * lives on the apex one. The UTM tags are what let GA4 separate people who
 * applied after reading the guide from everyone else; `src` is the site's own
 * marketing-link code, which starts counting in Admin → Settings → Traffic once
 * a link with that code exists there (an unknown one is ignored, not invented).
 */
const APPLY_URL =
  'https://buildersnode.com/apply?utm_source=ca-guide&utm_medium=content&utm_campaign=winter-2026&src=ca-guide';

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

/**
 * "Download as PDF" — an anchor with no href and no handler, so it is a link
 * that does nothing. The canvas presumably wires it up in the editor; the
 * export doesn't, and the guide is a page rather than a document anyway.
 *
 * Matched by its text rather than its exact markup, so a restyle upstream
 * doesn't quietly let it back in.
 */
const pdfLink = /\s*<div[^>]*>\s*<a[^>]*>\s*Download as PDF\s*<\/a>\s*<\/div>/g;
if (!pdfLink.test(html)) {
  console.warn('  ! no "Download as PDF" link found — check whether the export changed');
}
html = html.replace(pdfLink, '');

/**
 * The export closes its content column early.
 *
 * One stray `</div>` after the daily-timetable section ends the
 * `max-width: 680px` wrapper partway through, so everything from the Roatán
 * section onwards — maps, "Applying to Builders Node", the contacts — renders
 * full-bleed at the left edge while the sections above stay in the column.
 *
 * Repaired by counting rather than by matching that one spot: the closing tag
 * that brings the wrapper to depth zero before the document's last section is
 * removed, which fixes whatever imbalance a future export happens to have.
 */
function repairContentColumn(markup) {
  const start = markup.indexOf('<div style="max-width: 680px;');
  if (start === -1) {
    console.warn('  ! content column not found — check whether the export changed');
    return markup;
  }

  /** Index just past the `</div>` that closes the wrapper, or -1. */
  const findClose = (text) => {
    let depth = 0;
    const tags = /<(\/?)div\b[^>]*>/g;
    tags.lastIndex = start;
    let match;
    while ((match = tags.exec(text))) {
      depth += match[1] ? -1 : 1;
      if (depth === 0) return tags.lastIndex;
    }
    return -1;
  };

  let repaired = 0;
  // Bounded: an export broken past a handful of tags is a different problem,
  // and silently chewing through closing tags would be worse than stopping.
  while (repaired < 5) {
    const close = findClose(markup);
    const lastSection = markup.lastIndexOf('</section>');
    if (close === -1 || close > lastSection) break;
    markup = markup.slice(0, close - '</div>'.length) + markup.slice(close);
    repaired += 1;
  }

  if (repaired > 0) console.log(`Content column repaired: ${repaired} stray </div> removed`);
  return markup;
}

html = repairContentColumn(html);

/**
 * The guide is a whole page, not a card on someone else's background.
 *
 * The export styles its own content wrapper and leaves the document alone, so
 * the browser's default 8px body margin showed as an unpainted frame around it.
 */
html = html.replace(
  '</head>',
  '<style>html,body{margin:0;padding:0;background:#fff;}img{box-sizing:border-box;}</style>\n</head>',
);

/**
 * The contents list scrolled nothing.
 *
 * Its handler looks for a scrollable ancestor with overflow:auto — which is
 * what the canvas editor's artboard is. Served as a page, the scroller is the
 * window itself, no such ancestor exists, and the handler returned silently on
 * every click. Falls back to scrolling the window instead.
 */
const tocGuard = '    if (!s || !el) return;';
if (!html.includes(tocGuard)) {
  console.warn('  ! contents-list handler not found — check whether the export changed');
}
html = html.replace(
  tocGuard,
  "    if (!el) return;\n" +
    "    if (!s) { window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' }); return; }",
);

html = html.replace('Winter Guide 2026', 'Buildersnode founder guide');

/**
 * The note pointed readers at "the email", but the guide is a page reached
 * from the site too — not everyone arrives holding an email to reply to.
 */
const replyLine = "If something's missing, reply to the email - it comes straight to me.";
if (!html.includes(replyLine)) {
  console.warn('  ! "reply to the email" line not found — check whether the export changed');
}
html = html.replace(
  replyLine,
  'If something\'s missing, email me at <a href="mailto:taras@buildersnode.com" style="color: inherit;">taras@buildersnode.com</a>',
);

/**
 * The Apply buttons are `<button>` elements with no handler — the canvas wires
 * them up in the editor, the export doesn't, so all four did nothing. Turned
 * into real links, keeping each one's own styling and adding only what a
 * button doesn't carry.
 */
let applyLinks = 0;
html = html.replace(
  /<button([^>]*)>\s*Apply \(takes 5 minutes\)\s*<\/button>/g,
  (_whole, attrs) => {
    applyLinks += 1;
    const style = (attrs.match(/style="([^"]*)"/) || [, ''])[1];
    return `<a href="${APPLY_URL}" target="_blank" rel="noopener" style="${style}text-decoration:none;display:inline-block;">Apply (takes 5 minutes)</a>`;
  },
);
if (applyLinks === 0) {
  console.warn('  ! no Apply buttons found — check whether the export changed');
} else {
  console.log(`Apply buttons linked: ${applyLinks}`);
}

/**
 * "Prepared for {{ name }}" — dropped rather than filled in.
 *
 * The guide is a static page, so the name could only ever reach it through the
 * query string, and a line addressed to somebody is worth less than it costs
 * once the key that opens the page is already personal.
 */
const preparedFor = /\s*<div[^>]*>\s*Prepared for \{\{\s*name\s*\}\}\s*<\/div>/g;
if (!preparedFor.test(html)) {
  console.warn('  ! no "Prepared for" line found — check whether the export changed');
}
html = html.replace(preparedFor, '');

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
html = html.replace('Last updated [date]', `Last updated ${today}`);

writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);
rmSync(work, { recursive: true, force: true });

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
console.log(`Guide imported to ${path.relative(path.join(here, '..'), PUBLIC_DIR)}`);
console.log(`Assets: ${mb(before)} → ${mb(after)}`);
