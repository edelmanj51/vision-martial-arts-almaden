#!/usr/bin/env node
/**
 * fill-template.js v5 — Combat Boost template builder
 *
 * Usage:
 *   node fill-template.js          build to dist/
 *   node fill-template.js --check  validate only, no output written
 *
 * Reads client-data.yaml, runs fail-fast validation, processes conditional
 * IF blocks, replaces [TOKEN] placeholders, writes finished HTML to dist/.
 *
 * Computed automatically (do NOT put these in client-data.yaml):
 *   CURRENT_YEAR          current calendar year (for copyright)
 *   YEARS_COUNT           current year minus YEAR_FOUNDED
 *   R_1_INITIAL … R_10_INITIAL   first letter of each reviewer name
 *   GOOGLE_MAPS_EMBED_URL built from address fields
 *   OG_IMAGE              falls back to HERO_IMAGE if not set
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CHECK_ONLY = process.argv.includes('--check');
const IMG_EXT    = /\.(png|jpg|jpeg|webp|gif|svg)$/i;

// ── Required tokens — build aborts if any are absent or empty ─────────────────
const REQUIRED = [
  'SCHOOL_NAME', 'MARTIAL_ART', 'SITE_URL', 'CITY', 'STATE',
  'ADDRESS_LINE_1', 'PHONE', 'HOURS',
  'PRIMARY_COLOR', 'SECONDARY_COLOR', 'LOGO_IMAGE',
  'HERO_IMAGE', 'HERO_HEADLINE', 'HERO_SUBHEADLINE', 'HERO_SUBTEXT',
  'STAR_RATING', 'REVIEW_COUNT',
  'ABOUT_TEXT',
  'INSTRUCTOR_1_NAME', 'INSTRUCTOR_1_PHOTO',
  'INSTRUCTOR_1_TITLE', 'INSTRUCTOR_1_BIO',
  'PROGRAM_1_NAME', 'PROGRAM_1_PHOTO', 'PROGRAM_1_AGE_RANGE',
  'TRIAL_WEBHOOK_URL', 'STARTER_KIT_WEBHOOK_URL',
  'QUIZ_WEBHOOK_URL', 'FINAL_CTA_WEBHOOK_URL', 'BOOKING_CALENDAR_URL',
  'PRIVACY_POLICY_URL',
];

// ── Load client data ──────────────────────────────────────────────────────────
if (!fs.existsSync('client-data.yaml')) {
  console.error('ERROR: client-data.yaml not found. Copy from the v5 template and fill it in.');
  process.exit(1);
}

let data;
try {
  data = yaml.load(fs.readFileSync('client-data.yaml', 'utf8')) || {};
} catch (e) {
  console.error(`ERROR: client-data.yaml is invalid YAML:\n  ${e.message}`);
  process.exit(1);
}

// ── Auto-populate image slots from folder structure ───────────────────────────
// Drop an image into images/{slot}/ and it gets picked up automatically.
// Canonical filenames are preferred over alphabetical first-match:
//   hero/       → hero.jpg  (or hero.webp, hero.png)
//   instructor/ → instructor-1/, instructor-2/, instructor-3/ subfolders
//   programs/   → main.jpg  (or main.webp, main.png) inside each program-N/
const IMAGE_SLOTS = [
  { folder: 'images/hero',                    token: 'HERO_IMAGE',         prefer: ['hero.jpg', 'hero.webp', 'hero.png'] },
  { folder: 'images/instructor/instructor-1', token: 'INSTRUCTOR_1_PHOTO', prefer: [] },
  { folder: 'images/instructor/instructor-2', token: 'INSTRUCTOR_2_PHOTO', prefer: [] },
  { folder: 'images/instructor/instructor-3', token: 'INSTRUCTOR_3_PHOTO', prefer: [] },
  { folder: 'images/programs/program-1',      token: 'PROGRAM_1_PHOTO',    prefer: ['main.jpg', 'main.webp', 'main.png'] },
  { folder: 'images/programs/program-2',      token: 'PROGRAM_2_PHOTO',    prefer: ['main.jpg', 'main.webp', 'main.png'] },
  { folder: 'images/programs/program-3',      token: 'PROGRAM_3_PHOTO',    prefer: ['main.jpg', 'main.webp', 'main.png'] },
  { folder: 'images/programs/program-4',      token: 'PROGRAM_4_PHOTO',    prefer: ['main.jpg', 'main.webp', 'main.png'] },
  { folder: 'images/programs/program-5',      token: 'PROGRAM_5_PHOTO',    prefer: ['main.jpg', 'main.webp', 'main.png'] },
  { folder: 'images/programs/program-6',      token: 'PROGRAM_6_PHOTO',    prefer: ['main.jpg', 'main.webp', 'main.png'] },
];

for (const { folder, token, prefer } of IMAGE_SLOTS) {
  if (!data[token] && fs.existsSync(folder)) {
    const files = fs.readdirSync(folder).filter(f => IMG_EXT.test(f));
    if (files.length > 0) {
      const match = prefer.find(p => files.includes(p)) || files[0];
      data[token] = `${folder}/${match}`;
    }
  }
}

// Fallback: stock images bundled with the template
const STOCK = {
  'HERO_IMAGE':         'images/stock/hero.webp',
  'INSTRUCTOR_1_PHOTO': 'images/stock/instructor.webp',
  'PROGRAM_1_PHOTO':    'images/stock/program-1.webp',
  'PROGRAM_2_PHOTO':    'images/stock/program-2.webp',
  'PROGRAM_3_PHOTO':    'images/stock/program-3.webp',
  'PROGRAM_4_PHOTO':    'images/stock/program-4.webp',
  'PROGRAM_5_PHOTO':    'images/stock/program-5.webp',
  'PROGRAM_6_PHOTO':    'images/stock/program-6.webp',
};
for (const [token, fallback] of Object.entries(STOCK)) {
  if (!data[token] && fs.existsSync(fallback)) {
    data[token] = fallback;
    console.log(`  ⚠️  ${token} not set — using stock fallback`);
  }
}

// Auto-generate quick-tour gallery HTML from images/quick-tour/
const QT_FOLDER = 'images/quick-tour';
if (fs.existsSync(QT_FOLDER) && !data.QUICK_TOUR_GALLERY) {
  const files = fs.readdirSync(QT_FOLDER).filter(f => IMG_EXT.test(f)).sort();
  if (files.length > 0) {
    data.QUICK_TOUR_GALLERY = files.map(f => {
      const label = f.replace(IMG_EXT, '').replace(/-/g, ' ');
      return `    <div class="gallery-item reveal">\n` +
             `      <div class="gallery-photo"><img src="${QT_FOLDER}/${f}" ` +
             `alt="${label}" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>\n` +
             `    </div>`;
    }).join('\n');
  }
}

// ── Fail-fast: required tokens ────────────────────────────────────────────────
const missing = REQUIRED.filter(t => !data[t] || String(data[t]).trim() === '');
if (missing.length > 0) {
  console.error('\n🚫  REQUIRED TOKENS MISSING — build aborted:\n');
  missing.forEach(t => console.error(`     [${t}]`));
  console.error('\nFill these in client-data.yaml then retry.\n');
  process.exit(1);
}

// ── Fail-fast: format validation ──────────────────────────────────────────────
const errs = [];

const rating = parseFloat(data.STAR_RATING);
if (isNaN(rating) || rating < 0 || rating > 5)
  errs.push(`STAR_RATING must be 0.0–5.0, got: "${data.STAR_RATING}"`);
if (!String(data.STAR_RATING).includes('.'))
  errs.push(`STAR_RATING must include a decimal point, e.g. 4.9 not "${data.STAR_RATING}" (prevents the integer-display bug)`);

if (data.YEAR_FOUNDED) {
  const yr = parseInt(data.YEAR_FOUNDED, 10);
  if (isNaN(yr) || yr < 1800 || yr >= new Date().getFullYear())
    errs.push(`YEAR_FOUNDED must be a 4-digit year before ${new Date().getFullYear()}, got: "${data.YEAR_FOUNDED}"`);
}

const WEBHOOK_TOKENS = [
  'TRIAL_WEBHOOK_URL', 'STARTER_KIT_WEBHOOK_URL',
  'QUIZ_WEBHOOK_URL', 'FINAL_CTA_WEBHOOK_URL', 'BOOKING_CALENDAR_URL',
];
for (const t of WEBHOOK_TOKENS) {
  const v = String(data[t] || '');
  if (!v.startsWith('https://'))
    errs.push(`${t} must start with https://, got: "${v}"`);
  if (/^\[/.test(v))
    errs.push(`${t} looks like an unfilled placeholder: "${v}"`);
}

if (errs.length > 0) {
  console.error('\n🚫  VALIDATION ERRORS — build aborted:\n');
  errs.forEach(e => console.error(`     ${e}`));
  process.exit(1);
}

if (CHECK_ONLY) {
  console.log('✅  client-data.yaml is valid — all required tokens present and formatted correctly.');
  process.exit(0);
}

// ── Compute derived values ────────────────────────────────────────────────────

// CURRENT_YEAR / YEARS_COUNT — computed, never enter manually
data.CURRENT_YEAR = String(new Date().getFullYear());
if (data.YEAR_FOUNDED)
  data.YEARS_COUNT = String(new Date().getFullYear() - parseInt(data.YEAR_FOUNDED, 10));

// R_N_INITIAL — derived from reviewer names, never enter manually
for (let n = 1; n <= 10; n++) {
  const name = data[`REVIEWER_${n}_NAME`];
  if (name) data[`R_${n}_INITIAL`] = String(name).charAt(0).toUpperCase();
}

// REVIEWER_N_SOURCE / _SOURCE_ICON / _SOURCE_COLOR — which platform a review
// came from. Defaults to "Google" (matching every existing client build) so
// nothing changes unless client-data.yaml sets REVIEWER_N_SOURCE: "Facebook"
// for a review actually sourced from Facebook.
for (let n = 1; n <= 10; n++) {
  if (!data[`REVIEWER_${n}_NAME`]) continue;
  if (!data[`REVIEWER_${n}_SOURCE`]) data[`REVIEWER_${n}_SOURCE`] = 'Google';
  const isFacebook = data[`REVIEWER_${n}_SOURCE`] === 'Facebook';
  data[`REVIEWER_${n}_SOURCE_ICON`]  = isFacebook ? 'f' : 'G';
  data[`REVIEWER_${n}_SOURCE_COLOR`] = isFacebook ? '#1877F2' : '#4285f4';
}

// HAS_REVIEWERS — set if at least one reviewer exists (used to hide the whole testimonials section)
if (data.REVIEWER_1_NAME) data.HAS_REVIEWERS = '1';

// GOOGLE_MAPS_EMBED_URL — always computed from address fields
const addrParts = [data.ADDRESS_LINE_1, data.CITY, data.STATE, data.ZIP].filter(Boolean);
data.GOOGLE_MAPS_EMBED_URL =
  `https://maps.google.com/maps?q=${encodeURIComponent(addrParts.join(', '))}&output=embed`;

// OG_IMAGE — falls back to HERO_IMAGE
if (!data.OG_IMAGE) data.OG_IMAGE = data.HERO_IMAGE;

// ── Build dist/ ───────────────────────────────────────────────────────────────
if (!fs.existsSync('dist')) fs.mkdirSync('dist');

function copyDirSync(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (entry === 'review') continue;
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    if (fs.statSync(s).isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}
if (fs.existsSync('images')) copyDirSync('images', path.join('dist', 'images'));
if (fs.existsSync('brand_assets')) copyDirSync('brand_assets', path.join('dist', 'brand_assets'));

// ── IF block processor ────────────────────────────────────────────────────────
// Syntax: <!-- [IF:TOKEN_NAME] --> content <!-- [/IF:TOKEN_NAME] -->
// Runs in a loop to resolve nested blocks (inner blocks resolve before outer).
function processIfBlocks(html, data) {
  const IF_RE = /<!-- \[IF:([A-Z][A-Z_0-9]+)\] -->([\s\S]*?)<!-- \[\/IF:\1\] -->/g;
  let prev;
  do {
    prev = html;
    html = html.replace(IF_RE, (_, token, inner) => {
      const val = data[token];
      const active = val && String(val).trim() !== '' && String(val).trim().toLowerCase() !== 'false';
      return active ? inner : '';
    });
  } while (html !== prev);
  return html;
}

// ── Token replacement ─────────────────────────────────────────────────────────
function replaceTokens(html, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value == null) continue;
    html = html.split(`[${key}]`).join(String(value));
  }
  return html;
}

// ── Process each HTML file ────────────────────────────────────────────────────
// program-template.html is excluded — handled separately by the generation loop below.
const htmlFiles = fs.readdirSync('.')
  .filter(f => f.endsWith('.html') && f !== 'program-template.html')
  .sort();
const unfilled  = new Set();
const TOKEN_RE  = /\[[A-Z][A-Z_0-9]+\]/g;

for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  html = processIfBlocks(html, data);
  html = replaceTokens(html, data);

  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(html)) !== null) unfilled.add(m[0]);

  fs.writeFileSync(path.join('dist', file), html, 'utf8');
  console.log(`  ✓  ${file}`);
}

// ── N-program-page generation loop ───────────────────────────────────────────
// Reads program-template.html, generates program-1.html … program-N.html in dist/.
// Stops at the first undefined PROGRAM_N_NAME (max 6). Skips if source file exists.
//
// Generic token → numbered mapping per iteration:
//   [PROGRAM_NAME]        → PROGRAM_N_NAME
//   [AGE_RANGE]           → PROGRAM_N_AGE_RANGE
//   [PROGRAM_PHOTO]       → PROGRAM_N_PHOTO
//   [PROGRAM_DAYS]        → PROGRAM_N_DAYS
//   [PROGRAM_DESCRIPTION] → PROGRAM_N_DESCRIPTION
if (fs.existsSync('program-template.html')) {
  const GENERIC_MAP = [
    ['PROGRAM_NAME',            n => `PROGRAM_${n}_NAME`],
    ['AGE_RANGE',               n => `PROGRAM_${n}_AGE_RANGE`],
    ['PROGRAM_PHOTO',           n => `PROGRAM_${n}_PHOTO`],
    ['PROGRAM_DAYS',            n => `PROGRAM_${n}_DAYS`],
    ['PROGRAM_DESCRIPTION',     n => `PROGRAM_${n}_DESCRIPTION`],
    ['PROGRAM_AUDIENCE_KIDS',   n => `PROGRAM_${n}_AUDIENCE_KIDS`],
    ['PROGRAM_AUDIENCE_TEENS',  n => `PROGRAM_${n}_AUDIENCE_TEENS`],
    ['PROGRAM_AUDIENCE_ADULTS', n => `PROGRAM_${n}_AUDIENCE_ADULTS`],
  ];

  for (let n = 1; n <= 6; n++) {
    if (!data[`PROGRAM_${n}_NAME`]) break;

    const sourceFile = `program-${n}.html`;
    if (fs.existsSync(sourceFile)) continue; // hand-crafted page takes precedence

    let page = fs.readFileSync('program-template.html', 'utf8');

    // Build a page-level data overlay so generic tokens are available to IF blocks
    const pageData = Object.assign({}, data);
    for (const [generic, getKey] of GENERIC_MAP) {
      const val = data[getKey(n)];
      if (val) { pageData[generic] = val; page = page.split(`[${generic}]`).join(String(val)); }
    }

    // Kids and teens share one "Does your student face any of these
    // challenges?" block (same copy); adults get a separate one. This
    // combined flag lets program-template.html gate the shared block with a
    // single IF instead of rendering it twice for a program that sets both
    // PROGRAM_N_AUDIENCE_KIDS and PROGRAM_N_AUDIENCE_TEENS.
    pageData.PROGRAM_AUDIENCE_YOUTH =
      (data[`PROGRAM_${n}_AUDIENCE_KIDS`] || data[`PROGRAM_${n}_AUDIENCE_TEENS`]) ? '1' : '';

    page = processIfBlocks(page, pageData);
    page = replaceTokens(page, pageData);

    // Collect unfilled tokens from generated pages
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(page)) !== null) unfilled.add(m[0]);

    fs.writeFileSync(path.join('dist', sourceFile), page, 'utf8');
    console.log(`  ✓  program-${n}.html (generated from template)`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (unfilled.size > 0) {
  console.log(`\n⚠️   Unfilled tokens in dist/ (${unfilled.size}):`);
  for (const t of [...unfilled].sort()) console.log(`     ${t}`);
  console.error('\nBuild wrote output but tokens remain. Run qc.js for full report.');
  process.exit(1);
} else {
  console.log('\n✅  Build complete — all tokens filled. Run: npm run qc');
}
