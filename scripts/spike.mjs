// Phase 0 spike: can we (a) derive a ZBLL case state from a sheet algorithm,
// and (b) generate a scramble that produces that state? Everything downstream
// depends on both answers being yes.

import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

// ---------------------------------------------------------------------------
// 1. Learn the puzzle's conventions empirically rather than hardcoding indices.
// ---------------------------------------------------------------------------
function movedPieces(pattern, orbit) {
  const solvedOrbit = SOLVED.patternData[orbit];
  const o = pattern.patternData[orbit];
  const moved = [];
  for (let i = 0; i < o.pieces.length; i++) {
    if (o.pieces[i] !== solvedOrbit.pieces[i] || o.orientation[i] !== solvedOrbit.orientation[i]) {
      moved.push(i);
    }
  }
  return moved;
}

const afterU = SOLVED.applyAlg(new Alg("U"));
const U_CORNERS = movedPieces(afterU, "CORNERS");
const U_EDGES = movedPieces(afterU, "EDGES");

console.log("orbits:", Object.keys(SOLVED.patternData).join(", "));
console.log("U-layer corner indices:", U_CORNERS.join(","));
console.log("U-layer edge indices:  ", U_EDGES.join(","));

const ALL_CORNERS = [...SOLVED.patternData.CORNERS.pieces.keys()];
const ALL_EDGES = [...SOLVED.patternData.EDGES.pieces.keys()];
const F2L_CORNERS = ALL_CORNERS.filter((i) => !U_CORNERS.includes(i));
const F2L_EDGES = ALL_EDGES.filter((i) => !U_EDGES.includes(i));

// ---------------------------------------------------------------------------
// 2. Case state from an algorithm.
// ---------------------------------------------------------------------------
/** "[U2] R' U' R" -> "U2 R' U' R" */
function normaliseSheetAlg(raw) {
  return raw
    .replace(/\[\s*(U2|U'|U)\s*\]/g, "$1")
    .replace(/[‘’]/g, "'") // curly apostrophes
    .replace(/[​-‍﻿]/g, "") // zero-width chars
    .replace(/\s+/g, " ")
    .trim();
}

function caseStateFromAlg(raw) {
  const alg = new Alg(normaliseSheetAlg(raw));
  return SOLVED.applyAlg(alg.invert());
}

function describeLegality(pattern) {
  const problems = [];
  const c = pattern.patternData.CORNERS;
  const e = pattern.patternData.EDGES;

  for (const i of F2L_CORNERS) {
    if (c.pieces[i] !== i || c.orientation[i] !== 0) problems.push(`F2L corner ${i} disturbed`);
  }
  for (const i of F2L_EDGES) {
    if (e.pieces[i] !== i || e.orientation[i] !== 0) problems.push(`F2L edge ${i} disturbed`);
  }
  for (const i of U_EDGES) {
    if (e.orientation[i] !== 0) problems.push(`LL edge at ${i} is flipped (not a ZBLL case)`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// 3. Try real rows lifted from the spreadsheet.
// ---------------------------------------------------------------------------
const SAMPLES = [
  ["S1 first", "R U R' U R U2 R'"],
  ["S1 alt (AUF)", "[U'] R' U2 R U R' U R"],
  ["Pi1", "R' U2 R2 U R2 U R2 U2 R'"],
  ["T1", "R U R' U R U2 R' U2 R' U' R U' R' U2 R"],
  ["H3 wide", "R U R' U R U r' F R' F' r"],
  ["L4 rotation", "[U2] R2' D' r U2 (r' R) U R' D R U R"],
  ["AS3 short", "r' F R F' r U R'"],
];

console.log("\n--- case derivation ---");
const derived = [];
for (const [label, raw] of SAMPLES) {
  try {
    const pattern = caseStateFromAlg(raw);
    const problems = describeLegality(pattern);
    console.log(
      `${problems.length === 0 ? "OK  " : "FAIL"} ${label.padEnd(14)} ${problems[0] ?? ""}`
    );
    if (problems.length === 0) derived.push([label, raw, pattern]);
  } catch (err) {
    console.log(`FAIL ${label.padEnd(14)} parse error: ${err.message}`);
  }
}

// Two algs for the same case must produce the same state.
const a = caseStateFromAlg("R U R' U R U2 R'");
const b = caseStateFromAlg("[U'] R' U2 R U R' U R");
console.log("\ntwo algs -> same state?", a.isIdentical(b));

// ---------------------------------------------------------------------------
// 4. Scramble generation: solve the state, invert the solution.
// ---------------------------------------------------------------------------
console.log("\n--- scramble generation ---");
const [label, raw, pattern] = derived[0];
console.log(`case: ${label}  (${raw})`);

const t0 = Date.now();
const solution = await experimentalSolve3x3x3IgnoringCenters(pattern);
const elapsed = Date.now() - t0;
const scramble = solution.invert();

console.log(`solution: ${solution.toString()}`);
console.log(`scramble: ${scramble.toString()}`);
console.log(`solve took ${elapsed}ms`);

// The whole point: scramble applied to a solved cube must reproduce the case.
const reproduced = SOLVED.applyAlg(scramble);
console.log("scramble reproduces the case state?", reproduced.isIdentical(pattern));

// And the sheet's algorithm must then solve it.
const solvedAgain = reproduced.applyAlg(new Alg(normaliseSheetAlg(raw)));
console.log("sheet alg then solves it?        ", solvedAgain.isIdentical(SOLVED));

// ---------------------------------------------------------------------------
// 5. Can we get *variety*? Twenty distinct scrambles per case is the plan.
// ---------------------------------------------------------------------------
console.log("\n--- variety check (same case, 6 attempts) ---");
const seen = new Set();
for (let i = 0; i < 6; i++) {
  const s = (await experimentalSolve3x3x3IgnoringCenters(pattern)).invert().toString();
  seen.add(s);
  console.log(`  ${s}`);
}
console.log(`distinct: ${seen.size} of 6`);
