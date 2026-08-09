import {
  FACELET_COUNT,
  FACELET_FILL,
  type FaceletColour,
  type FaceletString,
} from '../data/types'

/*
 * A last-layer diagram is a pure function of its 21-character facelet string.
 * There is deliberately no cube logic here: `scripts/facelets.mjs` already
 * turned the cube state into stickers, and every bar arrives pre-ordered to
 * line up with the edge of the square it touches (data/SCHEMA.md
 * § FaceletString). This file only decides where each of the 21 rectangles
 * goes and which colour it gets.
 *
 *         9 10 11          <- B bar, above the square
 *     18   0  1  2   12
 *     19   3  4  5   13    <- L bar (left), R bar (right)
 *     20   6  7  8   14
 *        15 16 17          <- F bar, below the square
 */

/** Side of one U-face sticker, in viewBox units. */
const CELL = 100
/** Space between two adjacent stickers of the U face. */
const GAP = 10
/** How far a side bar sticks out from the square. */
const BAR = 40
/** Space between the square and each side bar. */
const BAR_GAP = 22
/** Breathing room outside the bars, so strokes are not clipped. */
const PAD = 8

/** Distance between the left edges of two neighbouring U stickers. */
const PITCH = CELL + GAP
/** Side of the whole 3x3 square. */
const FACE = 3 * CELL + 2 * GAP
/** Left/top edge of the U face. */
const FACE_ORIGIN = PAD + BAR + BAR_GAP
/** Left/top edge of the far side bars. */
const FAR_BAR = FACE_ORIGIN + FACE + BAR_GAP
/** The viewBox is square, so a parent can size it with one dimension. */
const SIZE = FAR_BAR + BAR + PAD

const FACE_RADIUS = 12
const BAR_RADIUS = 6

interface Sticker {
  index: number
  x: number
  y: number
  width: number
  height: number
  rx: number
}

/**
 * Every sticker's box, in facelet-index order. Computed once at module load:
 * the layout never varies with the input, only the fills do.
 */
const STICKERS: readonly Sticker[] = (() => {
  const out: Sticker[] = []

  // 0-8: the U face, row-major, back row first, left column first.
  for (let i = 0; i < 9; i += 1) {
    out.push({
      index: i,
      x: FACE_ORIGIN + (i % 3) * PITCH,
      y: FACE_ORIGIN + Math.floor(i / 3) * PITCH,
      width: CELL,
      height: CELL,
      rx: FACE_RADIUS,
    })
  }

  // 9-11: B bar, above the square, left to right.
  for (let n = 0; n < 3; n += 1) {
    out.push({
      index: 9 + n,
      x: FACE_ORIGIN + n * PITCH,
      y: PAD,
      width: CELL,
      height: BAR,
      rx: BAR_RADIUS,
    })
  }

  // 12-14: R bar, right of the square, top to bottom.
  for (let n = 0; n < 3; n += 1) {
    out.push({
      index: 12 + n,
      x: FAR_BAR,
      y: FACE_ORIGIN + n * PITCH,
      width: BAR,
      height: CELL,
      rx: BAR_RADIUS,
    })
  }

  // 15-17: F bar, below the square, left to right.
  for (let n = 0; n < 3; n += 1) {
    out.push({
      index: 15 + n,
      x: FACE_ORIGIN + n * PITCH,
      y: FAR_BAR,
      width: CELL,
      height: BAR,
      rx: BAR_RADIUS,
    })
  }

  // 18-20: L bar, left of the square, top to bottom.
  for (let n = 0; n < 3; n += 1) {
    out.push({
      index: 18 + n,
      x: PAD,
      y: FACE_ORIGIN + n * PITCH,
      width: BAR,
      height: CELL,
      rx: BAR_RADIUS,
    })
  }

  return out
})()

function isFaceletColour(ch: string): ch is FaceletColour {
  return Object.prototype.hasOwnProperty.call(FACELET_FILL, ch)
}

/**
 * Returns the reason `facelets` cannot be drawn, or `null` if it can. Kept
 * separate from rendering so a bad string is caught before a single rectangle
 * is emitted — a half-drawn diagram is worse than no diagram, because it looks
 * like a real case.
 */
function faultIn(facelets: FaceletString): string | null {
  if (typeof facelets !== 'string') {
    return `expected a string, got ${typeof facelets}`
  }
  if (facelets.length !== FACELET_COUNT) {
    return `expected ${FACELET_COUNT} characters, got ${facelets.length} (${JSON.stringify(facelets)})`
  }
  for (let i = 0; i < FACELET_COUNT; i += 1) {
    const ch = facelets[i]
    if (!isFaceletColour(ch)) {
      return `unknown colour ${JSON.stringify(ch)} at index ${i} (${JSON.stringify(facelets)})`
    }
  }
  return null
}

export interface LLDiagramProps {
  /** 21 colour letters. See `FaceletString` in `src/data/types.ts`. */
  facelets: FaceletString
  /** Tailwind classes for the parent to size and place the SVG. */
  className?: string
  /** Accessible name. Override when the surrounding UI can say more. */
  label?: string
}

/**
 * A ZBLL last-layer diagram: the 3x3 U face plus the top row of each side,
 * drawn as inline SVG. Sized entirely by the parent — the SVG carries a
 * `viewBox` and no width or height, so it is as happy at 64px as full-width.
 */
export function LLDiagram({
  facelets,
  className,
  label = 'Last layer diagram',
}: LLDiagramProps) {
  const fault = faultIn(facelets)
  if (fault !== null) {
    // Loud in development, quiet-but-empty in production: a data bug should
    // stop a developer, not take down a solve session on someone's phone.
    if (import.meta.env.DEV) {
      throw new Error(`LLDiagram: malformed facelet string — ${fault}`)
    }
    console.error(`LLDiagram: malformed facelet string — ${fault}`)
    return null
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{label}</title>
      {STICKERS.map((s) => (
        <rect
          key={s.index}
          data-index={s.index}
          x={s.x}
          y={s.y}
          width={s.width}
          height={s.height}
          rx={s.rx}
          ry={s.rx}
          fill={FACELET_FILL[facelets[s.index] as FaceletColour]}
          stroke="#09090b"
          strokeWidth={4}
        />
      ))}
    </svg>
  )
}

export default LLDiagram
