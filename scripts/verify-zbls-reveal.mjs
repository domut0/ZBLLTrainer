// Does the algorithm the app will PRINT actually solve the cube in the user's
// hands, for every ZBLS case, every algorithm and every AUF?
//
// Checks exhaustively across all ZBLS cases, algorithms and AUFs.

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

function zblsSolvedInFrame(p) {
  const c = p.patternData.CORNERS;
  const e = p.patternData.EDGES;
  if (c.pieces[4] !== 4 || c.orientation[4] !== 0) return false;
  for (let i = 5; i <= 7; i++) {
    if (c.pieces[i] !== i || c.orientation[i] !== 0) return false;
  }
  if (e.pieces[8] !== 8 || e.orientation[8] !== 0) return false;
  for (const i of [4, 5, 6, 7, 9, 10, 11]) {
    if (e.pieces[i] !== i || e.orientation[i] !== 0) return false;
  }
  for (let i = 0; i < 4; i++) {
    if (e.orientation[i] !== 0) return false;
  }
  return true;
}

const zblsSolved = (p) => ROTATION_ALGS.some((r) => zblsSolvedInFrame(p.applyAlg(r)));

const zbls = cases.filter((c) => c.algSet === "ZBLS");
let checked = 0;
const failures = [];
let crossChecked = 0;

for (const c of zbls) {
  const base = rebuildState(c.state);
  for (let auf = 0; auf < 4; auf++) {
    const served = auf ? base.applyAlg(new Alg(AUF_MOVES[auf])) : base;
    for (let i = 0; i < c.algs.length; i++) {
      const a = c.algs[i];
      const reveal = [AUF_MOVES[invertAuf(auf)], a.alg, AUF_MOVES[invertAuf(a.aufOffset)]]
        .filter(Boolean)
        .join(" ");
      checked++;
      if (!zblsSolved(served.applyAlg(new Alg(reveal)))) {
        failures.push(`${c.displayName} alg[${i}] auf=${auf}: ${reveal}`);
      }

      // Cross-check interchangeability across alternatives
      if (c.algs.length > 1) {
        for (let j = 0; j < c.algs.length; j++) {
          if (i === j) continue;
          const altAlg = c.algs[j];
          const altReveal = [AUF_MOVES[invertAuf(auf)], altAlg.alg, AUF_MOVES[invertAuf(altAlg.aufOffset)]]
            .filter(Boolean)
            .join(" ");
          crossChecked++;
          if (!zblsSolved(served.applyAlg(new Alg(altReveal)))) {
            failures.push(`${c.displayName} altAlg[${j}] on state from alg[${i}] auf=${auf}: ${altReveal}`);
          }
        }
      }
    }
  }
}

console.log(`ZBLS cases:               ${zbls.length}`);
console.log(`reveals checked:          ${checked}`);
if (crossChecked > 0) {
  console.log(`cross-algorithm checks:   ${crossChecked}`);
}
console.log(`failures:                 ${failures.length}`);
if (failures.length) {
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  console.log("\nFAIL");
  process.exit(1);
}
console.log("\nPASS");
