# 08 — Pool filtering and the stats table

Status: ready-for-agent

## What to build

Two things sharing one data source.

**Pool selection.** The drill draws uniformly at random from ticked cases, optionally intersected with a set or a group. Uniform is the default because unbiased mixing is what recognition practice needs. Plus one alternative mode, slowest fifteen, restricting the pool to the ticked cases with the worst medians.

Explicitly not building a spaced-repetition scheduler. Mixing everything and grinding your worst are different sessions with different goals; the app is told which, it does not guess.

**Stats.** One screen, one table. Per case: attempt count and median of the last twelve attempts, sortable by median. Median rather than mean, so a single blank-out does not define a case forever. This table is the data source for slowest fifteen.

No charts, no session history, no rolling averages, no personal bests. Every one of those makes this feel like a general timer, which it explicitly is not.

## Acceptance criteria

- [ ] Pool filter: all ticked, or ticked within a chosen set or group
- [ ] Uniform random selection from the active pool
- [ ] Slowest-fifteen mode restricts the pool by median
- [ ] Stats table shows case, attempts and median of last twelve, sortable
- [ ] Cases with no attempts are shown as such, not as zero
- [ ] Aggregates computed from stored attempts rather than separately maintained
- [ ] Filter choice persists between sessions

## Blocked by

- Issue 07

