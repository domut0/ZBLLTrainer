# 05 — Case detail and choosing your algorithm

Status: ready-for-agent

## What to build

The detail view for one case: large diagram, the algorithm you have chosen, the alternatives from the spreadsheet listed below it, and the ability to change which one is yours or paste your own.

The spreadsheet is a build input and is never written back to. Your choice and any custom algorithm live in IndexedDB alongside the tick. The default primary is the first alternative in the sheet row.

A pasted custom algorithm is validated the way the importer validates: parse it, apply its inverse, confirm it produces this case. Reject with a clear message rather than silently storing something that does not work.

## Acceptance criteria

- [ ] Large diagram, display name, set and group shown
- [ ] Primary algorithm displayed prominently, alternatives listed below
- [ ] Tapping an alternative makes it primary and persists the choice
- [ ] Free-text field accepts a custom algorithm
- [ ] Custom algorithm validated against the case, rejected with a reason if it does not solve it
- [ ] Tick control present here too
- [ ] Reverting to the sheet default is possible

## Blocked by

- Issue 04

