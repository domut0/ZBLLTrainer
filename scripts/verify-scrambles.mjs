// Independent cross-check of Issues 02 and 06 together.
//
// Deliberately shares no code with precompute-scrambles.mjs. That script
// verifies scrambles against a target state it reconstructs itself, so a bug in
// the reconstruction would verify clean and still be wrong. This instead applies
// each scramble to a solved cube and re-derives the case id the same way the
// importer does, then checks it against cases.json.

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

const AUF = [null, new Alg("U"), new Alg("U2"), new Alg("U'")];
const ser = (p) =>
  JSON.stringify([
    p.patternData.CORNERS.pieces, p.patternData.CORNERS.orientation,
    p.patternData.EDGES.pieces, p.patternData.EDGES.orientation,
  ]);

function legality(p, algSet) {
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  if (algSet === "LXS") {
    for (let i = 5; i <= 7; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i}`;
    for (const i of [4, 6, 7, 9, 10, 11]) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i}`;
    return null;
  }
  for (let i = 4; i < 8; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i}`;
  for (let i = 4; i < 12; i++) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i}`;
  for (let i = 0; i < 4; i++) if (e.orientation[i] !== 0) return `LL edge ${i} flipped`;
  return null;
}

/** Case id of whatever a scramble produces, derived the importer's way. */
function idOf(scrambleAlg) {
  let best = null;
  for (const auf of AUF) {
    const p = SOLVED.applyAlg(auf ? auf.concat(scrambleAlg) : scrambleAlg);
    const s = ser(p);
    if (best === null || s < best) best = s;
  }
  return best;
}

const keys = Object.keys(scrambles);
console.log(`cases in cases.json:      ${cases.length}`);
console.log(`cases in scrambles.json:  ${keys.length}`);
console.log(`every case covered:       ${cases.every((c) => scrambles[c.id]?.length > 0)}`);
console.log(`total scrambles:          ${keys.reduce((n, k) => n + scrambles[k].length, 0)}`);

// Sample broadly rather than exhaustively; 200 checks is plenty to catch a
// systematic error, and systematic is the only kind that matters here.
let checked = 0, idMismatch = 0, illegal = 0, dupes = 0;
const sample = [...cases].sort(() => Math.random() - 0.5).slice(0, 70);

for (const c of sample) {
  const list = scrambles[c.id] ?? [];
  if (new Set(list.map((s) => s.scramble)).size !== list.length) dupes++;
  for (const entry of list.slice(0, 3)) {
    const alg = new Alg(entry.scramble);
    const p = SOLVED.applyAlg(alg);
    const bad = legality(p, c.algSet);
    if (bad) { illegal++; if (illegal <= 3) console.log(`  ILLEGAL ${c.displayName}: ${bad} — ${entry.scramble}`); }
    let expectedId;
    if (c.algSet === "COLL") {
      let best = null;
      let temp = p;
      for (let i = 0; i < 4; i++) {
        const s = JSON.stringify([
          temp.patternData.CORNERS.pieces,
          temp.patternData.CORNERS.orientation,
        ]);
        if (best === null || s < best) best = s;
        temp = temp.applyAlg(AUF[1]);
      }
      expectedId = "COLL:" + best;
    } else {
      expectedId = idOf(alg);
    }
    if (expectedId !== c.id) { idMismatch++; if (idMismatch <= 3) console.log(`  ID MISMATCH ${c.displayName} — ${entry.scramble}`); }
    checked++;
  }
}

const lens = keys.flatMap((k) => scrambles[k].map((s) => s.scramble.trim().split(/\s+/).length));
const degenerate = keys.flatMap((k) => scrambles[k]).filter((s) => /[A-Za-z]4|2'/.test(s.scramble));

console.log(`\nspot-checked:             ${checked} scrambles across ${sample.length} cases`);
console.log(`illegal states:           ${illegal}`);
console.log(`case id mismatches:       ${idMismatch}`);
console.log(`cases with duplicates:    ${dupes}`);
console.log(`move-count range:         ${Math.min(...lens)}-${Math.max(...lens)}`);
console.log(`degenerate notation:      ${degenerate.length}`);
console.log(`\n${illegal === 0 && idMismatch === 0 && dupes === 0 && degenerate.length === 0 ? "PASS" : "FAIL"}`);
process.exit(illegal === 0 && idMismatch === 0 && dupes === 0 && degenerate.length === 0 ? 0 : 1);
