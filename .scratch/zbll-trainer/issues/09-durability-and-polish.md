# 09 — Durability and phone polish

Status: ready-for-agent

## What to build

The things that make this survivable and pleasant on a phone.

**Export and import.** One tap downloads a JSON file of all progress and attempts; import restores it. This matters more than it sounds: this is browser storage on a PWA, and browser storage gets cleared. The export is the difference between a bad week and losing two years of progress. Nag gently when it has been a long time since the last export.

**Wake lock.** Hold a screen wake lock on the drill screen and release it on leaving. A phone that sleeps mid-session kills the loop.

**Icons and manifest polish.** Home-screen icons at the required sizes, generated from a simple mark. Splash colour matching the dark theme.

**README.** How to re-run the importer and the scramble precompute, and the one manual step that remains: authenticating the GitHub CLI, pushing, and enabling Pages. That step needs the user's own credentials and cannot be automated.

## Acceptance criteria

- [ ] Export produces a JSON file containing all progress and attempts
- [ ] Import restores it, with a clear warning that it replaces current data
- [ ] Round trip verified: export, clear storage, import, data identical
- [ ] Wake lock held on the drill screen and released on leaving
- [ ] Home-screen icons at required sizes; installs cleanly on Android
- [ ] README documents both build scripts and the manual deploy step

## Blocked by

- Issue 08
