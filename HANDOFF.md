# Lock In — handoff

Written 2026-08-08, when all nine issues landed. Start with `README.md` for how
to run things, and `.scratch/zbll-trainer/PRD.md` for the product decisions —
especially its non-goals list, which is the result of a long design interview
and is not a backlog.

---

## State of play

**All nine issues are done and merged.** The app is live at
**https://domut0.github.io/ZBLLTrainer/** and installs as a PWA.

| Issue | What | Written by |
|---|---|---|
| 01 | Installable app shell | `gem` |
| 02 | Case importer — 472/472, 0 rejects | Claude Code |
| 03 | Last-layer diagram from a facelet string | Claude subagent (Opus 5) |
| 04 | Browse and tick | `gem` (gemini-3.5-flash-high) |
| 05 | Case detail and algorithm choice | `gem` |
| 06 | Scramble precompute — 9440 scrambles | Claude Code |
| 07 | Drill loop, timer, AUF-corrected reveal | Claude subagent (Opus 5) |
| 08 | Pool filter and stats | `gem` |
| 09 | Export/import, wake lock, icons | `gem` |

Everything delegated was reviewed and amended before merging. The data model,
the AUF correction, the facelet derivation, the client-side cube and the storage
schema were kept in-house.

117 tests, `tsc --noEmit` clean, production build clean.

## New scope — three of five landed

Support for **COLL, ZBLS, LXS and EO** was requested on 2026-08-09. The source
CSVs are committed under `data/source/apb/`, and the research and build order are
in **`HANDOFF-ALG-SETS.md`**, which now also records what that plan got wrong.
Winter Variation and Summer Variation were explicitly dropped.

Broken into Issues 10-15 under `.scratch/zbll-trainer/issues/`. Landed on
branches `issue-10-alg-sets`, `issue-11-coll`, `issue-12-lxs`, stacked in that
order and **not yet merged to `main` or pushed**:

| Issue | What | Written by |
|---|---|---|
| 10 | Algorithm sets first-class (prefactor) | Claude Code |
| 11 | COLL — 40 cases derived from ZBLL | `gem` (gemini-3.5-flash-high), amended |
| 12 | LXS — 116 cases, stage diagram | `gem` (gemini-3.6-flash-high), amended |
| 13 | EO | not started |
| 14 | ZBLS | not started |
| 15 | Bump GitHub Actions to v5 | not started |

628 cases, 1714 algorithms, 153 tests. `npm run data` now runs four scripts: the
two original verifies plus one per derived set.

**The lesson from 11 and 12, which 13 and 14 will re-pose:** both delegated
passes shipped an over-specified case identity, and both had a green test suite.
A case is only the pieces the set actually solves — COLL ignores edge
permutation, LXS ignores the whole last layer. Settle that by measuring the
source sheet's own alternatives against each other before writing the importer,
and verify exhaustively rather than by sampling.

## Verify what you inherit

```bash
npm install
npm run data      # importer + both cross-checks. Expect 472/472, 0 rejects, PASS, PASS
npm test          # 117 tests
npm run typecheck
```

## Hard-won knowledge — do not rediscover this

Four spike rounds (`scripts/spike*.mjs`, kept deliberately) found things that
each silently corrupt the dataset. All are handled in `scripts/import-cases.mjs`.

**1. The spreadsheet omits the trailing AUF.** Alternative algorithms on a row do
not solve the same cube state. They reconcile under a *post*-AUF only. Case
identity must canonicalise over the four U rotations.

**2. Corrections apply to the LEFT of the inverted algorithm.** The case state is
`solved.applyAlg(alg.invert())`, so AUF and rotation corrections must be
*prefixed*, not appended. Getting this backwards produced 266 false rejects and
looked exactly like "the spreadsheet is full of errors." It wasn't.

**3. Algorithms containing `x`/`y`/`z` end in a rotated frame** — and so do wide
moves, which carry a rotation with them. Corrected by brute-forcing 24 rotations
× 4 AUFs as prefixes. 10 of the 977 algorithms need this.

**4. The solver is deterministic.** Variety comes from a random 9-move prefix,
then solving back to the target. See `scripts/spike2.mjs`.

**5. A bad alternative must not sink its case.** 19 rows have alternatives in
exotic notation the importer misreads. The first algorithm establishes identity;
disagreeing alternatives are dropped and logged to `data/rejects.json`.

**6. Never derive sticker colours by hand.** This is what stalled the first
attempt at Issue 03. `scripts/facelets.mjs` derives them from cubing.js's own
PuzzleGeometry, after checking PG agrees with the importer's kpuzzle on all six
face generators. The one remaining convention — which way orientation twists —
is *solved for* against physical anchors rather than assumed.

**7. scrambles.json is grouped by AUF.** The first five entries of every case are
all `auf: 0`. Taking the first N scrambles therefore tests only the orientation
that needs no correction — the one that passes whether or not your AUF code
works. This silently weakened two tests before it was caught. Sample one per AUF.

## The trap, and how it is handled

Every case is served at a random AUF, and **the reveal must correct the
algorithm for the orientation actually served**. Printing the stored string
verbatim shows an algorithm that does not solve the cube in the user's hands.
It is invisible in code review and infuriating at the table.

`src/drill/reveal.ts` derives it: `U^-auf . alg . U^-aufOffset`. A pre-AUF for
the orientation served, a post-AUF for the one the spreadsheet dropped.

It is checked three ways: `scripts/spike6-auf-reveal.mjs` across 3908 real
case/algorithm/AUF combinations; `src/drill/reveal.test.ts` with **negative
controls** that fail if either correction is dropped; and end-to-end against the
running app, taking the displayed scramble and the displayed algorithm and
confirming in cubing.js that they solve the cube.

**Keep the negative controls.** Without them a test that only exercises AUF 0
passes whether or not the correction works.

## Architecture, settled

- Vite + React + TS + Tailwind + `vite-plugin-pwa`. No meta-framework.
- `data/cases.json` and `data/scrambles.json` are static build artefacts.
  **No solver ships in the client bundle** — verified: the built JS contains no
  cubing.js. The 1.4 MB bundle is the data (964 kB scrambles, 285 kB cases),
  212 kB gzipped, precached for offline.
- `src/cube/` is a ~150-line move applier for validating a pasted algorithm. Its
  move tables are *generated* from cubing.js, and `apply.test.ts` checks the two
  agree on all 977 real algorithms.
- IndexedDB for progress and attempts, keyed by canonical case id, so
  re-importing never orphans a tick.
- Stats are derived from attempts on read, never stored.
- Fixed orientation everywhere: yellow top, green front.
- `data/SCHEMA.md` is the contract between the build scripts and the app.

## Working practices the user expects

- **Announce every delegation**, naming the tool and the model.
- **Ask before spawning a Claude subagent**, and recommend a model.
- Never delegate architecture, debugging, data models, or business logic.
- **Git isolation around every `gem` write**: clean tree, own worktree, review
  the diff.
- **`gem` exits 0 even when it did nothing useful.** On this project it claimed
  `tsc --noEmit` exited 0 when it did not, and overcounted its own tests. Read
  the output and re-run every command yourself.
- Roughly equal use of gemini and Claude subagents.

## Repo

`C:\dev\ZBLLTrainer`, branch `main`, remote `origin` → `domut0/ZBLLTrainer`
(public). Pushing to `main` deploys to Pages automatically, so review before
merging.

The workflow logs a Node 20 deprecation on `actions/checkout@v4`,
`setup-node@v4`, `upload-artifact@v4` and `deploy-pages@v4`. Harmless today;
bump to `@v5` eventually. That is the only known outstanding item.
