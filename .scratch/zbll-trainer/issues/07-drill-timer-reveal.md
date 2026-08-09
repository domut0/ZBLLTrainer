# 07 — The drill loop: scramble, time, reveal

Status: ready-for-agent

## What to build

The core loop, end to end: a scramble appears, you apply it to the cube, hold to ready and release to start, recognise the case, execute, tap to stop, the time is recorded, and the case, diagram and algorithm are revealed automatically. Then the next scramble.

**The reveal must AUF-correct the algorithm.** Each case is served in a random AUF. The spreadsheet's algorithms are written for one specific orientation, and the importer stores a per-algorithm AUF offset for exactly this purpose. The displayed algorithm must be adjusted for the orientation actually served. Printing the stored string verbatim shows an algorithm that does not solve the cube in the user's hands — this is the bug the whole feature exists to avoid, it is invisible in code review, and it is infuriating at the table.

Random AUF is deliberate. In a real solve you do not choose the angle, so recognising the case and knowing its AUF is one skill, not two.

Attempts record time only. No success or fail, no DNF, no penalties. A blanked case shows up as a long attempt against a short median, which is honest and costs no extra button press on a loop run hundreds of times per session. There is one discard action for dropped cubes and misscrambles.

Phone input: hold to ready with the conventional short delay, tap anywhere to stop. The timer area is a large tap target that never scrolls or selects text. Reaching for the phone adds a consistent overhead to every attempt, which is fine, because every comparison this app makes is case against case and constant overhead cancels out.

## Acceptance criteria

- [ ] Serves a random scramble from the active pool at a random AUF
- [ ] Hold to ready, release to start, tap to stop
- [ ] Attempt written to IndexedDB with case id, milliseconds, timestamp and served AUF
- [ ] Auto-reveal shows case name, diagram at the served AUF, and the AUF-corrected algorithm
- [ ] Asserted in tests, not eyeballed: for a sample of cases and AUFs, the revealed algorithm applied to the served scramble solves the cube
- [ ] Discard removes the most recent attempt
- [ ] Timer area never scrolls the page or selects text on touch
- [ ] An empty pool shows a useful message pointing at browse, not a crash

## Blocked by

- Issue 04, Issue 06

