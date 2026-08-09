# 03 — Last-layer diagram rendered from state

Status: ready-for-agent

## What to build

A React component rendering a standard ZBLL last-layer diagram as inline SVG, from a case's cube state. No image assets exist or will exist — the Images column in the source spreadsheet is empty — so every diagram in the app comes from this component.

The diagram is the conventional 21-sticker layout: the 3x3 top face, plus the three top-row stickers of each of the four side faces, drawn as bars outside the corresponding edge of the square.

Fixed orientation: yellow top, green front, standard Western scheme with white/yellow, green/blue and red/orange as opposite pairs. Because all last-layer edges are oriented in ZBLL, the four top-face edge stickers are always yellow; the corner stickers vary by orientation case.

The component takes an AUF rotation so the same case can be drawn from any of its four angles.

## Acceptance criteria

- [ ] Renders from state alone; no image assets, no network
- [ ] 21 stickers: 9 on the top face, 3 per side face
- [ ] Correct colours for a fixed yellow-top, green-front orientation
- [ ] Accepts an AUF prop of 0 to 3 and rotates the drawing accordingly
- [ ] Scales cleanly from a 64px grid thumbnail to a full-width phone display
- [ ] Pure and deterministic: the same state and AUF always produce identical SVG
- [ ] Unit tests: a known corner-orientation case renders the expected top-face pattern, and AUF rotation permutes the side bars as expected

## Blocked by

- Issue 02 (needs the state representation shape)

