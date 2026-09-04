#!/usr/bin/env node
/**
 * qc.js v5 — Combat Boost quality gate
 *
 * Run after fill-template.js. Exits 0 on full pass, exits 1 on any failure.
 * Never push to GitHub unless this passes.
 *
 * Usage:
 *   node qc.js
 *   npm run qc
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const yaml   = require('js-yaml');

// ── Tiger Paw logo fingerprint — any logo matching this hash is the wrong logo ─
const TIGER_PAW_LOGO_HASH = 'e5a7b562fe6759ed0daa65dbd730c2efc60b2946e6c40db69993adf3cb7a2fb6';

const pass    = [];
const fail    = [];
const warn    = [];

function ok(msg)   { pass.push(`  ✅  ${msg}`); }
function bad(msg)  { fail.push(`  ❌  ${msg}`); }
function caution(msg) { warn.push(`  ⚠️   ${msg}`); }

// ── Load client-data.yaml ─────────────────────────────────────────────────────
if (!fs.existsSync('client-data.yaml')) {
  console.error('ERROR: client-data.yaml not found. Run from project root.');
  process.exit(1);
}
const data = yaml.load(fs.readFileSync('client-data.yaml', 'utf8')) || {};

// Apply same auto-population as fill-template.js so image checks work for
// tokens that are resolved from folder structure rather than set explicitly.
const IMG_EXT_QC = /\.(jpg|jpeg|webp|png|gif|avif)$/i;
const IMAGE_SLOTS_QC = [
  { folder: 'images/hero',                    token: 'HERO_IMAGE',         prefer: ['hero.jpg', 'hero.webp', 'hero.png'] },
  { folder: 'images/instructor/instructor-1', token: 'INSTRUCTOR_1_PHOTO', prefer: [] },
];
for (const { folder, token, prefer } of IMAGE_SLOTS_QC) {
  if (!data[token] && fs.existsSync(folder)) {
    const files = fs.readdirSync(folder).filter(f => IMG_EXT_QC.test(f));
    if (files.length > 0) {
      const match = prefer.find(p => files.includes(p)) || files[0];
      data[token] = `${folder}/${match}`;
    }
  }
}

// ── Load dist/index.html (primary) and all other dist/*.html ─────────────────
const DIST_INDEX = path.join('dist', 'index.html');
if (!fs.existsSync(DIST_INDEX)) {
  console.error('ERROR: dist/index.html not found. Run fill-template.js first.');
  process.exit(1);
}
const html = fs.readFileSync(DIST_INDEX, 'utf8');

// Load all dist HTML files for Check 1 (unfilled token scan)
const distHtmlFiles = fs.readdirSync('dist')
  .filter(f => f.endsWith('.html'))
  .map(f => path.join('dist', f));

console.log('\n🔍  Running Combat Boost QC checks...\n');

// ── Check 1: No unfilled [TOKEN] patterns in any dist/*.html ──────────────────
const TOKEN_RE = /\[[A-Z][A-Z_0-9]+\]/g;
let allUnfilled = [];
for (const f of distHtmlFiles) {
  const content = fs.readFileSync(f, 'utf8');
  const found = [...content.matchAll(TOKEN_RE)]
    .map(m => m[0])
    .filter(t => /^\[[A-Z][A-Z_0-9]+\]$/.test(t));
  if (found.length > 0) {
    allUnfilled.push(`${path.basename(f)}: ${[...new Set(found)].join(', ')}`);
  }
}
if (allUnfilled.length === 0) {
  ok('No unfilled [TOKEN] placeholders in any dist/*.html');
} else {
  for (const line of allUnfilled) bad(`Unfilled tokens — ${line}`);
}

// ── Check 2: STAR_RATING is a valid decimal 0.0–5.0 ──────────────────────────
const rating = parseFloat(data.STAR_RATING);
if (!isNaN(rating) && rating >= 0 && rating <= 5 && String(data.STAR_RATING).includes('.')) {
  ok(`STAR_RATING is valid: ${data.STAR_RATING}`);
} else {
  bad(`STAR_RATING "${data.STAR_RATING}" is not a valid decimal 0.0–5.0 (e.g. 4.9). This causes the integer-display bug.`);
}

// Check STAR_RATING renders as decimal in the HTML (not as integer like 70)
const starInHtml = html.includes(String(data.STAR_RATING));
if (starInHtml) {
  ok('STAR_RATING renders correctly in HTML');
} else {
  bad(`STAR_RATING "${data.STAR_RATING}" not found in dist/index.html — possible rendering bug`);
}

// ── Check 3: REVIEW_COUNT is a plain integer, no + in data ───────────────────
const rc = String(data.REVIEW_COUNT || '');
if (/^\d+$/.test(rc)) {
  ok(`REVIEW_COUNT is a clean integer: ${rc}`);
} else {
  bad(`REVIEW_COUNT "${rc}" must be a plain integer with no + suffix (template adds + if needed)`);
}

// ── Check 4: YEAR_FOUNDED is valid (optional) → no "since ." in output ───────
if (data.YEAR_FOUNDED) {
  const yr = parseInt(data.YEAR_FOUNDED, 10);
  if (!isNaN(yr) && yr > 1800 && yr < new Date().getFullYear()) {
    ok(`YEAR_FOUNDED is valid: ${yr}`);
  } else {
    bad(`YEAR_FOUNDED "${data.YEAR_FOUNDED}" is not a valid year`);
  }
} else {
  ok('YEAR_FOUNDED not set (new school — IF:YEARS_COUNT blocks will be hidden)');
}
if (html.includes('since .') || html.includes('Since .')) {
  bad('Footer contains "since ." — YEAR_FOUNDED is empty or not replacing correctly');
} else {
  ok('No "since ." in footer');
}

// ── Check 5: No double-plus (++) anywhere ─────────────────────────────────────
if (html.includes('++')) {
  bad('Double-plus "++" found in dist/index.html — token appended to a literal "+" in the template');
} else {
  ok('No "++" double-plus in output');
}

// ── Check 6: All webhook URLs are real, not placeholders ─────────────────────
const WEBHOOK_TOKENS = [
  'TRIAL_WEBHOOK_URL', 'STARTER_KIT_WEBHOOK_URL',
  'QUIZ_WEBHOOK_URL', 'FINAL_CTA_WEBHOOK_URL', 'BOOKING_CALENDAR_URL',
];
let webhooksOk = true;
for (const t of WEBHOOK_TOKENS) {
  const v = String(data[t] || '');
  if (!v.startsWith('https://') || /^\[/.test(v)) {
    bad(`${t} is not a valid URL: "${v}"`);
    webhooksOk = false;
  }
}
if (webhooksOk) ok('All webhook and calendar URLs are valid https:// URLs');

// ── Check 7: Logo file exists and is not the Tiger Paw logo ──────────────────
const logoPath = data.LOGO_IMAGE;
if (!logoPath) {
  bad('LOGO_IMAGE is not set in client-data.yaml');
} else if (!fs.existsSync(logoPath)) {
  bad(`LOGO_IMAGE file not found at: ${logoPath}`);
} else {
  ok(`LOGO_IMAGE file exists: ${logoPath}`);
  const logoHash = crypto.createHash('sha256')
    .update(fs.readFileSync(logoPath))
    .digest('hex');
  if (logoHash === TIGER_PAW_LOGO_HASH) {
    bad('LOGO_IMAGE is the Tiger Paw logo — replace with client logo before delivering');
  } else {
    ok('Logo is not the Tiger Paw logo (hash check passed)');
  }
}

// ── Check 8: All four forms have correct lead_source hidden fields ────────────
const LEAD_SOURCES = [
  { formId: 'form-trial', value: 'trial' },
  { formId: 'form-kit',   value: 'starter_kit' },
  { formId: 'form-quiz',  value: 'quiz' },
  { formId: 'form-final', value: 'trial' },
];
let formsOk = true;
for (const { formId, value } of LEAD_SOURCES) {
  // Check that the form contains a hidden input with the correct lead_source value
  const formRe = new RegExp(`id=["']${formId}["'][\\s\\S]*?</form>`, 'i');
  const formMatch = html.match(formRe);
  if (!formMatch) {
    bad(`Form #${formId} not found in dist/index.html`);
    formsOk = false;
    continue;
  }
  const hasLeadSource = formMatch[0].includes(`name="lead_source"`) &&
                        formMatch[0].includes(`value="${value}"`);
  if (!hasLeadSource) {
    bad(`Form #${formId} is missing lead_source hidden field with value="${value}"`);
    formsOk = false;
  }
}
if (formsOk) ok('All four forms have correct lead_source hidden fields');

// ── Check 9: Meta title contains SCHOOL_NAME and CITY ────────────────────────
const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
if (titleMatch) {
  const title = titleMatch[1];
  const hasSchool = title.includes(data.SCHOOL_NAME || '');
  const hasCity   = title.includes(data.CITY || '');
  if (hasSchool && hasCity) {
    ok(`Meta title contains school name and city: "${title}"`);
  } else {
    if (!hasSchool) bad(`Meta title missing SCHOOL_NAME. Title: "${title}"`);
    if (!hasCity)   caution(`Meta title missing CITY. Title: "${title}"`);
  }
} else {
  bad('No <title> tag found in dist/index.html');
}

// ── Check 10: Privacy Policy links do not point to "#" ───────────────────────
const privacyRe = /href=["']#["'][^>]*>[^<]*[Pp]rivacy/g;
const badPrivacy = [...html.matchAll(privacyRe)];
if (badPrivacy.length > 0) {
  bad(`Privacy Policy link(s) point to "#" — set PRIVACY_POLICY_URL in client-data.yaml`);
} else {
  ok('Privacy Policy links are not pointing to "#"');
}

// ── Check 11: No Tiger Paw image filenames referenced in HTML ────────────────
const TIGER_PAW_FILES = ['kids-class-2.webp', 'adult-class.webp', 'coach-demo.webp', 'hero-image.webp'];
const tpFiles = TIGER_PAW_FILES.filter(f => html.includes(f));
if (tpFiles.length > 0) {
  bad(`Tiger Paw image filename(s) found in output: ${tpFiles.join(', ')}`);
} else {
  ok('No Tiger Paw image filenames in output');
}

// ── Check 12: SCHOOL_NAME appears in the HTML ─────────────────────────────────
if (data.SCHOOL_NAME && html.includes(data.SCHOOL_NAME)) {
  ok(`SCHOOL_NAME "${data.SCHOOL_NAME}" found in HTML`);
} else {
  bad(`SCHOOL_NAME "${data.SCHOOL_NAME}" not found in dist/index.html — token may not be replacing correctly`);
}

// ── Check 13: HERO_IMAGE file exists ─────────────────────────────────────────
const heroPath = data.HERO_IMAGE;
if (heroPath && fs.existsSync(heroPath)) {
  ok(`HERO_IMAGE exists: ${heroPath}`);
} else {
  bad(`HERO_IMAGE file not found at: ${heroPath}`);
}

// ── Check 14: INSTRUCTOR_1_PHOTO exists ──────────────────────────────────────
const instrPath = data.INSTRUCTOR_1_PHOTO;
if (instrPath && fs.existsSync(instrPath)) {
  ok(`INSTRUCTOR_1_PHOTO exists: ${instrPath}`);
} else {
  bad(`INSTRUCTOR_1_PHOTO file not found at: ${instrPath}`);
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log(pass.join('\n'));
if (warn.length > 0) {
  console.log('\n' + warn.join('\n'));
}

if (fail.length > 0) {
  console.log('\n' + fail.join('\n'));
  console.log(`\n🚫  QC FAILED — ${fail.length} issue(s) must be fixed before pushing to GitHub.\n`);
  process.exit(1);
} else {
  const warnNote = warn.length > 0 ? ` (${warn.length} warning(s))` : '';
  console.log(`\n✅  QC PASSED — ${pass.length} checks passed${warnNote}. Safe to push to GitHub.\n`);
  process.exit(0);
}
