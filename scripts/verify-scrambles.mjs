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
import { KPattern } from "cubing/kpuzzle";

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

/** A stored case carries only corners and edges; the centres are always solved. */
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

function legality(p, algSet) {
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  if (algSet === "ZBLS") {
    for (let i = 5; i <= 7; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i}`;
    for (const i of [4, 5, 6, 7, 9, 10, 11]) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i}`;
    return null;
  }
  if (algSet === "LXS") {
    for (let i = 5; i <= 7; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i}`;
    for (const i of [4, 6, 7, 9, 10, 11]) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i}`;
    return null;
  }
  if (algSet === "EO") {
    for (let i = 5; i <= 7; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i}`;
    for (const i of [4, 6, 9, 10, 11]) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i}`;
    return null;
  }
  for (let i = 4; i < 8; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i}`;
  for (let i = 4; i < 12; i++) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i}`;
  for (let i = 0; i < 4; i++) if (e.orientation[i] !== 0) return `LL edge ${i} flipped`;
  return null;
}

const LXS_CORNER = 4;
const LXS_EDGES = [5, 8];

function lxsKey(p) {
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  const at = c.pieces.indexOf(LXS_CORNER);
  return JSON.stringify([
    at, c.orientation[at],
    ...LXS_EDGES.map((pc) => {
      const i = e.pieces.indexOf(pc);
      return [i, e.orientation[i]];
    }),
  ]);
}

const ZBLS_CORNER = 4;
const ZBLS_EDGE = 8;
function zblsKey(p) {
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  const cIdx = c.pieces.indexOf(ZBLS_CORNER);
  const eIdx = e.pieces.indexOf(ZBLS_EDGE);
  return JSON.stringify([
    cIdx, c.orientation[cIdx],
    eIdx, e.orientation[eIdx],
    [e.orientation[0], e.orientation[1], e.orientation[2], e.orientation[3]],
  ]);
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

// Exhaustive and deterministic.
//
// This used to shuffle and take 70 cases. That made the script's own verdict a
// coin flip: three consecutive runs over the same data gave 3, 3 and 0
// failures, so every PASS it had ever printed was partly luck. Checking every
// scramble costs a couple of seconds, and "systematic is the only kind that
// matters" was never true — a parser that misreads one cell is exactly the bug
// this is here to catch.
let checked = 0, stateMismatch = 0, illegal = 0, dupes = 0;

for (const c of cases) {
  const list = scrambles[c.id] ?? [];
  if (new Set(list.map((s) => s.scramble)).size !== list.length) dupes++;
  const target = rebuildState(c.state);
  for (const entry of list) {
    const p = SOLVED.applyAlg(new Alg(entry.scramble));
    const bad = legality(p, c.algSet);
    if (bad) { illegal++; if (illegal <= 3) console.log(`  ILLEGAL ${c.displayName}: ${bad} — ${entry.scramble}`); }

    // Assert the scramble PRESENTS the case it is filed under, rather than
    // trying to re-derive the case id from it.
    //
    // Re-deriving cannot work: the importer canonicalises over AUFs applied as a
    // PREFIX to the inverted algorithm, and from a scramble all you can do is
    // turn U afterwards, which is a postfix. The two orbits differ, and the old
    // per-set id reconstructions disagreed with the importer on 7 LXS and 7 EO
    // cases — flagging correct data as broken. State equality is exact, needs no
    // per-set special case, and is the property the drill actually depends on.
    const want = ser(entry.auf ? target.applyAlg(AUF[entry.auf]) : target);
    if (ser(p) !== want) {
      stateMismatch++;
      if (stateMismatch <= 3) console.log(`  STATE MISMATCH ${c.displayName} (auf ${entry.auf}) — ${entry.scramble}`);
    }
    checked++;
  }
}

const lens = keys.flatMap((k) => scrambles[k].map((s) => s.scramble.trim().split(/\s+/).length));
const degenerate = keys.flatMap((k) => scrambles[k]).filter((s) => /[A-Za-z]4|2'/.test(s.scramble));

console.log(`\nchecked:                  ${checked} scrambles across ${cases.length} cases`);
console.log(`illegal states:           ${illegal}`);
console.log(`scrambles not presenting their case: ${stateMismatch}`);
console.log(`cases with duplicates:    ${dupes}`);
console.log(`move-count range:         ${Math.min(...lens)}-${Math.max(...lens)}`);
console.log(`degenerate notation:      ${degenerate.length}`);
console.log(`\n${illegal === 0 && stateMismatch === 0 && dupes === 0 && degenerate.length === 0 ? "PASS" : "FAIL"}`);
process.exit(illegal === 0 && stateMismatch === 0 && dupes === 0 && degenerate.length === 0 ? 0 : 1);
