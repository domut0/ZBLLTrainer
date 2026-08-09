// Spike round 2. Round 1 established that case derivation and scramble
// round-tripping both work. It also found that the solver is deterministic —
// six calls returned the identical scramble — which breaks the "20 varied
// scrambles per case" plan. This tests the fix.

import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters as solve } from "cubing/search";

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

// ---------------------------------------------------------------------------
// 1. Round 1 compared algs from two *different* rows, so "same state? false"
//    was my error, not a real failure. Retest with algs from the same row.
// ---------------------------------------------------------------------------
console.log("--- same-row algs must agree ---");
const sameRowPairs = [
  ["S1 row2", "[U'] R' U2 R U R' U R", "[U] L' U2 L U L' U L"],
  ["Pi1 row3", "R' U2 R2 U R2 U R2 U2 R'", "[U2] L' U2 L2 U L2 U L2 U2 L'"],
  ["T1 row4", "[U'] R' U2 R U R' U R2 U2 R' U' R U' R'", "[U] L' U2 L U L' U L2 U2 L' U' L U' L'"],
  ["H1 row3", "[U'] R' U2 R U R' U' R U R' U R", "[U] L' U2 L U L' U' L U L' U L"],
];
for (const [label, a, b] of sameRowPairs) {
  const match = caseState(a).isIdentical(caseState(b));
  console.log(`${match ? "OK  " : "FAIL"} ${label}`);
}

// Different rows must NOT agree — otherwise identity derivation is worthless.
console.log(
  "different rows differ?",
  !caseState("R U R' U R U2 R'").isIdentical(caseState("[U'] R' U2 R U R' U R"))
);

// ---------------------------------------------------------------------------
// 2. Varied scrambles.
//
// The scramble does not have to preserve F2L *throughout* — only to end with
// F2L solved and the LL in the target case. So we can prefix a genuinely random
// sequence and then solve back to the target:
//
//     scramble = a  +  solve(state after a)  +  solve(target)⁻¹
//
// The randomness of `a` gives variety; the two solves guarantee correctness.
// ---------------------------------------------------------------------------
const FACES = ["U", "D", "L", "R", "F", "B"];
const SUFFIX = ["", "'", "2"];
function randomMoves(n) {
  const out = [];
  let last = "";
  while (out.length < n) {
    const f = FACES[Math.floor(Math.random() * 6)];
    if (f === last) continue;
    last = f;
    out.push(f + SUFFIX[Math.floor(Math.random() * 3)]);
  }
  return new Alg(out.join(" "));
}

async function scrambleFor(target, targetSolutionInverted) {
  const a = randomMoves(9);
  const afterA = SOLVED.applyAlg(a);
  const b = await solve(afterA);
  return a.concat(b).concat(targetSolutionInverted).experimentalSimplify({
    cancel: true,
  });
}

console.log("\n--- varied scramble generation ---");
const target = caseState("R U R' U R U2 R'");
const targetSolutionInverted = (await solve(target)).invert();

const seen = new Set();
const times = [];
for (let i = 0; i < 8; i++) {
  const t0 = Date.now();
  const s = await scrambleFor(target, targetSolutionInverted);
  times.push(Date.now() - t0);
  const str = s.toString();
  seen.add(str);
  const ok = SOLVED.applyAlg(s).isIdentical(target);
  console.log(`  ${ok ? "OK " : "BAD"} (${str.split(" ").length} moves) ${str}`);
}
console.log(`distinct: ${seen.size} of 8`);
console.log(`per-scramble: ${Math.round(times.reduce((x, y) => x + y, 0) / times.length)}ms avg`);

// ---------------------------------------------------------------------------
// 3. Budget for the full precompute.
// ---------------------------------------------------------------------------
const avg = times.reduce((x, y) => x + y, 0) / times.length;
for (const per of [10, 20]) {
  const mins = (472 * per * avg) / 60000;
  console.log(`472 cases x ${per} scrambles ~= ${mins.toFixed(1)} min`);
}
