# 03 — Last-layer diagram rendered from a facelet string

Status: ready-for-agent

**Rewritten 2026-08-08.** The original version had this component derive sticker
colours from the cube-state orbit arrays in `cases.json`. That is fiddly 3D
geometry, it is easy to get subtly wrong, and a wrong mapping yields
plausible-looking but incorrect diagrams for all 472 cases — which you only
discover with a cube in your hands. It is what stalled the first attempt.

That derivation now happens in the build (`scripts/facelets.mjs`), where it is
checked against dataset-wide invariants and the precomputed scrambles by
`scripts/verify-facelets.mjs`. **There is no cube geometry left in this issue.**

## What to build

`src/components/LLDiagram.tsx` — a React component rendering a standard ZBLL
last-layer diagram as inline SVG from a 21-character facelet string.

```tsx
<LLDiagram facelets={someCase.facelets[auf]} />
```

Read `data/SCHEMA.md` § `FaceletString` for the authoritative index layout and
colour letters, and `src/data/types.ts` for the types and the `FACELET_FILL`
palette. In short: indices 0-8 are the U face row-major (back row first, left
column first, index 4 the centre); 9-11 is the bar above the square, 12-14 the
bar to its right, 15-17 the bar below, 18-20 the bar to its left. **Every bar is
already ordered to line up with the edge of the square it touches**, so drawing
it is a direct mapping with no reordering.

Geometry: a 3×3 grid of rounded squares, with a thinner bar of three stickers
outside each of its four edges, and a gap between the square and each bar.

## Acceptance criteria

- [ ] Renders from the string alone — no image assets, no network, no cube logic
- [ ] 21 stickers: 9 on the U face, 3 per side bar, positioned per the layout above
- [ ] Colours come from `FACELET_FILL` in `src/data/types.ts`
- [ ] Scales cleanly from a 64px grid thumbnail to a full-width phone display.
      Use a `viewBox` and no fixed pixel size; the parent sizes it
- [ ] Pure and deterministic: same string always produces identical SVG
- [ ] Accessible: a `<title>` or `aria-label`, and `role="img"`
- [ ] Rejects a malformed string loudly in development rather than rendering a
      half-diagram

## Tests — `src/components/LLDiagram.test.tsx`

- [ ] A solved last layer (`'Y'.repeat(9) + 'BBB' + 'OOO' + 'GGG' + 'RRR'`)
      renders 9 yellow stickers on the face and one correctly-coloured bar per side
- [ ] Each of the 21 indices maps to a distinct, stable position — e.g. feed a
      string with a single non-yellow sticker at index *i* and assert the odd one
      out lands where the layout says, for several values of *i*
- [ ] The four AUF entries of one real case from `CASES` all render without error
      and differ from one another
- [ ] Snapshot one real case so an accidental layout change is visible in review

## Out of scope

- Ticking, selection, navigation — that is Issue 04
- Any notion of AUF beyond "the caller picks which of the four strings to pass"
- Deriving anything from `case.state`

## Blocked by

- Issue 02 (done) — supplies `facelets`
