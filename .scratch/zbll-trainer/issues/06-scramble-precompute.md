# 06 — Precomputed scrambles

Status: ready-for-human

## What to build

A Node script producing `data/scrambles.json`: roughly 20 scrambles per case, spread across the four AUF rotations, generated at build time so the shipped app carries no solver.

The method is established in `scripts/spike2.mjs`. The solver is deterministic, so repeated calls return an identical scramble. Variety comes from a random prefix: take nine random moves, solve the state they produce, then append the inverted solution of the target state. Verified at 8 distinct out of 8, every one reproducing the target state, around 3ms each. A full run for all 472 cases takes well under a minute.

The scramble does not need to preserve F2L throughout, only to end with F2L solved and the last layer in the target case. That is what makes a genuinely random-looking 20 to 30 move scramble possible, rather than a short last-layer sequence that telegraphs the case.

Known rough edge: the simplifier leaves degenerate artifacts such as a face turned four times, and doubled turns written with a prime. Post-process to remove them and re-cancel. A human should never see a four-fold turn in a scramble.

## Acceptance criteria

- [ ] Roughly 20 scrambles per case, spread across the four AUFs, each tagged with the AUF it produces
- [ ] Every scramble verified in-script to reproduce its target state
- [ ] No degenerate four-fold turns and no primed double turns in the output
- [ ] Scrambles are between roughly 15 and 35 moves
- [ ] No duplicate scrambles within a case
- [ ] Output is a static JSON asset the app fetches; no solver in the client bundle

## Blocked by

- Issue 02

