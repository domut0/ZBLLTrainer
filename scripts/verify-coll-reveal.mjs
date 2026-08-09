// Issue 11 — does the algorithm the app will PRINT actually solve the cube in
// the user's hands, for every COLL case, every algorithm and every AUF?
//
// This is not the same question as "did the import succeed". A COLL case's
// twelve algorithms are borrowed from twelve different ZBLL cases, and each
// arrived with an `aufOffset` solved against ITS OWN canonical orientation, not
// the representative's. Inheriting that offset is wrong whenever the two differ
// by a U rotation — rare, because case ids serialise corners first so the
// smallest full state usually carries the smallest corner form too, but not
// never: symmetric corner configurations break the tie the other way. Five of
// the 472 borrowed algorithms landed there, and every one of them produced a
// reveal that does not solve the cube.
//
// The importer now re-solves each offset against the representative. This
// checks it, exhaustively rather than by sampling, because the failures were
// exactly the cases a sample missed.

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

/** Corners home, F2L intact, edge orientation survived. Edge permutation free. */
function collSolvedInFrame(p) {
  const c = p.patternData.CORNERS;
  const e = p.patternData.EDGES;
  return (
    c.pieces.every((v, i) => v === i) &&
    c.orientation.every((v) => v === 0) &&
    e.pieces.slice(4).every((v, i) => v === i + 4) &&
    e.orientation.every((v) => v === 0)
  );
}

// An algorithm carrying a net rotation leaves the cube solved but turned in the
// hands. That counts, and the whole state has to be un-turned together — not
// the corners alone, which is a predicate no cube can satisfy.
const collSolved = (p) => ROTATION_ALGS.some((r) => collSolvedInFrame(p.applyAlg(r)));

const coll = cases.filter((c) => c.algSet === "COLL");
let checked = 0;
const failures = [];

for (const c of coll) {
  const base = rebuildState(c.state);
  for (let auf = 0; auf < 4; auf++) {
    // A scramble tagged auf k leaves the cube at C . U^k (src/drill/reveal.ts).
    const served = auf ? base.applyAlg(new Alg(AUF_MOVES[auf])) : base;
    for (let i = 0; i < c.algs.length; i++) {
      const a = c.algs[i];
      const reveal = [AUF_MOVES[invertAuf(auf)], a.alg, AUF_MOVES[invertAuf(a.aufOffset)]]
        .filter(Boolean)
        .join(" ");
      checked++;
      if (!collSolved(served.applyAlg(new Alg(reveal)))) {
        failures.push(`${c.displayName} alg[${i}] auf=${auf}: ${reveal}`);
      }
    }
  }
}

console.log(`COLL cases:               ${coll.length}`);
console.log(`reveals checked:          ${checked}`);
console.log(`failures:                 ${failures.length}`);
if (failures.length) {
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  console.log("\nFAIL");
  process.exit(1);
}
console.log("\nPASS");
