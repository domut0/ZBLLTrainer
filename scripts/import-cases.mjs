// Issue 02 — seven CSVs to data/cases.json.
//
// The subtleties here were established by scripts/spike*.mjs. See
// .scratch/zbll-trainer/issues/02-case-importer.md for the reasoning.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { llFaceletsAllAufs } from "./facelets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const SETS = [
  ["as.csv", "AS", 72],
  ["s.csv", "S", 72],
  ["pi.csv", "Pi", 72],
  ["h.csv", "H", 40],
  ["l.csv", "L", 72],
  ["u.csv", "U", 72],
  ["t.csv", "T", 72],
];

// ---------------------------------------------------------------------------
// CSV: fields may be quoted and contain newlines (that is how alternatives are
// stored), so a line-based split is not good enough.
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------------------
// Notation cleanup.
// ---------------------------------------------------------------------------
const ZERO_WIDTH = /[​-‍﻿ ]/g;

function normaliseAlg(raw) {
  let s = raw
    .replace(ZERO_WIDTH, " ")
    .replace(/[‘’ʼ′]/g, "'")   // curly apostrophes, prime
    .replace(/\[\s*(U2|U'|U)\s*\]/g, " $1 ")       // AUF bracket -> real move
    .replace(/[()]/g, " ")                          // grouping parens
    .replace(/\s+/g, " ")
    .trim();
  // Trailing fingertrick variant, e.g. "... U L' / r'"
  s = s.replace(/\s*\/.*$/, "").trim();
  // "R3" is a typo for "R'" (R3 == R' on a 3x3, but cubing.js rejects it)
  s = s.replace(/\b([URFDLBMSExyzrufdlb])3'/g, "$1").replace(/\b([URFDLBMSExyzrufdlb])3\b/g, "$1'");
  // "U4" style no-ops
  s = s.replace(/\b([URFDLBMSExyzrufdlb])4'?\b/g, "").replace(/\s+/g, " ").trim();
  return s;
}

// ---------------------------------------------------------------------------
// Rotation normalisation. Algorithms containing x/y/z finish in a rotated
// frame; without correcting, every such row looks like a distinct case.
// ---------------------------------------------------------------------------
const ROTATIONS = [];
for (const a of ["", "x", "x2", "x'", "z", "z'"]) {
  for (const b of ["", "y", "y2", "y'"]) {
    ROTATIONS.push(`${a} ${b}`.trim());
  }
}
const ROTATION_ALGS = ROTATIONS.map((r) => (r ? new Alg(r) : new Alg("")));

function centresSolved(p) {
  const c = p.patternData.CENTERS;
  return c.pieces.every((v, i) => v === SOLVED.patternData.CENTERS.pieces[i]);
}

// Both the rotation fix and the AUF search must be applied to the LEFT of the
// inverted algorithm. Appending U to the resulting pattern is post-multiplication,
// which is not what "the sheet omitted a trailing AUF" means once you invert.
// Brute-force 24 rotations x 4 AUFs as prefixes and keep whatever lands legal.
function analyse(cleaned) {
  let invX;
  try {
    invX = new Alg(cleaned).invert();
  } catch (err) {
    return { error: `parse error: ${err.message}` };
  }
  const legal = [];
  for (const rot of ROTATION_ALGS) {
    for (let i = 0; i < 4; i++) {
      const prefix = AUF_ALGS[i] ? rot.concat(AUF_ALGS[i]) : rot;
      const p = SOLVED.applyAlg(prefix.concat(invX));
      if (!centresSolved(p)) continue;
      if (legality(p)) continue;
      legal.push({ auf: i, ser: serialise(p), pattern: p });
    }
  }
  if (!legal.length) {
    // Report the most informative failure we saw with no correction applied.
    const plain = SOLVED.applyAlg(invX);
    return { error: centresSolved(plain) ? (legality(plain) ?? "no legal orientation") : "cannot de-rotate" };
  }
  const best = legal.reduce((a, b) => (a.ser <= b.ser ? a : b));
  return { id: best.ser, aufOffset: best.auf, state: best.pattern };
}

// ---------------------------------------------------------------------------
// Case identity: canonical over the four AUF rotations.
// ---------------------------------------------------------------------------
const U = new Alg("U");
const serialise = (p) =>
  JSON.stringify([
    p.patternData.CORNERS.pieces, p.patternData.CORNERS.orientation,
    p.patternData.EDGES.pieces, p.patternData.EDGES.orientation,
  ]);

const AUF_ALGS = [null, new Alg("U"), new Alg("U2"), new Alg("U'")];

// ---------------------------------------------------------------------------
// Validation.
// ---------------------------------------------------------------------------
const U_IDX = [0, 1, 2, 3];
function legality(p) {
  const c = p.patternData.CORNERS;
  const e = p.patternData.EDGES;
  for (let i = 4; i < 8; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i} disturbed`;
  for (let i = 4; i < 12; i++) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i} disturbed`;
  for (const i of U_IDX) if (e.orientation[i] !== 0) return `LL edge ${i} flipped (not a ZBLL case)`;
  return null;
}

function toCubeState(p) {
  return {
    corners: { pieces: [...p.patternData.CORNERS.pieces], orientation: [...p.patternData.CORNERS.orientation] },
    edges: { pieces: [...p.patternData.EDGES.pieces], orientation: [...p.patternData.EDGES.orientation] },
  };
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
const fixesPath = join(ROOT, "data", "fixes.json");
const fixes = existsSync(fixesPath) ? JSON.parse(readFileSync(fixesPath, "utf8")) : {};
const fixesUsed = [];

const cases = [];
const rejects = [];
const warnings = [];

for (const [file, setName, expected] of SETS) {
  const rows = parseCsv(readFileSync(join(ROOT, "data", "source", file), "utf8"));
  let group = null;
  let indexInGroup = 0;
  let seenInSet = 0;

  for (let r = 4; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const label = (row[1] ?? "").trim();
    const cell = (row[3] ?? "").trim();
    if (label) { group = label; indexInGroup = 0; }
    if (!cell) continue;
    if (!group) { rejects.push({ set: setName, row: r + 1, reason: "algorithm before any group label" }); continue; }

    indexInGroup++;
    seenInSet++;

    const fixKey = `${setName}|${group}|${indexInGroup}`;
    const source = fixes[fixKey] ?? cell;
    if (fixes[fixKey]) fixesUsed.push(fixKey);

    const algs = [];
    let caseId = null;
    let caseState = null;
    let failed = null;

    for (const line of source.split("\n").map((s) => s.trim()).filter(Boolean)) {
      const cleaned = normaliseAlg(line);
      if (!cleaned) continue;
      // A bad alternative must not sink the whole case. The first algorithm that
      // resolves establishes the identity; later ones that disagree are dropped
      // with a warning, because they are almost always exotic notation this
      // importer mis-reads rather than a genuinely different case.
      const res = analyse(cleaned);
      if (res.error) {
        warnings.push({ set: setName, group, index: indexInGroup, alg: line, reason: res.error });
        continue;
      }
      if (caseId === null) { caseId = res.id; caseState = res.state; }
      else if (res.id !== caseId) {
        warnings.push({ set: setName, group, index: indexInGroup, alg: line, reason: "resolves to a different case than the primary" });
        continue;
      }
      algs.push({ alg: cleaned, aufOffset: res.aufOffset });
    }

    if (failed || !algs.length) {
      rejects.push({ set: setName, group, index: indexInGroup, row: r + 1, reason: failed ?? "no usable algorithm" });
      continue;
    }

    cases.push({
      id: caseId,
      // Every case carries the algorithm set it belongs to. `subset` is the
      // grouping within that set — for ZBLL, the OLL case it starts from.
      algSet: "ZBLL",
      subset: setName,
      group,
      indexInGroup,
      displayName: `${group} #${indexInGroup}`,
      state: toCubeState(caseState),
      // One diagram per AUF, derived here rather than in the app: see the
      // header of scripts/facelets.mjs for why this is not the component's job.
      facelets: llFaceletsAllAufs(caseState),
      algs,
    });
  }

  const got = cases.filter((c) => c.subset === setName).length;
  console.log(`${setName.padEnd(3)} rows seen ${String(seenInSet).padStart(3)}  imported ${String(got).padStart(3)}  expected ${expected}${got === expected ? "" : "   <-- MISMATCH"}`);
}

console.log(`\ntotal imported: ${cases.length} (expect 472)`);
console.log(`unique case ids: ${new Set(cases.map((c) => c.id)).size}`);
console.log(`fixes applied: ${fixesUsed.length}`);
console.log(`rejects: ${rejects.length}`);
for (const rj of rejects.slice(0, 40)) {
  console.log(`  ${rj.set} ${rj.group ?? "?"} #${rj.index ?? "?"} (line ${rj.row}): ${rj.reason}`);
}
if (rejects.length > 40) console.log(`  ... and ${rejects.length - 40} more`);

console.log(`\ndropped alternatives (case kept): ${warnings.length}`);
for (const w of warnings) console.log(`  ${w.set} ${w.group} #${w.index}: ${w.reason} — "${w.alg}"`);

const algCount = cases.reduce((n, c) => n + c.algs.length, 0);
console.log(`\nalgorithms retained: ${algCount} across ${cases.length} cases`);
console.log(`cases with no alternatives left: ${cases.filter((c) => c.algs.length === 0).length}`);

writeFileSync(join(ROOT, "data", "cases.json"), JSON.stringify(cases, null, 0));
writeFileSync(join(ROOT, "data", "rejects.json"), JSON.stringify({ rejects, warnings }, null, 2));
console.log("\nwrote data/cases.json and data/rejects.json");
