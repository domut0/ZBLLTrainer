# 10 — Algorithm sets become first-class

Status: ready-for-agent

## What to build

A prefactor. Nothing new is visible to the user; the app becomes able to hold
more than one algorithm set without any of the later sets existing yet.

Today "ZBLL" is not a concept in the code — it is an assumption. `CaseSet` is
the seven ZBLL subsets, `cases.json` is a flat array, browse and drill and stats
and the pool filter all read that array directly, and IndexedDB keys are bare
case ids. Every one of those has to learn that a case belongs to an *algorithm
set*, of which ZBLL is currently the only one.

The distinction that matters: a **set** (ZBLL, COLL, LXS, EO, ZBLS) is a body of
cases with its own source data, its own validity rule and its own diagram style.
A **subset** (T, U, L, H, Pi, S, AS) is a grouping *within* a set. The seven
existing `CaseSet` values are subsets and should be renamed to say so.

After this lands the app must be indistinguishable from before: 472 cases, the
same browse screen, the same drill, the same stats, the same ticks. A set picker
exists and offers exactly one choice.

Progress is keyed by derived case id, so nothing already ticked is lost — but
prove that rather than assert it. Ids must not change.

## Acceptance criteria

- [ ] `data/SCHEMA.md` amended deliberately, in the style of the `facelets`
      amendment: a set identifier on every case, and a statement of what varies
      per set (validity rule, diagram representation, subset vocabulary)
- [ ] `cases.json` carries the set on each case; the importer emits it
- [ ] `src/data/types.ts` follows the amended schema, with `CaseSet` renamed to
      reflect that those seven values are ZBLL subsets
- [ ] Browse, case detail, drill, stats and the pool filter are set-aware rather
      than assuming one flat case list
- [ ] A set picker exists in the UI and currently offers only ZBLL
- [ ] Storage keys are unchanged for existing ZBLL cases — an existing user's
      ticks and attempts survive, covered by a test that loads a pre-migration
      record
- [ ] `npm run data` still reports 472/472, 0 rejects, PASS, PASS
- [ ] `npm test` green, `npm run typecheck` clean, production build clean
- [ ] No new diagram code — `LLDiagram` is untouched by this issue

## Blocked by

- None - can start immediately
