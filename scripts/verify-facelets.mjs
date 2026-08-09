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
import { llFacelets, stageFacelets, zblsFacelets, FACELET_COLOURS } from "./facelets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const cases = JSON.parse(readFileSync(join(ROOT, "data", "cases.json"), "utf8"));
const scrambles = JSON.parse(readFileSync(join(ROOT, "data", "scrambles.json"), "utf8"));

const AUF_ALGS = [new Alg(""), new Alg("U"), new Alg("U2"), new Alg("U'")];
const U_EDGE_INDICES = [1, 3, 5, 7];
const U_CENTRE = 4;

const ZBLS_CORNER = 4;
const ZBLS_EDGE = 8;
function zblsKey(p) {
  const c = p.patternData.CORNERS;
  const e = p.patternData.EDGES;
  const cIdx = c.pieces.indexOf(ZBLS_CORNER);
  const eIdx = e.pieces.indexOf(ZBLS_EDGE);
  return JSON.stringify([
    cIdx, c.orientation[cIdx],
    eIdx, e.orientation[eIdx],
    [e.orientation[0], e.orientation[1], e.orientation[2], e.orientation[3]],
  ]);
}

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
// 2. Dataset-wide invariants. These hold for every case by definition.
// ---------------------------------------------------------------------------
const ALPHABET = new Set([...Object.values(FACELET_COLOURS), '?']);
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

    const expectedLen = (c.algSet === "LXS" || c.algSet === "ZBLS") ? 28 : 21;
    if (typeof f !== "string" || f.length !== expectedLen) { report(c.displayName, `auf ${auf}: length ${f?.length}, expected ${expectedLen}`); continue; }
    if ([...f].some((ch) => !ALPHABET.has(ch))) { report(c.displayName, `auf ${auf}: bad character in "${f}"`); continue; }

    const count = (ch) => [...f].filter((x) => x === ch).length;

    if (c.algSet === "ZBLL") {
      if (f.includes(FACELET_COLOURS.D)) report(c.displayName, `auf ${auf}: shows the D colour`);
      // Nine yellow (four corners, four edges, the centre) and three of each side
      // colour, whatever the orientation happens to be.
      if (count(Y) !== 9) report(c.displayName, `auf ${auf}: ${count(Y)} yellow, expected 9`);
      for (const [name, ch] of [["green", G], ["blue", B], ["orange", O], ["red", R]]) {
        if (count(ch) !== 3) report(c.displayName, `auf ${auf}: ${count(ch)} ${name}, expected 3`);
      }

      // Every last-layer edge is oriented in ZBLL, so the U face's edge stickers
      // and its centre are always yellow.
      for (const i of U_EDGE_INDICES) if (f[i] !== Y) report(c.displayName, `auf ${auf}: edge at ${i} is ${f[i]}, not oriented`);
      if (f[U_CENTRE] !== Y) report(c.displayName, `auf ${auf}: centre is ${f[U_CENTRE]}`);
    } else if (c.algSet === "COLL") {
      if (f.includes(FACELET_COLOURS.D)) report(c.displayName, `auf ${auf}: shows the D colour`);
      // Five yellow, two of each side colour, eight '?'.
      if (count(Y) !== 5) report(c.displayName, `auf ${auf}: ${count(Y)} yellow, expected 5`);
      for (const [name, ch] of [["green", G], ["blue", B], ["orange", O], ["red", R]]) {
        if (count(ch) !== 2) report(c.displayName, `auf ${auf}: ${count(ch)} ${name}, expected 2`);
      }
      if (count('?') !== 8) report(c.displayName, `auf ${auf}: ${count('?')} '?', expected 8`);
      for (const i of [1, 3, 5, 7, 10, 13, 16, 19]) {
        if (f[i] !== '?') report(c.displayName, `auf ${auf}: edge at ${i} is ${f[i]}, expected '?'`);
      }
      if (f[U_CENTRE] !== Y) report(c.displayName, `auf ${auf}: centre is ${f[U_CENTRE]}`);
    } else if (c.algSet === "LXS") {
      // Stage set: 28 stickers
      if (f[U_CENTRE] !== Y) report(c.displayName, `auf ${auf}: centre is ${f[U_CENTRE]}`);
      if (count('?') !== 20) report(c.displayName, `auf ${auf}: ${count('?')} '?', expected 20`);
      const colouredCount = count(Y) + count(G) + count(B) + count(O) + count(R) + count(FACELET_COLOURS.D);
      if (colouredCount !== 8) report(c.displayName, `auf ${auf}: ${colouredCount} coloured stickers, expected 8`);
    } else if (c.algSet === "ZBLS") {
      // Stage set: 28 stickers
      if (f[U_CENTRE] !== Y) report(c.displayName, `auf ${auf}: centre is ${f[U_CENTRE]}`);
      if (count('?') !== 12) report(c.displayName, `auf ${auf}: ${count('?')} '?', expected 12`);
      const colouredCount = count(Y) + count(G) + count(B) + count(O) + count(R) + count(FACELET_COLOURS.D);
      if (colouredCount !== 16) report(c.displayName, `auf ${auf}: ${colouredCount} coloured stickers, expected 16`);
    }

    // Recompute from the stored state by an independent route.
    let expected;
    if (c.algSet === "LXS") {
      expected = stageFacelets(state.applyAlg(AUF_ALGS[auf]));
    } else if (c.algSet === "ZBLS") {
      expected = zblsFacelets(state.applyAlg(AUF_ALGS[auf]));
    } else {
      expected = llFacelets(state.applyAlg(AUF_ALGS[auf]));
      if (c.algSet === "COLL") {
        const chars = [...expected];
        for (const idx of [1, 3, 5, 7, 10, 13, 16, 19]) chars[idx] = '?';
        expected = chars.join("");
      }
    }
    if (f !== expected) report(c.displayName, `auf ${auf}: stored ${f} != recomputed ${expected}`);
  }

  // The stickers determine the state completely, so no two cases in a set may share a diagram.
  const key = `${c.algSet}:${c.facelets[0]}`;
  if (seen.has(key)) report(c.displayName, `same auf-0 diagram as ${seen.get(key)}`);
  else seen.set(key, c.displayName);
}

// ---------------------------------------------------------------------------
// 2b. Corner orientation, per set (for sets with corner subsets).
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
  if (c.algSet !== "ZBLL" && c.algSet !== "COLL") continue;
  const subsetName = c.algSet === "COLL" ? c.group : c.subset;
  const expectedOriented = ORIENTED_CORNERS[subsetName];
  const signatures = new Set();
  for (const f of c.facelets) {
    const oriented = [0, 2, 6, 8].filter((i) => f[i] === Y).length;
    if (oriented !== expectedOriented) {
      report(c.displayName, `${oriented} oriented corners, expected ${expectedOriented} for subset ${subsetName}`);
    }
    signatures.add(twistSignature(f));
  }
  // Turning the top layer cannot change how a corner is twisted.
  if (signatures.size !== 1) report(c.displayName, `twist signature varies across AUFs: ${[...signatures].join(" ")}`);
  const sig = [...signatures][0];
  if (subsetName === "S" && sig !== suneSig) report(c.displayName, `subset S but signature ${sig}, not Sune's ${suneSig}`);
  if (subsetName === "AS" && sig !== antiSuneSig) report(c.displayName, `subset AS but signature ${sig}, not Anti-Sune's ${antiSuneSig}`);
}

// ---------------------------------------------------------------------------
// 3. Re-derive from the algorithms rather than the stored state.
// ---------------------------------------------------------------------------
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
      let faceletRep;
      if (c.algSet === "ZBLS") {
        if ("ZBLS:" + zblsKey(derived) === c.id) { matchedAt = r; break; }
      } else if (c.algSet === "LXS") {
        faceletRep = stageFacelets(derived);
        if (faceletRep === c.facelets[0]) { matchedAt = r; break; }
      } else {
        faceletRep = llFacelets(derived);
        if (c.algSet === "COLL") {
          const chars = [...faceletRep];
          for (const idx of [1, 3, 5, 7, 10, 13, 16, 19]) chars[idx] = '?';
          faceletRep = chars.join("");
        }
        if (faceletRep === c.facelets[0]) { matchedAt = r; break; }
      }
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
//    `auf: k` must produce exactly the diagram stored at facelets[k].
// ---------------------------------------------------------------------------
let scramblesChecked = 0;
const sample = cases.filter((_, i) => i % 7 === 0);
for (const c of sample) {
  for (const s of (scrambles[c.id] ?? []).slice(0, 4)) {
    const state = SOLVED.applyAlg(new Alg(s.scramble));
    let stateFacelets;
    if (c.algSet === "LXS") {
      stateFacelets = stageFacelets(state);
    } else if (c.algSet === "ZBLS") {
      stateFacelets = zblsFacelets(state);
    } else {
      stateFacelets = llFacelets(state);
      if (c.algSet === "COLL") {
        const chars = [...stateFacelets];
        for (const idx of [1, 3, 5, 7, 10, 13, 16, 19]) chars[idx] = '?';
        stateFacelets = chars.join("");
      }
    }
    if (stateFacelets !== c.facelets[s.auf]) {
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
