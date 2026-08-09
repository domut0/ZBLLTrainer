# 04 — Browse all cases and tick the ones you know

Status: ready-for-agent

## What to build

The reference half of the app, end to end: navigate the 472 cases by set and group, see each one's diagram, and tick the ones you have learned. Ticks persist across reloads.

The tick is not a progress badge. It is the drill pool selector that Issue 07 draws from, which makes it the most important control in the app.

Navigation: seven sets (T, U, L, H, Pi, S, AS), then groups within a set, then a grid of case thumbnails. A filter shows all, ticked, or unticked. Ticking works directly from the grid without opening a case.

Persistence is IndexedDB through a small typed wrapper that Issues 07 and 08 will also use. Progress records are keyed by canonical case id, so re-importing `cases.json` never orphans a tick.

Phone ergonomics: thumb-reachable controls, large tap targets, no hover-dependent affordances.

## Acceptance criteria

- [ ] All 472 cases reachable by set and group
- [ ] Grid shows diagram thumbnails; ticked state visible at a glance
- [ ] Tick toggles from the grid and survives a reload
- [ ] Filter: all, ticked, unticked
- [ ] Per-set and per-group counts of ticked cases
- [ ] IndexedDB wrapper is typed, reusable, and keyed by canonical case id
- [ ] Usable one-handed at a 375px viewport width

## Blocked by

- Issue 01, Issue 02, Issue 03

