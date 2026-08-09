# Lock In

A personal, offline-first PWA for drilling ZBLL. Phone-first, single user, no
backend, no accounts.

Two halves. **Browse** all 472 cases and tick the ones you know. **Drill** random
scrambles from the ticked pool, timed, with the case revealed afterwards.

Live at **https://domut0.github.io/ZBLLTrainer/**. Install it from the browser's
"Add to Home Screen" and it works with no network at all.

The product decisions, and just as importantly the explicit non-goals, are in
[`.scratch/zbll-trainer/PRD.md`](.scratch/zbll-trainer/PRD.md). That non-goals
list is the result of a long design interview; it is not a backlog.

## Running it

```bash
npm install
npm run dev
```

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # production build into dist/
```

## The build-time pipeline

The app ships two static data files. Neither is generated at runtime — there is
no solver in the client bundle, which is what keeps the drill screen instant and
the install small.

```bash
npm run data
```

That runs all three steps in order:

| Step | What it does |
|---|---|
| `scripts/import-cases.mjs` | Seven CSVs in `data/source/` → `data/cases.json`. Expect **472/472, 0 rejects**. |
| `scripts/verify-facelets.mjs` | Independently cross-checks the diagrams. Expect **PASS**. |
| `scripts/verify-scrambles.mjs` | Independently cross-checks the scrambles. Expect **PASS**. |

`scripts/precompute-scrambles.mjs` regenerates `data/scrambles.json` (about 9,440
scrambles). It is slow and rarely needs re-running, so it is not in `npm run data`
— run it directly after changing the case set.

`scripts/gen-move-tables.mjs` regenerates `src/cube/moves.generated.ts`, the move
tables the browser uses to validate a pasted algorithm. Only needed if cubing.js
is upgraded.

`data/SCHEMA.md` is the contract between these scripts and the app. Read it
before changing either side.

### If you edit the spreadsheet

Fix the source sheet, re-export the seven CSVs into `data/source/`, then
`npm run data`. Case identity is derived from the last-layer state rather than
from row order, so re-importing **never orphans a tick** — your progress keys on
what a case *is*, not where it sat in the sheet.

## Deploying

Pushing to `main` deploys automatically: `.github/workflows/deploy.yml` builds
and publishes to GitHub Pages. Anything merged to `main` is on the phone within
about a minute, so review before merging.

The one step that needed a human was authenticating the GitHub CLI, since it
takes your own credentials:

```bash
gh auth login
```

That is already done for this repo, and the remaining setup — creating the repo,
pushing, and enabling Pages with the Actions build type — is complete. If you
ever need to redo it on a fresh machine, after `gh auth login` it is:

```bash
gh repo create ZBLLTrainer --public --source=. --remote=origin --push
gh api --method POST /repos/OWNER/ZBLLTrainer/pages -f build_type=workflow
```

Note that `deploy.yml` triggers on `main` only.

## Backing up your progress

Progress and attempts live in IndexedDB, and **browser storage gets cleared** —
by the browser, by a "clear site data", by reinstalling the PWA. There is no
server-side copy and never will be.

Settings → Export downloads a JSON file. Import restores it. That file is the
difference between a bad week and losing two years of work. Take one
occasionally.

## Layout

```
data/           cases.json, scrambles.json, SCHEMA.md, and the source CSVs
scripts/        build-time pipeline, plus the spikes that established how it works
src/cube/       a move applier for validating pasted algorithms — no solver
src/data/       typed access to the shipped data
src/storage/    IndexedDB, and the export/import format
src/drill/      the AUF-corrected reveal
src/stats/      medians, derived from attempts on read
src/components/ the UI
```

## Things that will bite you

These cost real time to discover. `HANDOFF.md` has the full list; the two worst:

**The spreadsheet omits the trailing AUF.** Alternative algorithms on a row do
not solve the same cube state — they reconcile only under a *post*-AUF. Case
identity has to canonicalise over the four U rotations, and every stored
algorithm carries the offset that was recovered.

**Every case is served at a random AUF, so the reveal must correct the
algorithm.** Printing the stored string verbatim shows an algorithm that does
not solve the cube in your hands. It is invisible in code review and infuriating
at the table. `src/drill/reveal.ts` does the correction; `reveal.test.ts` asserts
it against real scrambles *and* includes negative controls, because a test that
only ever checks AUF 0 passes whether or not the correction works.
