# Lock In — handoff

For a fresh Opus 5 agent picking this up cold. Written 2026-08-08.

**Read `.scratch/zbll-trainer/PRD.md` first**, then this. The PRD has the product
decisions and, just as importantly, the explicit non-goals — that list is the
result of a long design interview and should not be relitigated.

---

## What this is

A personal, offline-first PWA for drilling ZBLL. Phone-first, single user, no
backend, no accounts. Two halves: browse 472 cases and tick the ones you know;
drill random scrambles from the ticked pool, timed, with the case revealed after.

Source data is the user's own spreadsheet, imported at build time.

## State of play

| Issue | What | Status |
|---|---|---|
| 01 | Installable app shell | **Done**, merged. Written by `gem`, verified by Claude |
| 02 | Case importer | **Done**, merged. 472/472, 472 unique ids, 0 rejects |
| 03 | LL diagram renderer | **Not started — agent stopped.** A Claude Sonnet subagent was killed mid-task on 2026-08-08. Branch still at `7ce28a1`, nothing committed, only an untracked `scripts/derive-tmp.mjs` left behind. The worktree is free; take it or delete it. **Read "Why 03 stalled" below before retrying** |
| 06 | Scramble precompute | **Done**, merged. 9440 scrambles, independently verified |
| 04, 05, 07, 08, 09 | Browse/tick, case detail, drill loop, stats, durability | **Not started** |

Issue files are in `.scratch/zbll-trainer/issues/`, dependency-ordered, written as
vertical tracer-bullet slices. `Status:` lines mark which are agent-ready.

Verify what you inherit before building on it:

```bash
node scripts/import-cases.mjs      # expect 472/472, 0 rejects
node scripts/verify-scrambles.mjs  # expect PASS
```

## Hard-won knowledge — do not rediscover this

Four spike rounds (`scripts/spike*.mjs`, kept deliberately) found three things
that each silently corrupt the dataset. All are handled in `scripts/import-cases.mjs`.

**1. The spreadsheet omits the trailing AUF.** Alternative algorithms on the same
row do not solve the same cube state. They reconcile under a *post*-AUF only —
verified by brute force as `U2`, `U'` or none, never a pre-AUF. Case identity must
canonicalise over the four U rotations.

**2. Corrections apply to the LEFT of the inverted algorithm.** This is the one
that will bite you. The case state is `solved.applyAlg(alg.invert())`. Because of
that inversion, the AUF and rotation corrections must be *prefixed*, not appended
to the resulting pattern. Getting this backwards produced 266 false rejects and
looked exactly like "the spreadsheet is full of errors." It wasn't.

**3. Algorithms containing `x`/`y`/`z` end in a rotated frame.** Corrected by
brute-forcing 24 rotations × 4 AUFs as prefixes and keeping whatever lands legal
(F2L intact, LL edges oriented).

**4. The solver is deterministic.** Calling it repeatedly returns the identical
scramble. Variety comes from a random 9-move prefix, then solving back to the
target. See `scripts/spike2.mjs`. The scramble need not preserve F2L throughout,
only end with it solved — which is what allows a natural-looking 15-35 move
scramble instead of a short last-layer sequence that telegraphs the case.

**5. A bad alternative must not sink its case.** 19 rows have alternatives in
exotic notation (`l R`, `M'`, embedded rotations) the importer misreads. The first
algorithm establishes identity; disagreeing alternatives are dropped and logged to
`data/rejects.json`. Do not "fix" this by rejecting the case.

## Why 03 stalled, and how to unblock it

The stopped agent was trying to derive, by hand, which sticker colour each corner
and edge shows given the orbit arrays in `cases.json`. That is fiddly 3D geometry,
it is easy to get subtly wrong, and a wrong mapping produces plausible-looking but
incorrect diagrams for all 472 cases — the worst possible failure mode, because it
looks fine until you are at the table with a cube.

**Recommendation: don't derive stickers in the component at all.** Have the
importer emit a facelet representation per case — a fixed-length string of sticker
colours — and let the diagram component read that. Then Issue 03 becomes "draw 21
coloured squares from a string" with no geometry in it.

This is the better split regardless of who implements it: the derivation happens
once, in Node, next to the importer, where it can be asserted against known cases
(a solved last layer is all-yellow on top; a Sune case has a known corner pattern).
That is testable in a way component-side geometry is not.

It does mean amending `data/SCHEMA.md`, which is currently frozen — do that
deliberately, and regenerate `cases.json` after. Ground truth for the mapping is
cubing.js's own puzzle definition, not hand-derivation; the empirical technique in
`scripts/spike.mjs` (apply a known move, diff against solved, observe what changed)
is the reliable way to pin it down.

## The trap ahead — Issue 07

Every case is served at a **random AUF**. The stored algorithms are written for one
orientation, and each carries an `aufOffset`. **The reveal must adjust the
algorithm for the orientation actually served.** Printing the stored string
verbatim shows an algorithm that does not solve the cube in the user's hands. It is
invisible in code review and infuriating at the table. Issue 07's acceptance
criteria require this to be *asserted in a test*, not eyeballed. Honour that.

## Architecture, settled

- Vite + React + TS + Tailwind + `vite-plugin-pwa`. No meta-framework — zero
  server-side anything.
- `data/cases.json` and `data/scrambles.json` are static build artifacts. **No
  solver ships in the client bundle.**
- IndexedDB for progress and attempts, keyed by canonical case id so re-importing
  never orphans a tick. Export/import is the only backup — browser storage gets
  cleared.
- Fixed orientation everywhere: yellow top, green front.
- `data/SCHEMA.md` is the frozen contract between the build scripts and the app.

## Working practices the user expects

From their global `CLAUDE.md`, and they care about these:

- **Announce every delegation**, naming the tool and the model.
- **Ask before spawning a Claude subagent**, and recommend a model.
- Never delegate architecture, debugging, data models, or business logic. The
  importer is the data model — it stays in-house.
- **Git isolation around every `gem` write**: clean tree, own worktree/branch,
  review the diff. Worktrees already exist for 01, 03 and 06; clean up merged ones
  with `git worktree remove`.
- **`gem` exits 0 even when it did nothing useful.** Never trust the exit code.
  Read the output and verify the claims yourself — that is how the scramble
  cross-check in `scripts/verify-scrambles.mjs` came about, and it is worth
  writing an equivalent for anything else delegated.
- They want gemini and Claude subagents used in roughly equal measure.

## Hosting — no longer blocked

Resolved 2026-08-08. `gh` is authenticated as `domut0` (scopes `gist`, `read:org`,
`repo`, `workflow`). The repo is public at
**https://github.com/domut0/ZBLLTrainer** and Pages is live at
**https://domut0.github.io/ZBLLTrainer/**, served from the GitHub Actions build.

`deploy.yml` triggers on pushes to `main`, so the local branch was renamed
`master` → `main`. First deploy went green in 28s; the shell renders on a 375px
viewport with no console errors. **Any merge to `main` now ships to the phone
automatically** — that cuts both ways, so review before merging.

The workflow logs a deprecation warning: `actions/checkout@v4`,
`setup-node@v4`, `upload-artifact@v4` and `deploy-pages@v4` all target Node 20 and
are being forced onto Node 24. Harmless today, worth bumping to `@v5` eventually.

A token was pasted into an earlier session's chat. It should be considered
compromised; the user has been told to revoke it. **Do not use it.** The token now
in the keyring is a different, `gh auth login` one.

## What is actually buildable

**Nothing, until Issue 03 lands.** 04 is blocked by 03; 05 by 04; 07 by 04 and 06;
08 by 07; 09 by 08. The whole remaining chain hangs off the diagram renderer, so
resist the urge to start 04 in parallel — it needs the component's real props.

Both inherited build scripts were re-verified on 2026-08-08: importer 472/472,
0 rejects, 19 alternatives dropped as designed; `verify-scrambles.mjs` PASS at
9440 scrambles, 0 mismatches.

## Repo

`C:\dev\ZBLLTrainer`, branch `main`, remote `origin` → `domut0/ZBLLTrainer`.

Worktrees `ZBLLTrainer-01` and `ZBLLTrainer-06` are merged and can be cleaned with
`git worktree remove` once no other session is using the repo. `ZBLLTrainer-03` is
live — do not touch it.
