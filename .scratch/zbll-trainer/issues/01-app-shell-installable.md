# 01 — Installable app shell, deployable

Status: ready-for-agent

## What to build

A Vite + React + TypeScript + Tailwind app called **Lock In**, configured as an installable PWA, with a GitHub Pages deploy workflow. It renders a single placeholder screen. This is the tracer bullet for the build/deploy/install path: nothing else can be verified on a phone until this works.

Mobile-first. The only viewport that matters is a phone held in one hand.

## Acceptance criteria

- [ ] `npm run dev` serves the app; `npm run build` produces a static `dist/`
- [ ] `vite-plugin-pwa` generates a service worker and manifest; app works offline after first load
- [ ] Manifest: name "Lock In", standalone display, portrait, dark theme colour
- [ ] Vite `base` is configurable so GitHub Pages subpath hosting works
- [ ] `.github/workflows/deploy.yml` builds and publishes `dist/` to Pages on push to main
- [ ] Tailwind configured; dark is the default and only theme
- [ ] `tsc --noEmit` is clean

## Blocked by

None - can start immediately.

