// Spike 6 — the Issue 07 trap.
//
// A case is served at a random AUF. The stored algorithm was written for one
// orientation and carries an `aufOffset`. What exactly has to be prepended or
// appended so the printed algorithm solves the cube actually in the user's hands?
//
// Derivation, writing X.Y for "do X then Y", and treating a pattern as the
// transformation that produces it from solved:
//
//   The importer built the case as   C = U^o . A^-1        (ignoring rotations)
//   so                               A = C^-1 . U^o
//   and therefore                    C^-1 = A . U^-o
//
//   A scramble tagged auf k leaves the cube at   S = C . U^k
//   To solve it we need X with S.X = identity, i.e.
//
//       X = S^-1 = U^-k . C^-1 = U^-k . A . U^-o
//
// So: a PRE-AUF of -k for the orientation served, and a POST-AUF of -o for the
// trailing AUF the spreadsheet omitted. This spike checks that against the real
// dataset rather than trusting the algebra.
//
// Algorithms containing a rotation (x/y/z, or a wide move, which carries one)
// leave the cube solved but turned in the hands, so "solved" here means solved
// up to a whole-cube rotation.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const cases = JSON.parse(readFileSync(join(ROOT, "data", "cases.json"), "utf8"));
const scrambles = JSON.parse(readFileSync(join(ROOT, "data", "scrambles.json"), "utf8"));

const AUF = ["", "U", "U2", "U'"];
const neg = (i) => (4 - i) % 4;

const ROTATIONS = [];
for (const a of ["", "x", "x2", "x'", "z", "z'"]) {
  for (const b of ["", "y", "y2", "y'"]) ROTATIONS.push(new Alg(`${a} ${b}`.trim()));
}
const SOLVED_UP_TO_ROTATION = new Set(ROTATIONS.map((r) => SOLVED.applyAlg(r).toJSON ? JSON.stringify(SOLVED.applyAlg(r).patternData) : ""));

function isSolvedUpToRotation(p) {
  return SOLVED_UP_TO_ROTATION.has(JSON.stringify(p.patternData));
}

/** The algorithm to print for a case served at `auf`, using stored alg `a`. */
function revealAlg(a, auf) {
  return [AUF[neg(auf)], a.alg, AUF[neg(a.aufOffset)]].filter(Boolean).join(" ");
}

let checked = 0;
let failed = 0;
const failures = [];

// scrambles.json is grouped by AUF, so the first N entries of a case are all
// auf 0 — the one orientation that needs no correction, and so the one that
// passes whether or not the correction works. Take one scramble per AUF.
const acrossAufs = (id) =>
  [0, 1, 2, 3].map((auf) => (scrambles[id] ?? []).find((s) => s.auf === auf)).filter(Boolean);

for (const c of cases) {
  for (const s of acrossAufs(c.id)) {
    for (const a of c.algs) {
      const x = revealAlg(a, s.auf);
      const end = SOLVED.applyAlg(new Alg(s.scramble)).applyAlg(new Alg(x));
      checked++;
      if (!isSolvedUpToRotation(end)) {
        failed++;
        if (failures.length < 8) failures.push(`${c.displayName} auf=${s.auf} offset=${a.aufOffset}\n    scramble: ${s.scramble}\n    reveal:   ${x}`);
      }
    }
  }
}

console.log(`combinations checked: ${checked}`);
console.log(`failures:             ${failed}`);
for (const f of failures) console.log(`  ${f}`);
console.log(failed === 0 ? "\nPASS — U^-auf . alg . U^-offset solves the served case" : "\nFAIL");
process.exit(failed === 0 ? 0 : 1);
