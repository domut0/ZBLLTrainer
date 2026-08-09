import {
  FACELET_FILL,
  type FaceletColour,
  type FaceletString,
} from '../data/types'

/** Expected sticker count for an F2L-stage diagram (21 LL + 7 FR/DR slot). */
export const STAGE_FACELET_COUNT = 28

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

/** Height/width bounds including the FR/DR slot. */
const VIEWBOX_SIZE = 622

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
 * Every sticker's box in facelet-index order (21 LL + 7 slot).
 */
const STICKERS: readonly Sticker[] = (() => {
  const out: Sticker[] = []

  // 0-8: U face, row-major, back row first, left column first.
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

  // 21-27: FR/DR slot stickers
  out.push({ index: 21, x: 290, y: 474, width: 100, height: 40, rx: BAR_RADIUS })
  out.push({ index: 22, x: 412, y: 474, width: 40, height: 40, rx: BAR_RADIUS })
  out.push({ index: 23, x: 290, y: 524, width: 100, height: 40, rx: BAR_RADIUS })
  out.push({ index: 24, x: 412, y: 524, width: 40, height: 40, rx: BAR_RADIUS })
  out.push({ index: 25, x: 290, y: 574, width: 100, height: 40, rx: BAR_RADIUS })
  out.push({ index: 26, x: 462, y: 524, width: 40, height: 40, rx: BAR_RADIUS })
  out.push({ index: 27, x: 412, y: 574, width: 40, height: 40, rx: BAR_RADIUS })

  return out
})()

/** The four last-layer edge slots: (U sticker index, side bar sticker index). */
const LL_EDGE_SLOTS = [
  { uIdx: 1, sideIdx: 10 }, // UB
  { uIdx: 5, sideIdx: 13 }, // UR
  { uIdx: 7, sideIdx: 16 }, // UF
  { uIdx: 3, sideIdx: 19 }, // UL
]

function isFaceletColour(ch: string): ch is FaceletColour {
  return Object.prototype.hasOwnProperty.call(FACELET_FILL, ch)
}

function faultIn(facelets: FaceletString): string | null {
  if (typeof facelets !== 'string') {
    return `expected a string, got ${typeof facelets}`
  }
  if (facelets.length !== STAGE_FACELET_COUNT) {
    return `expected ${STAGE_FACELET_COUNT} characters, got ${facelets.length} (${JSON.stringify(facelets)})`
  }
  for (let i = 0; i < STAGE_FACELET_COUNT; i += 1) {
    const ch = facelets[i]
    if (!isFaceletColour(ch)) {
      return `unknown colour ${JSON.stringify(ch)} at index ${i} (${JSON.stringify(facelets)})`
    }
  }
  return null
}

export interface ZblsDiagramProps {
  facelets: FaceletString
  className?: string
  label?: string
}

/**
 * A diagram for ZBLS: stage diagram with explicit edge orientation indicators
 * for misoriented last-layer edges. Sibling component to `StageDiagram` and `LLDiagram`.
 */
export function ZblsDiagram({
  facelets,
  className,
  label = 'ZBLS diagram',
}: ZblsDiagramProps) {
  const fault = faultIn(facelets)
  if (fault !== null) {
    if (import.meta.env.DEV) {
      throw new Error(`ZblsDiagram: malformed facelet string — ${fault}`)
    }
    console.error(`ZblsDiagram: malformed facelet string — ${fault}`)
    return null
  }

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
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
      {/* Explicit orientation markers for misoriented last-layer edges */}
      {LL_EDGE_SLOTS.map(({ uIdx }) => {
        // '1' is misoriented, straight from the cube state. Reading the sticker
        // colour instead is wrong whenever the slot edge is parked in the last
        // layer: it is correctly oriented and still shows a side colour.
        if (facelets[uIdx] !== '1') return null
        const s = STICKERS[uIdx]
        return (
          <g key={`misorient-marker-${uIdx}`} data-misoriented={uIdx}>
            <rect
              x={s.x + 8}
              y={s.y + 8}
              width={s.width - 16}
              height={s.height - 16}
              rx={FACE_RADIUS - 4}
              ry={FACE_RADIUS - 4}
              fill="none"
              stroke="#f5d915"
              strokeWidth={6}
              strokeDasharray="12 6"
            />
            <circle
              cx={s.x + s.width / 2}
              cy={s.y + s.height / 2}
              r={12}
              fill="#f5d915"
              stroke="#09090b"
              strokeWidth={3}
            />
          </g>
        )
      })}
    </svg>
  )
}

export default ZblsDiagram
