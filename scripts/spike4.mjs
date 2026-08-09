// Spike 4. Neither raw-state nor post-AUF equality relates same-row algorithms.
// Third hypothesis: alg sheets routinely omit the *final* AUF, and the bracketed
// leading AUF is inconsistent between alternatives. So the true equivalence is
// over BOTH a pre-AUF and a post-AUF.
//
// Brute force it: for algorithms a and b, is there any (i, j) in 0..3 such that
// U^i · b · U^j solves exactly the state that a solves?

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

const caseState = (s) => SOLVED.applyAlg(new Alg(s).invert());
const AUF = ["", "U", "U2", "U'"];

function findAufPair(aState, bRaw) {
  const core = normalise(bRaw);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const variant = `${AUF[i]} ${core} ${AUF[j]}`.trim();
      if (caseState(variant).isIdentical(aState)) return [i, j];
    }
  }
  return null;
}

const pairs = [
  ["S1 row2", "[U'] R' U2 R U R' U R", "[U] L' U2 L U L' U L"],
  ["Pi1 row3", "R' U2 R2 U R2 U R2 U2 R'", "[U2] L' U2 L2 U L2 U L2 U2 L'"],
  ["T1 row4", "[U'] R' U2 R U R' U R2 U2 R' U' R U' R'", "[U] L' U2 L U L' U L2 U2 L' U' L U' L'"],
  ["H1 row3", "[U'] R' U2 R U R' U' R U R' U R", "[U] L' U2 L U L' U' L U L' U L"],
  ["AS3 row1", "r' F R F' r U R'", "[U2] z D' R U R' D R U'"],
  ["S3 row1", "R U' r' F R' F' r", "R U' L' U R' U' L"],
  ["T5 row1 a/b", "r U R' U' r' F R F'", "[U] R U R D R' U' R D' R2"],
  ["T5 row1 a/c", "r U R' U' r' F R F'", "[U'] x' D R U' R' D' R U R'"],
];

console.log("--- pre/post AUF search ---");
let solvedCount = 0;
for (const [label, a, b] of pairs) {
  const aState = caseState(normalise(a));
  const hit = findAufPair(aState, b);
  if (hit) solvedCount++;
  console.log(
    `${hit ? "OK  " : "FAIL"} ${label.padEnd(13)} ${hit ? `pre=${AUF[hit[0]] || "-"} post=${AUF[hit[1]] || "-"}` : "no (i,j) works"}`
  );
}
console.log(`\n${solvedCount}/${pairs.length} rows reconciled`);

// If that works, the canonical id is the state's orbit under post-AUF only,
// after normalising every alg to a common pre-AUF. Verify the orbit is size 4
// (i.e. no case is accidentally symmetric and collapsing).
console.log("\n--- orbit sizes (expect 4, except symmetric cases) ---");
for (const raw of ["R U R' U R U2 R'", "r' F R F' r U R'", "R' U2 R2 U R2 U R2 U2 R'"]) {
  const p = caseState(normalise(raw));
  const seen = new Set();
  let q = p;
  for (let i = 0; i < 4; i++) {
    seen.add(
      JSON.stringify([
        q.patternData.CORNERS.pieces,
        q.patternData.CORNERS.orientation,
        q.patternData.EDGES.pieces,
        q.patternData.EDGES.orientation,
      ])
    );
    q = q.applyAlg(new Alg("U"));
  }
  console.log(`  orbit ${seen.size}  ${raw}`);
}
