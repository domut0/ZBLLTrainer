# ZBLL Trainer — PRD v1

**Status:** design locked, not started
**Date:** 2026-08-08
**Owner:** personal project, single user

---

## 1. What this is

A personal, offline-first PWA for learning and drilling ZBLL. It does two things:

1. **Browse** all 472 ZBLL cases, see each case's diagram and algorithm, and tick the ones you've learned.
2. **Drill** — serve a random scramble drawn from the ticked cases, time your execution, reveal the case afterward, and track which cases are slowest.

It is built around one personal dataset: the seven-sheet "the great zbll lock in" spreadsheet, imported once at build time.

## 2. What this is explicitly not

These were considered and cut. They are listed so they don't creep back in.

| Not building | Why |
|---|---|
| A general speedcubing timer | cstimer exists, is free, and wins on scramble correctness. No sessions, no Ao5/Ao12, no PBs, no WCA events. |
| A "learn a new case" mode | Learning happens outside the app. The app is review-only. |
| Recognition-name quizzing ("which case is this?") | Trains diagram→name, a skill that doesn't exist at the table. Real recognition is diagram→fingers. |
| A virtual cube / move simulator | You own a cube. |
| Bluetooth smart cube support | A month of protocol reverse-engineering for a personal app. |
| Spaced repetition (SM-2 / FSRS) | SRS solves retention of rarely-seen items. ZBLL is hundreds of reps per session on a pool you see constantly; a scheduler would spend its life marking cases "due" four minutes after you did them. Biggest available tarpit. |
| Accounts, sync, any backend | Keeps it free to run forever and eliminates the auth/hosting/privacy surface. |
| Success/fail marking on attempts | Time alone is honest. A blanked case shows up as a 9s attempt against a 2s median. An extra button press on a loop you run hundreds of times per session is a button press you will start lying to. |
| The 21 PLL cases | Already known, not part of this lock-in, and absent from the source sheet. Data model can hold them; v1 ships without. |
| Writing back to the Google Sheet | One-way. Sheet is a build input. |

## 3. Context

- **Device:** phone, primary and near-exclusive. Mobile-first layout, touch-first input.
- **Cube orientation:** yellow top, green front, white bottom. Fixed. All scrambles and diagrams assume it.
- **Starting state:** the pool is empty. Every `Progress` cell in all seven sheets is `FALSE`. The browse/tick half of the app is useful on day one; the drill half becomes useful somewhere around 8–10 ticked cases. This drives the build order in §10.

## 4. Core loop

```
scramble on screen
  → apply it to the cube
  → hold the timer area, release to start
  → recognise the case
  → execute
  → tap to stop
  → time recorded
  → case name, diagram, and your algorithm revealed automatically
  → next scramble
```

Notes:

- **Auto-reveal doubles as the correctness check.** If your cube isn't solved and the diagram says it should be, you know immediately.
- **One "discard last" action** for dropped cubes and misscrambles. No DNF, no +2, no penalty concept.
- **Timing overhead is irrelevant.** Reaching for the phone costs ~0.5s per attempt. Every comparison this app makes is case-against-case, never against a real solve time, so consistent overhead cancels out.

### Case selection

- **Default: uniform random** over the active pool. Unbiased mixing is what recognition practice needs.
- **Subset filter:** the pool is `ticked` optionally intersected with a set or group — "all my ticked cases," "my ticked Pi cases," "Pi3: Lines only." This is how the app gets used 90% of the time in year one.
- **"Slowest 15" mode:** an explicit mode, not a default weighting. Mixing everything and grinding your worst are different sessions with different goals; the app should be told which, not guess.

### AUF

**Every case is served in a random AUF.** In a real solve you don't choose the angle — F2L finishes and the last layer sits in whichever of four rotations it landed in. Recognising the case and knowing the AUF is one skill.

Consequence: **ticking a case means you know it from all four angles.** That's the intended bar.

Consequence: **the reveal must recompute the AUF prefix.** If the sheet says `[U2] R' U' R U' R' U2 R` and the drill served that case rotated, printing the sheet string verbatim shows an algorithm that does not solve the cube in front of you. Store the algorithm core plus its canonical AUF as an integer; compute the displayed prefix from the served AUF.

If random AUF is brutal in the first weeks, the escape hatch is the subset filter — drill three cases at a time. Not a fixed-AUF mode. Don't add a second mechanism.

## 5. Screens

**Browse.** Set → group → case grid. Each cell is a rendered LL diagram plus a tick control. Filter to show all / ticked / unticked. This is the screen that replaces opening the Google Sheet on your phone.

**Case detail.** Large diagram, your primary algorithm, alternates from the sheet collapsed below it, a "make this my alg" tap on any alternate, a free-text field to paste one the sheet doesn't have, and the tick.

**Drill.** Scramble, big timer area, nothing else. Post-stop it becomes the reveal: case name, diagram, your algorithm (AUF-corrected), time, and discard.

**Stats.** One table. Per case: attempts, median of last 12. Sortable by median. This table is the data source for "slowest 15." No charts, no history graphs.

**Settings.** Pool filter, export data, import data.

## 6. Data model

### Shipped (static, build-time)

```ts
Case {
  id            // canonical, derived from the last-layer state
  set           // 'T' | 'U' | 'L' | 'H' | 'Pi' | 'S' | 'AS'
  group         // "Pi3: Lines"  — from the sheet
  indexInGroup  // 1-based
  displayName   // "Pi3: Lines #4"
  state         // corner orientation + corner permutation + edge permutation
  algs: [{ core: string, canonicalAuf: 0|1|2|3 }]
}
```

```ts
scrambles: { [caseId]: [{ scramble: string, auf: 0|1|2|3 }] }   // ~20 per case
```

### Local (IndexedDB)

```ts
Progress { caseId, learned: boolean, primaryAlgIndex: number, customAlg?: string }
Attempt  { id, caseId, ms, at, auf }
```

Derived at read time: median of the last 12 attempts per case.

**Case identity is derived from the algorithm, not from the sheet.** The sheet has no case IDs, no images, and no join key — group label plus row position is all there is. So the importer applies each algorithm's inverse (AUF prefix included) to a solved cube, reads the resulting last-layer state, and uses that as identity. This is not a nicety; it is the only way to know what any row is. It also means **re-running the import never clobbers your progress**, because ticks key on derived identity rather than row order.

## 7. Build-time pipeline

Two Node scripts, both committed, both re-runnable.

### 7a. Import

CSV × 7 → `cases.json`.

- Skip 3 junk rows; header is row 4: `COLL set | Images | 3x3 algorithm | OH algorithm | Progress`.
- **The `Images` column is empty in all seven exports** — the diagrams are floating objects in the Google Sheet and CSV export drops them. There is no image fallback. All diagrams are rendered from state.
- **Ignore the `OH algorithm` column entirely.** Not learning one-handed. This also removes every `Same as the 2nd one` cross-reference, which was the messiest part of the parse.
- Group labels appear only on the first row of each group; carry them forward.
- Split multi-line alg cells on newline; each line is one alternative.
- **The `[U]` / `[U'] `/ `[U2]` prefix is part of the algorithm**, not decoration. Stripping it lands every prefixed row on an AUF-rotated state and silently produces the wrong case. This is the single most likely way the import quietly corrupts itself.
- Parse notation with `@cubing/alg` — handles wide moves, slices, rotations, `R2'`, and parenthesised groups natively.
- Validate: every algorithm must produce a legal ZBLL state (all LL edges oriented, F2L untouched), and all algorithms in a row must produce the *same* state.

**The reject list is a deliverable, not a surprise.** Expect a handful of the 472 rows to fail on first run. Known offenders already spotted in the source: a Unicode curly apostrophe (`R’`) in the H sheet, a zero-width non-joiner before `[U2]` in the L sheet, `R3'` where `R'` was meant in the AS sheet, and trailing `/ r'` fingertrick-variant fragments throughout. The script prints set, group, row index, and reason. You fix the sheet, re-export, re-run.

Expected output: **472 cases** — six sets of 72 plus H at 40. (The H sheet's header says "0/72"; that's a copy-paste artifact.)

### 7b. Scramble precompute

`cases.json` → `scrambles.json`.

For each case, generate ~20 scrambles spread across the four AUFs (roughly 5 each) by building the target state, solving it, and inverting the solution. Store each scramble alongside the AUF it produces.

**This runs in Node, not the browser.** Doing it at runtime would mean shipping cubing.js's WASM solver — 1–2 MB, slow cold start, and a performance risk on the one screen that has to feel instant. Precomputing makes the runtime app a pure static site with no solver at all. Twenty variants per case is far more than enough to prevent memorising the scramble instead of reading the cube.

Size estimate: 472 × 20 × ~50 bytes ≈ 470 KB raw, well under 150 KB gzipped.

Spreading the AUF across the precomputed set (rather than appending a random `U` suffix at runtime) avoids every scramble ending in a U move.

## 8. Runtime architecture

- **Vite + React + TypeScript + Tailwind.** No meta-framework. Zero server-side anything; TanStack Start or Next would be pure overhead.
- **`vite-plugin-pwa`** for service worker and manifest. Fully offline after install — everything is static.
- **IndexedDB** via Dexie or `idb`. Attempt rows accumulate indefinitely; localStorage's 5 MB synchronous cap would work for a while and then hurt.
- **Diagrams rendered as SVG from state.** No image assets, no scraping, no alignment work, and the style is one code change away from being anything else.
- **Wake Lock API** on the drill screen. A phone that sleeps mid-session kills the loop.
- Timer area: large tap target, `touch-action: none`, haptic on start and stop.

### Export / import

One-tap "download my data" producing JSON of progress + attempts, and a matching import. **This matters more than it sounds.** This is browser storage on a PWA, and browser storage gets cleared. The export is the difference between a bad week and losing two years of progress.

## 9. Locked design decisions

Recorded so they aren't relitigated.

1. Trainer, not a timer. cstimer is not the target.
2. Review-only. No learn mode.
3. Cases derived from algorithms, not from sheet naming.
4. Diagrams rendered from state, not sourced as images.
5. Attempts record time only. No success/fail.
6. Uniform random selection, filterable, plus an explicit slowest-N mode.
7. Random AUF always; reveal recomputes the prefix.
8. Scrambles precomputed at build time.
9. Local storage only. No accounts, no sync.
10. One-way data flow from the sheet.

## 10. Build order

Ordered so each phase is useful before the next exists.

**Phase 0 — trustworthy data.** Import script, validation, reject list cleared. Nothing renders yet. This is the phase that de-risks everything else, and the only one with a real unknown (see §11).

**Phase 1 — browse and tick.** Set/group navigation, SVG diagrams, case detail, primary-alg selection, IndexedDB progress. *Ships the thing originally asked for.* Useful immediately, while the pool is still empty.

**Phase 2 — drill.** Scramble precompute, drill screen, hold-to-start timer, attempt recording, auto-reveal with AUF correction, discard.

**Phase 3 — stats.** The one table. Median of last 12. Slowest-15 mode.

**Phase 4 — PWA polish.** Offline, install, wake lock, export/import.

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Scramble precompute in Node doesn't work cleanly with cubing.js | **Highest — the only real technical unknown.** Everything else is CRUD. | Spike this in Phase 0, before writing any UI. If it fails, the fallback is a min2phase port, which is a known quantity but more work. |
| Reject list much larger than a handful | Medium — turns Phase 0 into manual data entry | Fix in the Google Sheet, not in the JSON, so the fix survives re-import |
| Random AUF makes early drilling demoralising | Low | Subset filter down to 3 cases |
| IndexedDB cleared, progress lost | Medium — and it depends on you actually running the export | Export is one tap; consider a nag after N sessions since last export |
| AUF prefix bug in the reveal | Medium — invisible in review, infuriating at the table | Assert in tests: reveal alg applied to served scramble must solve the cube |

## 12. Success criteria

1. All 472 rows import and validate with an empty reject list.
2. Cold open to first scramble in three taps or fewer.
3. Fifty consecutive reps without touching anything but the timer area and "next."
4. The slowest-15 list matches your gut about which cases you're worst at. If it doesn't, either the timing or the pool logic is wrong.
5. **You stop opening the Google Sheet on your phone.** This is the real one.
