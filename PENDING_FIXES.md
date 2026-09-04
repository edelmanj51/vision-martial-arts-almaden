# v5 Template — Pending Fixes

Issues discovered during client builds. Fix these in the template source
before the next new client build so they don't have to be patched per-project.

---

## 1. instructors.html — Modal form dropdowns hardcoded instead of tokenized

**Discovered:** north-georgia-martial-arts build (2026-06-08)

The modal forms in `instructors.html` have program select dropdowns with
hardcoded program names (e.g. "Kids Taekwondo", "Teens & Adults TKD").
`index.html` correctly uses `[IF:PROGRAM_N_NAME]` / `[PROGRAM_N_NAME]` tokens
so they stay in sync with `client-data.yaml` automatically.

**Fix:** Replace the hardcoded `<option>` blocks in both modal forms in
`instructors.html` with the same tokenized pattern used in `index.html`:

```html
<option value="" disabled selected>Select a program…</option>
<!-- [IF:PROGRAM_1_NAME] --><option value="program-1">[PROGRAM_1_NAME]</option><!-- [/IF:PROGRAM_1_NAME] -->
<!-- [IF:PROGRAM_2_NAME] --><option value="program-2">[PROGRAM_2_NAME]</option><!-- [/IF:PROGRAM_2_NAME] -->
<!-- [IF:PROGRAM_3_NAME] --><option value="program-3">[PROGRAM_3_NAME]</option><!-- [/IF:PROGRAM_3_NAME] -->
<!-- [IF:PROGRAM_4_NAME] --><option value="program-4">[PROGRAM_4_NAME]</option><!-- [/IF:PROGRAM_4_NAME] -->
<!-- [IF:PROGRAM_5_NAME] --><option value="program-5">[PROGRAM_5_NAME]</option><!-- [/IF:PROGRAM_5_NAME] -->
<!-- [IF:PROGRAM_6_NAME] --><option value="program-6">[PROGRAM_6_NAME]</option><!-- [/IF:PROGRAM_6_NAME] -->
<option value="not-sure">Not Sure Yet</option>
```

---

## 2. ~~Footer h4 → h3 heading order~~ ✅ FIXED 2026-06-08

**Discovered:** north-georgia-martial-arts build (2026-06-08)
**Lighthouse impact:** Heading order failure (accessibility audit)

Footer column headings (Programs, Useful Links, Contact Us) use `<h4>` but
the last heading before the footer is an `<h2>`, skipping `<h3>`. This fails
Lighthouse accessibility heading-order check.

**Fix:** Change footer column headings from `h4` to `h3` in:
- `index.html` (CSS selector `.footer-col h4` → `.footer-col h3`, and the 3 elements)
- `instructors.html`
- All other sub-page templates that include the standard footer

---

## 3. ~~Footer bottom opacity too low~~ ✅ FIXED 2026-06-08

**Discovered:** north-georgia-martial-arts build (2026-06-08)
**Lighthouse impact:** Color contrast failure (4.45:1 vs 4.5:1 required)

`.footer-bottom` uses `opacity: .45` which drops the copyright/legal text
contrast ratio just below the 4.5:1 WCAG AA threshold on dark footer backgrounds.

**Fix:** Change `.footer-bottom` opacity from `.45` to `.55` in `index.html`
and all sub-page templates with the same footer.

---

## 4. ~~Logo link aria-label causes WCAG 2.5.3 label mismatch~~ ✅ FIXED 2026-06-08

**Discovered:** north-georgia-martial-arts build (2026-06-08)
**Lighthouse impact:** label-content-name-mismatch (WCAG 2.5.3, serious)

The logo `<a>` uses `aria-label="[SCHOOL_NAME] Home"` but the visible text
inside is `[SCHOOL_NAME]`. The word "Home" in the aria-label doesn't appear
in the visible text, triggering a 2.5.3 failure.

**Fix:** Remove `aria-label` from the logo `<a>` entirely. Also change the
logo `<img>` alt to `""` and add `aria-hidden="true"` so the accessible name
is computed cleanly from the visible text node alone:

```html
<a href="#" class="logo">
  <img src="[LOGO_IMAGE]" alt="" aria-hidden="true" onerror="this.style.display='none'">
  [SCHOOL_NAME]
</a>
```

Apply to both the header and footer logo links in `index.html` and all
sub-page templates.

---

## 5. Program pages — Challenges section is audience-agnostic

**Discovered:** north-georgia-martial-arts build (2026-06-08)
**Decided:** 2026-06-08

Every program page shows identical kids-focused challenges copy ("struggles with
confidence," "trouble focusing in school") regardless of audience. Broken for
adult programs.

**Decisions:**
- Kids and teens share one challenges block (same copy)
- Adults get a separate block (stress/fitness/self-defense/never-trained framing)
- Mixed-audience programs (teens + adults) showing both blocks is acceptable
- Apply to `program-template.html` in v5 — not a per-client patch

**Pre-implementation check:** Verify that `fill-template.js` substitutes `_N_`
in program-template.html *before* processing IF blocks. The whole approach
depends on `<!-- [IF:PROGRAM_N_AUDIENCE_ADULTS] -->` resolving to e.g.
`<!-- [IF:PROGRAM_4_AUDIENCE_ADULTS] -->` before the IF check runs.

**Implementation:**
```html
<!-- [IF:PROGRAM_N_AUDIENCE_KIDS] -->
  <section class="challenges"> ... kids/teens challenge copy ... </section>
<!-- [/IF:PROGRAM_N_AUDIENCE_KIDS] -->

<!-- [IF:PROGRAM_N_AUDIENCE_TEENS] -->
  <!-- Only render if kids block wasn't already shown -->
  <section class="challenges"> ... kids/teens challenge copy ... </section>
<!-- [/IF:PROGRAM_N_AUDIENCE_TEENS] -->

<!-- [IF:PROGRAM_N_AUDIENCE_ADULTS] -->
  <section class="challenges"> ... adult challenge copy ... </section>
<!-- [/IF:PROGRAM_N_AUDIENCE_ADULTS] -->
```

Adult challenge themes: time constraints, stress relief, fitness without a gym,
wanting real self-defense skills, never having trained before, imposter syndrome
about starting as an adult.

---

## 6. Birthday Parties — Remove from program grid, add dedicated homepage section

**Discovered:** north-georgia-martial-arts build (2026-06-08)
**Decided:** 2026-06-08

Birthday Parties should not appear in the programs grid with the same card
format as martial arts programs. The challenges/gains section makes no sense
for it. No program page, no booking flow — just a callout with contact info.

**New tokens (add to client-data.yaml template):**
```yaml
# ── Birthday Parties (optional) ───────────────────────────────────────────────
# If set, renders a dedicated birthday parties section on the homepage.
# Leave blank to hide the section entirely.
BIRTHDAY_PARTIES_DESCRIPTION: ""
BIRTHDAY_PARTIES_CONTACT_NOTE: ""
```

`BIRTHDAY_PARTIES_DESCRIPTION` is the trigger — if set, section renders.
No separate boolean needed.

**Section behavior:**
- Styled as a banner/callout, visually distinct from the programs grid
- References existing `[PHONE]` and `[EMAIL]` tokens for contact — no new fields
- No program page generated, no challenges section, no webhook
- `<!-- [IF:BIRTHDAY_PARTIES_DESCRIPTION] -->` wraps the entire section

**NGMA re-touch required:**
- Remove PROGRAM_6 (Birthday Parties) from `client-data.yaml`
- Remove `images/programs/program-6/` folder
- Delete `dist/program-6.html` from build and git
- Add `BIRTHDAY_PARTIES_DESCRIPTION` and `BIRTHDAY_PARTIES_CONTACT_NOTE` tokens

---

## 7. Tournaments — Schedules section by default, full page when TOURNAMENTS_FULL_PAGE is set

**Discovered:** north-georgia-martial-arts build (2026-06-08)
**Decided:** 2026-06-08

The original NGMA site has an upcoming-tournaments page with 21 entries
through 2027 (ATA circuit: Districts, Nationals, Worlds, international events).

**Approach:**
- Default: add a tournaments section to `schedules.html`, hidden by
  `<!-- [IF:TOURNAMENTS_LIST_HTML] -->`
- Full page mode: when `TOURNAMENTS_FULL_PAGE` token is set (to any non-empty
  value), generate `tournaments.html` as a standalone page with a nav link
  under "More"
- Staleness disclaimer baked in regardless of mode:
  *"Tournament dates are subject to change. Contact us to confirm registration
  deadlines and current event details."*

**New tokens (add to client-data.yaml template):**
```yaml
# ── Tournaments (optional) ────────────────────────────────────────────────────
# TOURNAMENTS_LIST_HTML: raw HTML table or list of upcoming events.
# If blank, no tournaments section appears anywhere.
# Set TOURNAMENTS_FULL_PAGE to any value to promote to a dedicated page + nav link.
TOURNAMENTS_LIST_HTML: ""
TOURNAMENTS_FULL_PAGE: ""
```

**NGMA specifics:** Full page is correct (21 entries, ATA class-level designations
need display room, useful to link from social posts). Scrape data already captured
— 14 events in 2026 (June–December), 7 in 2027. No registration links on source
page; add a "contact us to register" note.

---

## 8. ~~em color on dark sections fails contrast when primary is a dark color~~ ✅ FIXED 2026-06-08

**Discovered:** ramires-ata build (2026-06-08)
**Lighthouse impact:** Color contrast failure — `#043DC2` blue on `#0f172a` = 2.08:1 (needs 3:1 for large text)

`.mission-inner h2 em` and `.final-inner h2 em` are set to `color: var(--primary)`.
This works for schools with a light primary (NGMA red passes easily) but fails for
any school with a dark primary color (navy blue, dark green, etc.).

**Fix:** Change the default in `index.html` for both rules to `var(--white)` so it
always passes on the dark `var(--dark)` section backgrounds. Per-client override is
straightforward if a specific accent is wanted.

```css
/* Before */
.mission-inner h2 em { color: var(--primary); font-style: normal; }
.final-inner h2 em   { color: var(--primary); font-style: normal; }

/* After */
.mission-inner h2 em { color: var(--white); font-style: normal; }
.final-inner h2 em   { color: var(--white); font-style: normal; }
```

**Note:** For ramires-ata specifically, `#7BAEFF` (light sky-blue) was used as a
brand-appropriate compromise. The template default should be `var(--white)`; clients
with a light primary can override to `var(--primary)` during the build review.
