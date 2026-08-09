// Independent cross-check of the last-layer diagrams in data/cases.json.
//
// Same reasoning as scripts/verify-scrambles.mjs: the importer and this script
// should be able to disagree. A wrong facelet mapping produces diagrams that
// look entirely plausible and are wrong for all 472 cases, so the checks here
// are deliberately of a different kind from the derivation — dataset-wide
// invariants, a re-derivation from the algorithms rather than the stored state,
// and an end-to-end tie-in to the precomputed scrambles.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { llFacelets, FACELET_COLOURS } from "./facelets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const cases = JSON.parse(readFileSync(join(ROOT, "data", "cases.json"), "utf8"));
const scrambles = JSON.parse(readFileSync(join(ROOT, "data", "scrambles.json"), "utf8"));

const AUF_ALGS = [new Alg(""), new Alg("U"), new Alg("U2"), new Alg("U'")];
const U_EDGE_INDICES = [1, 3, 5, 7];
const U_CENTRE = 4;

function rebuildState(cubeState) {
  return new KPattern(kpuzzle, {
    CORNERS: { pieces: [...cubeState.corners.pieces], orientation: [...cubeState.corners.orientation] },
    EDGES: { pieces: [...cubeState.edges.pieces], orientation: [...cubeState.edges.orientation] },
    CENTERS: {
      pieces: [...SOLVED.patternData.CENTERS.pieces],
      orientation: [...SOLVED.patternData.CENTERS.orientation],
      orientationMod: [...SOLVED.patternData.CENTERS.orientationMod],
    },
  });
}

const fail = [];
const report = (what, detail) => fail.push(`${what}: ${detail}`);

// ---------------------------------------------------------------------------
// 1. Anchors that do not depend on the dataset at all.
// ---------------------------------------------------------------------------
const Y = FACELET_COLOURS.U, G = FACELET_COLOURS.F, B = FACELET_COLOURS.B;
const O = FACELET_COLOURS.R, R = FACELET_COLOURS.L;

const solvedExpected = Y.repeat(9) + B.repeat(3) + O.repeat(3) + G.repeat(3) + R.repeat(3);
if (llFacelets(SOLVED) !== solvedExpected) {
  report("solved cube", `got ${llFacelets(SOLVED)}, expected ${solvedExpected}`);
}

// A T-perm swaps the UFR/UBR corners and the UL/UR edges, and orients nothing.
// Read that straight off the diagram rather than trusting a literal string.
{
  const t = llFacelets(SOLVED.applyAlg(new Alg("R U R' U' R' F R2 U' R' U' R U R' F'")));
  const corner = (uIdx, a, b) => [t[uIdx], t[a], t[b]].sort().join("");
  // UBR reads (U, B bar right, R bar top); UFR reads (U, F bar right, R bar bottom).
  if (corner(2, 11, 12) !== [Y, G, O].sort().join("")) report("T-perm", "UBR is not the UFR piece");
  if (corner(8, 17, 14) !== [Y, O, B].sort().join("")) report("T-perm", "UFR is not the UBR piece");
  if ([t[5], t[13]].sort().join("") !== [Y, R].sort().join("")) report("T-perm", "UR is not the UL edge");
  if ([t[3], t[19]].sort().join("") !== [Y, O].sort().join("")) report("T-perm", "UL is not the UR edge");
  if (t.slice(0, 9).split("").filter((c) => c === Y).length !== 9) report("T-perm", "U face is not fully oriented");
}

// A Sune twists exactly three corners.
{
  const s = llFacelets(SOLVED.applyAlg(new Alg("R U R' U R U2 R'")));
  const oriented = [0, 2, 6, 8].filter((i) => s[i] === Y).length;
  if (oriented !== 1) report("Sune", `${oriented} corners oriented, expected 1`);
}

// ---------------------------------------------------------------------------
// 2. Dataset-wide invariants. These hold for every ZBLL case by definition.
// ---------------------------------------------------------------------------
const ALPHABET = new Set(Object.values(FACELET_COLOURS));
let checked = 0;
const seen = new Map();

for (const c of cases) {
  if (!Array.isArray(c.facelets) || c.facelets.length !== 4) {
    report(c.displayName, `expected 4 facelet strings, got ${c.facelets?.length}`);
    continue;
  }
  const state = rebuildState(c.state);

  for (let auf = 0; auf < 4; auf++) {
    const f = c.facelets[auf];
    checked++;

    if (typeof f !== "string" || f.length !== 21) { report(c.displayName, `auf ${auf}: length ${f?.length}`); continue; }
    if ([...f].some((ch) => !ALPHABET.has(ch))) { report(c.displayName, `auf ${auf}: bad character in "${f}"`); continue; }

    // The last layer never shows the bottom colour: F2L is intact, so every
    // sticker in the diagram belongs to a last-layer piece.
    if (f.includes(FACELET_COLOURS.D)) report(c.displayName, `auf ${auf}: shows the D colour`);

    // Nine yellow (four corners, four edges, the centre) and three of each side
    // colour, whatever the orientation happens to be.
    const count = (ch) => [...f].filter((x) => x === ch).length;
    if (count(Y) !== 9) report(c.displayName, `auf ${auf}: ${count(Y)} yellow, expected 9`);
    for (const [name, ch] of [["green", G], ["blue", B], ["orange", O], ["red", R]]) {
      if (count(ch) !== 3) report(c.displayName, `auf ${auf}: ${count(ch)} ${name}, expected 3`);
    }

    // Every last-layer edge is oriented in ZBLL, so the U face's edge stickers
    // and its centre are always yellow.
    for (const i of U_EDGE_INDICES) if (f[i] !== Y) report(c.displayName, `auf ${auf}: edge at ${i} is ${f[i]}, not oriented`);
    if (f[U_CENTRE] !== Y) report(c.displayName, `auf ${auf}: centre is ${f[U_CENTRE]}`);

    // Recompute from the stored state by an independent route.
    const expected = llFacelets(state.applyAlg(AUF_ALGS[auf]));
    if (f !== expected) report(c.displayName, `auf ${auf}: stored ${f} != recomputed ${expected}`);
  }

  // The 21 stickers determine the last-layer state completely, so no two of the
  // 472 cases may share a diagram. This is the check that would catch a mapping
  // that collapses distinct cases onto the same picture.
  const key = c.facelets[0];
  if (seen.has(key)) report(c.displayName, `same auf-0 diagram as ${seen.get(key)}`);
  else seen.set(key, c.displayName);
}

// ---------------------------------------------------------------------------
// 2b. Corner orientation, per set. The seven ZBLL sets are the seven OCLL
//     cases, each with a known number of already-oriented corners and a known
//     twist pattern. This is the check that catches a mirrored mapping: a
//     chirality flip would silently swap Sune with Anti-Sune, and every other
//     check in this file would still pass.
// ---------------------------------------------------------------------------
const ORIENTED_CORNERS = { S: 1, AS: 1, H: 0, Pi: 0, T: 2, U: 2, L: 2 };

// Each U corner with its two side stickers in a consistent rotational order:
// [U index, clockwise neighbour, anticlockwise neighbour]. Clockwise around the
// top face reads B -> R -> F -> L.
const CORNER_STICKERS = [[0, 9, 18], [2, 12, 11], [8, 17, 14], [6, 20, 15]];

const twistSignature = (f) =>
  CORNER_STICKERS.map(([u, cw]) => (f[u] === Y ? 0 : f[cw] === Y ? 1 : 2))
    .filter((v) => v !== 0)
    .sort()
    .join("");

// Established from the real algorithms, not asserted from memory: the case a
// Sune solves, and the case an Anti-Sune solves.
const suneSig = twistSignature(llFacelets(SOLVED.applyAlg(new Alg("R U R' U R U2 R'").invert())));
const antiSuneSig = twistSignature(llFacelets(SOLVED.applyAlg(new Alg("R U2 R' U' R U' R'").invert())));
if (suneSig === antiSuneSig) report("chirality", "Sune and Anti-Sune have the same signature; the check is vacuous");

for (const c of cases) {
  const expectedOriented = ORIENTED_CORNERS[c.set];
  const signatures = new Set();
  for (const f of c.facelets) {
    const oriented = [0, 2, 6, 8].filter((i) => f[i] === Y).length;
    if (oriented !== expectedOriented) {
      report(c.displayName, `${oriented} oriented corners, expected ${expectedOriented} for set ${c.set}`);
    }
    signatures.add(twistSignature(f));
  }
  // Turning the top layer cannot change how a corner is twisted.
  if (signatures.size !== 1) report(c.displayName, `twist signature varies across AUFs: ${[...signatures].join(" ")}`);
  const sig = [...signatures][0];
  if (c.set === "S" && sig !== suneSig) report(c.displayName, `set S but signature ${sig}, not Sune's ${suneSig}`);
  if (c.set === "AS" && sig !== antiSuneSig) report(c.displayName, `set AS but signature ${sig}, not Anti-Sune's ${antiSuneSig}`);
}

// ---------------------------------------------------------------------------
// 3. Re-derive from the algorithms rather than the stored state. The importer
//    built `state` from the algorithm; this walks the same road from the other
//    end, so a bug in `toCubeState` would show up here.
// ---------------------------------------------------------------------------
//    Algorithms containing x/y/z — or a wide move, which carries a rotation with
//    it — finish in a rotated frame, and the importer keeps only the AUF it
//    corrected with, not the rotation. So allow the same 24-rotation prefix
//    search the importer does, and require the centres to come out solved, which
//    is what makes a candidate rotation legitimate.
const ROTATIONS = [];
for (const a of ["", "x", "x2", "x'", "z", "z'"]) {
  for (const b of ["", "y", "y2", "y'"]) ROTATIONS.push(new Alg(`${a} ${b}`.trim()));
}
const centresSolved = (p) =>
  p.patternData.CENTERS.pieces.every((v, i) => v === SOLVED.patternData.CENTERS.pieces[i]);

let algsChecked = 0;
let rotationCorrected = 0;
for (const c of cases) {
  for (const a of c.algs) {
    const inv = new Alg(a.alg).invert();
    const auf = AUF_ALGS[a.aufOffset];
    let matchedAt = -1;
    for (let r = 0; r < ROTATIONS.length; r++) {
      const derived = SOLVED.applyAlg(ROTATIONS[r].concat(auf).concat(inv));
      if (!centresSolved(derived)) continue;
      if (llFacelets(derived) === c.facelets[0]) { matchedAt = r; break; }
    }
    if (matchedAt === -1) {
      report(c.displayName, `alg "${a.alg}" (auf ${a.aufOffset}) yields no rotation that reproduces the stored diagram`);
      break;
    }
    if (matchedAt !== 0) rotationCorrected++;
    algsChecked++;
  }
}

// ---------------------------------------------------------------------------
// 4. End-to-end against the precomputed scrambles: applying a scramble tagged
//    `auf: k` must produce exactly the diagram stored at facelets[k]. This is
//    the property the drill screen depends on.
// ---------------------------------------------------------------------------
let scramblesChecked = 0;
const sample = cases.filter((_, i) => i % 7 === 0);
for (const c of sample) {
  for (const s of (scrambles[c.id] ?? []).slice(0, 4)) {
    const state = SOLVED.applyAlg(new Alg(s.scramble));
    if (llFacelets(state) !== c.facelets[s.auf]) {
      report(c.displayName, `scramble "${s.scramble}" (auf ${s.auf}) does not match facelets[${s.auf}]`);
      break;
    }
    scramblesChecked++;
  }
}

// ---------------------------------------------------------------------------
console.log(`cases:                    ${cases.length}`);
console.log(`facelet strings checked:  ${checked}`);
console.log(`distinct auf-0 diagrams:  ${seen.size}`);
console.log(`algorithms re-derived:    ${algsChecked} (${rotationCorrected} needed a rotation prefix)`);
console.log(`scrambles cross-checked:  ${scramblesChecked} across ${sample.length} cases`);
console.log(`failures:                 ${fail.length}`);
for (const f of fail.slice(0, 30)) console.log(`  ${f}`);
if (fail.length > 30) console.log(`  ... and ${fail.length - 30} more`);

console.log(fail.length === 0 ? "\nPASS" : "\nFAIL");
process.exit(fail.length === 0 ? 0 : 1);
