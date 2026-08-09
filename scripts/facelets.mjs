// Last-layer facelet derivation.
//
// Why this lives in Node and not in the React component: working out which
// sticker colour a cubie shows, given the orbit arrays in cases.json, is fiddly
// 3D geometry. Getting it subtly wrong produces plausible-looking but incorrect
// diagrams for all 472 cases — a failure you only notice with a cube in your
// hands. Deriving it once here, next to the importer, means it can be asserted
// against invariants that hold across the whole dataset (see
// scripts/verify-facelets.mjs). The component then just draws 21 coloured
// squares from a string.
//
// Nothing here is hand-derived. The (orbit, ord, ori) -> face mapping and the
// sticker positions both come from cubing.js's own PuzzleGeometry, and the one
// remaining convention (which way orientation twists) is solved for at load
// time against physical anchors rather than assumed. See scripts/spike5-facelets.mjs.

import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { getPuzzleGeometryByName } from "cubing/puzzle-geometry";

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const pg = getPuzzleGeometryByName("3x3x3", { allMoves: true });

// ---------------------------------------------------------------------------
// PuzzleGeometry indexes pieces its own way. Before trusting its sticker table
// we check that its CORNERS/EDGES move definitions are identical to the kpuzzle
// the importer uses. If all six face generators agree on both permutation and
// orientation, the two definitions label pieces and twists identically, so the
// sticker table transfers directly. (CENTERS deliberately excluded: the two
// disagree on centre orientation, and a last layer never reads a centre other
// than U, which cannot move under face turns.)
// ---------------------------------------------------------------------------
{
  const kdef = kpuzzle.definition;
  const pgdef = pg.getKPuzzleDefinition(true);
  for (const mv of ["U", "R", "F", "D", "L", "B"]) {
    for (const orbit of ["CORNERS", "EDGES"]) {
      const a = JSON.stringify(kdef.moves[mv]?.[orbit]);
      const b = JSON.stringify(pgdef.moves[mv]?.[orbit]);
      if (a !== b) {
        throw new Error(
          `PuzzleGeometry no longer agrees with the 3x3x3 kpuzzle on ${mv}.${orbit}. ` +
            `The facelet mapping is derived from PG and is not safe to use.\n  kpuzzle: ${a}\n  pg:      ${b}`,
        );
      }
    }
  }
}

const dat = pg.get3d();
const FACE_NAME = dat.faces.map((f) => f.name);

// Yellow top, green front (PRD §3), which is PG's own white-top/green-front
// cube rotated by z2 — a proper rotation, so the scheme stays chirally valid.
// Asserted in verify-facelets.mjs rather than taken on trust.
const COLOUR = { U: "Y", D: "W", F: "G", B: "B", R: "O", L: "R" };

function centroid(coords) {
  const n = coords.length / 3;
  const c = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    c[0] += coords[i * 3];
    c[1] += coords[i * 3 + 1];
    c[2] += coords[i * 3 + 2];
  }
  return c.map((v) => v / n);
}

// stickerFace[orbit][ord][ori] -> face name, read off the solved cube. In the
// solved state slot `ord` holds piece `ord` untwisted, so this single table is
// both "which face is position `ori` of slot `ord`" and "which face does sticker
// `ori` of piece `ord` show".
const stickerFace = { CORNERS: [], EDGES: [] };
const stickerAt = { CORNERS: [], EDGES: [] };
for (const s of dat.stickers) {
  if (s.isDup) continue;
  if (s.orbit !== "CORNERS" && s.orbit !== "EDGES") continue;
  (stickerFace[s.orbit][s.ord] ??= [])[s.ori] = FACE_NAME[s.face];
  (stickerAt[s.orbit][s.ord] ??= [])[s.ori] = { face: FACE_NAME[s.face], centroid: centroid(s.coords) };
}

// ---------------------------------------------------------------------------
// Geometry, read from PG's coordinates rather than assumed.
// ---------------------------------------------------------------------------
const AXIS = (() => {
  // Every sticker on face X has its centroid pushed out along X's normal. Take
  // the U/R/F normals from any sticker on each, and read off which coordinate
  // axis (and sign) each corresponds to.
  const normalOf = (faceName) => {
    for (const orbit of ["CORNERS", "EDGES"]) {
      for (const perSlot of stickerAt[orbit]) {
        for (const st of perSlot ?? []) {
          if (st?.face === faceName) {
            const c = st.centroid;
            const i = c.map(Math.abs).indexOf(Math.max(...c.map(Math.abs)));
            return { index: i, sign: Math.sign(c[i]) };
          }
        }
      }
    }
    throw new Error(`no sticker found on face ${faceName}`);
  };
  return { up: normalOf("U"), right: normalOf("R"), front: normalOf("F") };
})();

const along = (c, axis) => c[axis.index] * axis.sign;

// ---------------------------------------------------------------------------
// The 21 last-layer sticker positions.
//
// Indices as they appear in the drawing (green front at the bottom):
//
//            9 10 11          <- B bar, above the square
//        18   0  1  2   12
//        19   3  4  5   13    <- L bar (left), R bar (right)
//        20   6  7  8   14
//           15 16 17          <- F bar, below the square
//
// Flat layout, which data/SCHEMA.md repeats as the authoritative contract:
//   0-8   U face, row-major. Row 0 is the back row (nearest B), column 0 is the
//         left column (nearest L). Index 4 is the U centre, always yellow.
//   9-11  B bar, left to right as drawn
//  12-14  R bar, top to bottom as drawn (that is, back to front)
//  15-17  F bar, left to right as drawn
//  18-20  L bar, top to bottom as drawn (back to front)
//
// Each bar is ordered to line up with the edge of the square it touches, so a
// component can draw them without reasoning about the cube at all.
// ---------------------------------------------------------------------------
// Positions are (orbit, slot, ori) triples plus the U centre, which is handled
// separately: centres never permute under face turns and the importer already
// rejects anything with a net rotation, so the U centre is always the U colour.
const U_CENTRE_INDEX = 4;

function llPositions() {
  const onFace = (faceName) => {
    const out = [];
    for (const orbit of ["CORNERS", "EDGES"]) {
      stickerAt[orbit].forEach((perSlot, slot) => {
        (perSlot ?? []).forEach((st, ori) => {
          if (st?.face === faceName) out.push({ orbit, slot, ori, centroid: st.centroid });
        });
      });
    }
    return out;
  };

  // U face: the nine stickers on U, placed on a 3x3 grid by their coordinates.
  const uGrid = new Array(9).fill(null);
  const bucket = (v) => (v < -0.37 ? 0 : v > 0.37 ? 2 : 1);
  for (const st of onFace("U")) {
    const col = bucket(along(st.centroid, AXIS.right));
    const row = bucket(along(st.centroid, AXIS.front)); // row 0 = back, row 2 = front
    uGrid[row * 3 + col] = st;
  }

  // Side bars: the top row of each side face, i.e. its stickers nearest U.
  const topRowOf = (faceName, sortAxis) =>
    onFace(faceName)
      .filter((st) => along(st.centroid, AXIS.up) > 0.37)
      .sort((a, b) => along(a.centroid, sortAxis) - along(b.centroid, sortAxis));

  // Drawn clockwise from the top of the diagram. The B bar sits above the
  // square and reads left-to-right along +right; the R bar sits to the right
  // and reads top-to-bottom, which is back-to-front, i.e. along +front.
  const bBar = topRowOf("B", AXIS.right);
  const rBar = topRowOf("R", AXIS.front);
  const fBar = topRowOf("F", AXIS.right);
  const lBar = topRowOf("L", AXIS.front);

  for (const [name, bar] of [["B", bBar], ["R", rBar], ["F", fBar], ["L", lBar]]) {
    if (bar.length !== 3) throw new Error(`${name} bar has ${bar.length} stickers, expected 3`);
  }
  if (uGrid.some((v, i) => v === null && i !== U_CENTRE_INDEX)) {
    throw new Error("U face grid is missing a sticker");
  }

  return [...uGrid, ...bBar, ...rBar, ...fBar, ...lBar];
}

const POSITIONS = llPositions();
if (POSITIONS.length !== 21) throw new Error(`expected 21 last-layer positions, got ${POSITIONS.length}`);

// ---------------------------------------------------------------------------
// Orientation sign. cubing.js stores a twist per slot; whether the sticker at
// position j belongs to the piece's sticker (j + twist) or (j - twist) is a
// convention, so we solve for it instead of guessing. The anchor is a physical
// fact about a quarter turn: R lifts the front-right column onto the top face,
// so after R the right-hand column of U shows the front colour.
// ---------------------------------------------------------------------------
function readWithSign(pattern, sign) {
  return POSITIONS.map((pos, i) => {
    if (i === U_CENTRE_INDEX) return COLOUR.U;
    const orbit = pos.orbit;
    const n = orbit === "CORNERS" ? 3 : 2;
    const od = pattern.patternData[orbit];
    const piece = od.pieces[pos.slot];
    const twist = od.orientation[pos.slot];
    const sticker = (((pos.ori + sign * twist) % n) + n) % n;
    return COLOUR[stickerFace[orbit][piece][sticker]];
  }).join("");
}

const ORI_SIGN = (() => {
  const afterR = SOLVED.applyAlg(new Alg("R"));
  const afterU = SOLVED.applyAlg(new Alg("U"));
  const viable = [1, -1].filter((sign) => {
    const r = readWithSign(afterR, sign);
    // R: the U face's right-hand column (indices 2, 5, 8) becomes the F colour.
    if (![2, 5, 8].every((i) => r[i] === COLOUR.F)) return false;
    // ...and the rest of U is untouched.
    if (![0, 1, 3, 4, 6, 7].every((i) => r[i] === COLOUR.U)) return false;
    // U: a clockwise top turn sends the front face's top row to the left, so
    // the F bar picks up the R colour.
    const u = readWithSign(afterU, sign);
    return [15, 16, 17].every((i) => u[i] === COLOUR.R);
  });
  if (viable.length !== 1) {
    throw new Error(`orientation sign is ambiguous or unsatisfiable (viable: ${JSON.stringify(viable)})`);
  }
  return viable[0];
})();

/** The 21 last-layer stickers of a pattern, as a string of colour letters. */
export function llFacelets(pattern) {
  return readWithSign(pattern, ORI_SIGN);
}

export const AUF_ALGS = [new Alg(""), new Alg("U"), new Alg("U2"), new Alg("U'")];

/**
 * One facelet string per AUF, indexed 0-3 to match the `auf` field on scrambles.
 * AUF k is the case with k quarter-turns of the top layer applied, which is
 * exactly what a scramble tagged `auf: k` presents.
 */
export function llFaceletsAllAufs(pattern) {
  return AUF_ALGS.map((alg) => llFacelets(pattern.applyAlg(alg)));
}

// ---------------------------------------------------------------------------
// Stage facelets for F2L-stage sets (LXS, etc.): 21 LL stickers + 7 FR/DR slot stickers.
// ---------------------------------------------------------------------------
const STAGE_SLOT_POSITIONS = [
  { orbit: "EDGES", slot: 8, ori: 0 },   // 21: FR edge, F sticker
  { orbit: "EDGES", slot: 8, ori: 1 },   // 22: FR edge, R sticker
  { orbit: "CORNERS", slot: 4, ori: 1 }, // 23: DFR corner, F sticker
  { orbit: "CORNERS", slot: 4, ori: 2 }, // 24: DFR corner, R sticker
  { orbit: "CORNERS", slot: 4, ori: 0 }, // 25: DFR corner, D sticker
  { orbit: "EDGES", slot: 5, ori: 1 },   // 26: DR edge, R sticker
  { orbit: "EDGES", slot: 5, ori: 0 },   // 27: DR edge, D sticker
];

function readPositionsWithSign(pattern, positions, sign) {
  return positions.map((pos) => {
    const orbit = pos.orbit;
    const n = orbit === "CORNERS" ? 3 : 2;
    const od = pattern.patternData[orbit];
    const piece = od.pieces[pos.slot];
    const twist = od.orientation[pos.slot];
    const sticker = (((pos.ori + sign * twist) % n) + n) % n;
    return COLOUR[stickerFace[orbit][piece][sticker]];
  }).join("");
}

/** The 28 stickers (21 LL + 7 slot) of a stage pattern. */
export function stageFacelets(pattern) {
  const ll = llFacelets(pattern);
  const slot = readPositionsWithSign(pattern, STAGE_SLOT_POSITIONS, ORI_SIGN);
  return ll + slot;
}

export function stageFaceletsAllAufs(pattern) {
  return AUF_ALGS.map((alg) => stageFacelets(pattern.applyAlg(alg)));
}

export const FACELET_COLOURS = COLOUR;
export const ORIENTATION_SIGN = ORI_SIGN;

