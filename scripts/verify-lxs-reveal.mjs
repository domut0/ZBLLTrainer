// Does the algorithm the app will PRINT actually solve the cube in the user's
// hands, for every LXS case, every algorithm and every AUF?
//
// Checks exhaustively across all LXS cases and AUFs.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const AUF_MOVES = ["", "U", "U2", "U'"];
const invertAuf = (a) => (4 - a) % 4;

const ROTATIONS = [];
for (const a of ["", "x", "x2", "x'", "z", "z'"]) {
  for (const b of ["", "y", "y2", "y'"]) ROTATIONS.push(`${a} ${b}`.trim());
}
const ROTATION_ALGS = ROTATIONS.map((r) => new Alg(r));

const cases = JSON.parse(readFileSync(join(ROOT, "data", "cases.json"), "utf8"));

function rebuildState(state) {
  return new KPattern(kpuzzle, {
    CORNERS: { pieces: [...state.corners.pieces], orientation: [...state.corners.orientation] },
    EDGES: { pieces: [...state.edges.pieces], orientation: [...state.edges.orientation] },
    CENTERS: {
      pieces: [...SOLVED.patternData.CENTERS.pieces],
      orientation: [...SOLVED.patternData.CENTERS.orientation],
      orientationMod: [...SOLVED.patternData.CENTERS.orientationMod],
    },
  });
}

function lxsSolvedInFrame(p) {
  const c = p.patternData.CORNERS;
  const e = p.patternData.EDGES;
  return (
    c.pieces.every((v, i) => v === i) &&
    c.orientation.every((v) => v === 0) &&
    e.pieces.every((v, i) => v === i) &&
    e.orientation.every((v) => v === 0)
  );
}

const lxsSolved = (p) => ROTATION_ALGS.some((r) => lxsSolvedInFrame(p.applyAlg(r)));

const lxs = cases.filter((c) => c.algSet === "LXS");
let checked = 0;
const failures = [];

for (const c of lxs) {
  const base = rebuildState(c.state);
  for (let auf = 0; auf < 4; auf++) {
    const served = auf ? base.applyAlg(new Alg(AUF_MOVES[auf])) : base;
    for (let i = 0; i < c.algs.length; i++) {
      const a = c.algs[i];
      const reveal = [AUF_MOVES[invertAuf(auf)], a.alg, AUF_MOVES[invertAuf(a.aufOffset)]]
        .filter(Boolean)
        .join(" ");
      checked++;
      if (!lxsSolved(served.applyAlg(new Alg(reveal)))) {
        failures.push(`${c.displayName} alg[${i}] auf=${auf}: ${reveal}`);
      }
    }
  }
}

console.log(`LXS cases:                ${lxs.length}`);
console.log(`reveals checked:          ${checked}`);
console.log(`failures:                 ${failures.length}`);
if (failures.length) {
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  console.log("\nFAIL");
  process.exit(1);
}
console.log("\nPASS");
