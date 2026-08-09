// Spike 3. Round 2 found that alternative algorithms on the same sheet row
// produce different cube states. Hypothesis: they solve the same case but from
// different AUFs — which is exactly what a ZBLL "case" means. A case is an
// equivalence class under U turns, not a single state.
//
// If true, case identity must be canonicalised over the four U rotations, and
// the PRD's "all algs in a row produce the same state" is wrong as written.

import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const normalise = (raw) =>
  raw
    .replace(/\[\s*(U2|U'|U)\s*\]/g, "$1")
    .replace(/[‘’]/g, "'")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const caseState = (raw) => SOLVED.applyAlg(new Alg(normalise(raw)).invert());

const U = new Alg("U");
const serialise = (p) =>
  JSON.stringify([
    p.patternData.CORNERS.pieces,
    p.patternData.CORNERS.orientation,
    p.patternData.EDGES.pieces,
    p.patternData.EDGES.orientation,
  ]);

/** All four AUF rotations of a state. */
function aufOrbit(pattern) {
  const out = [];
  let p = pattern;
  for (let i = 0; i < 4; i++) {
    out.push(p);
    p = p.applyAlg(U);
  }
  return out;
}

/** Canonical id: smallest serialisation across the AUF orbit. */
function caseId(pattern) {
  return aufOrbit(pattern).map(serialise).sort()[0];
}

/** Which AUF index maps `pattern` onto its canonical representative. */
function aufOffset(pattern) {
  const sers = aufOrbit(pattern).map(serialise);
  const canonical = [...sers].sort()[0];
  return sers.indexOf(canonical);
}

const pairs = [
  ["S1 row2", "[U'] R' U2 R U R' U R", "[U] L' U2 L U L' U L"],
  ["Pi1 row3", "R' U2 R2 U R2 U R2 U2 R'", "[U2] L' U2 L2 U L2 U L2 U2 L'"],
  ["T1 row4", "[U'] R' U2 R U R' U R2 U2 R' U' R U' R'", "[U] L' U2 L U L' U L2 U2 L' U' L U' L'"],
  ["H1 row3", "[U'] R' U2 R U R' U' R U R' U R", "[U] L' U2 L U L' U' L U L' U L"],
  // Same-row alternatives that are *not* R/L mirrors:
  ["AS3 row1", "r' F R F' r U R'", "[U2] z D' R U R' D R U'"],
  ["S3 row1", "R U' r' F R' F' r", "R U' L' U R' U' L"],
];

console.log("--- raw state equality (PRD as written) ---");
for (const [label, a, b] of pairs) {
  console.log(`${caseState(a).isIdentical(caseState(b)) ? "OK  " : "FAIL"} ${label}`);
}

console.log("\n--- AUF-canonical equality (hypothesis) ---");
for (const [label, a, b] of pairs) {
  const pa = caseState(a);
  const pb = caseState(b);
  const match = caseId(pa) === caseId(pb);
  console.log(
    `${match ? "OK  " : "FAIL"} ${label.padEnd(10)} auf offsets: ${aufOffset(pa)} vs ${aufOffset(pb)}`
  );
}

// Distinctness must survive canonicalisation, or identity is worthless.
console.log("\n--- distinct cases stay distinct ---");
const distinctSamples = [
  "R U R' U R U2 R'",
  "[U'] R' U2 R U R' U R",
  "R' U2 R2 U R2 U R2 U2 R'",
  "r' F R F' r U R'",
  "R U' r' F R' F' r",
  "[U2] R U R' U R U2 R2 U' R U' R' U2 R",
];
const ids = distinctSamples.map((s) => caseId(caseState(s)));
console.log(`${new Set(ids).size} distinct ids from ${ids.length} different-case algs`);
