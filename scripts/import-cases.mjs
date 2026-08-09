// Issue 02 — seven CSVs to data/cases.json.
//
// The subtleties here were established by scripts/spike*.mjs. See
// .scratch/zbll-trainer/issues/02-case-importer.md for the reasoning.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { llFaceletsAllAufs, stageFaceletsAllAufs } from "./facelets.mjs";

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
    .replace(/\(\s*(U2|U'|U)\s*\)/g, " $1 ")       // AUF parens -> real move
    .replace(/\[\s*(U2|U'|U)\s*\]/g, " $1 ")       // AUF bracket -> real move
    .replace(/([URFDLB])([URFDLB])/g, "$1 $2")       // split unspaced face moves e.g. UD'
    .replace(/([URFDLB])([URFDLB])/g, "$1 $2")
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
    ROTATIONS.push(a ? `${a} ${b}`.trim() : b);
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
function analyse(cleaned, legalityFn = zbllLegality) {
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
      const errStr = legalityFn(p);
      if (errStr) continue;
      legal.push({ auf: i, ser: serialise(p), pattern: p });
    }
  }
  if (!legal.length) {
    // Report the most informative failure we saw with no correction applied.
    const plain = SOLVED.applyAlg(invX);
    return { error: centresSolved(plain) ? (legalityFn(plain) ?? "no legal orientation") : "cannot de-rotate" };
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
// Validation: per-set validity predicates.
// ---------------------------------------------------------------------------
const U_IDX = [0, 1, 2, 3];
function zbllLegality(p) {
  const c = p.patternData.CORNERS;
  const e = p.patternData.EDGES;
  for (let i = 4; i < 8; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i} disturbed`;
  for (let i = 4; i < 12; i++) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i} disturbed`;
  for (const i of U_IDX) if (e.orientation[i] !== 0) return `LL edge ${i} flipped (not a ZBLL case)`;
  return null;
}

function lxsLegality(p) {
  const c = p.patternData.CORNERS;
  const e = p.patternData.EDGES;
  for (let i = 5; i <= 7; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return `F2L corner ${i} disturbed`;
  for (const i of [4, 6, 7, 9, 10, 11]) if (e.pieces[i] !== i || e.orientation[i] !== 0) return `F2L edge ${i} disturbed`;
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
      const res = analyse(cleaned, zbllLegality);
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

// Derive COLL cases from ZBLL cases
function rebuildState(cubeState) {
  return new KPattern(kpuzzle, {
    CORNERS: { pieces: [...cubeState.corners.pieces], orientation: [...cubeState.corners.orientation] },
    EDGES: { pieces: [...cubeState.edges.pieces], orientation: [...cubeState.edges.orientation] },
    CENTERS: {
      pieces: [...SOLVED.patternData.CENTERS.pieces],
      orientation: [...SOLVED.patternData.CENTERS.orientation],
      orientationMod: [...SOLVED.patternData.CENTERS.orientationMod],
    },
  });
}

const collGroups = new Map();
for (const c of cases) {
  const p = rebuildState(c.state);
  const forms = [];
  let temp = p;
  for (let i = 0; i < 4; i++) {
    forms.push(JSON.stringify([
      temp.patternData.CORNERS.pieces,
      temp.patternData.CORNERS.orientation,
    ]));
    temp = temp.applyAlg(U);
  }
  const key = forms.sort()[0];
  if (!collGroups.has(key)) {
    collGroups.set(key, []);
  }
  collGroups.get(key).push(c);
}

// Verify COLL counts
const distinctCollCount = collGroups.size;
const collGroupsArray = Array.from(collGroups.values());
const groupSizes = collGroupsArray.map(g => g.length);
const size8 = groupSizes.filter(s => s === 8).length;
const size12 = groupSizes.filter(s => s === 12).length;

const subsetCounts = {};
for (const list of collGroupsArray) {
  const sub = list[0].subset;
  subsetCounts[sub] = (subsetCounts[sub] || 0) + 1;
}

const expectedSubsets = { AS: 6, S: 6, Pi: 6, H: 4, L: 6, U: 6, T: 6 };
let subsetsMatch = true;
for (const [sub, exp] of Object.entries(expectedSubsets)) {
  if (subsetCounts[sub] !== exp) {
    subsetsMatch = false;
  }
}

if (distinctCollCount !== 40 || size12 !== 38 || size8 !== 2 || !subsetsMatch) {
  console.error("\n[ERROR] COLL derivation failed metrics verification!");
  console.error(`  Distinct COLL count: ${distinctCollCount} (expected 40)`);
  console.error(`  Groups with 12 cases: ${size12} (expected 38)`);
  console.error(`  Groups with 8 cases: ${size8} (expected 2)`);
  console.error("  Subset counts:", subsetCounts);
  process.exit(1);
}

/**
 * COLL is solved when the corners are home and edge orientation survived.
 * Edge PERMUTATION is deliberately not checked — that is the whole point of
 * COLL, and checking it is the mistake an earlier draft of the plan made.
 */
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

/**
 * ...and an algorithm carrying a net rotation — 10 of the 977 do, either an
 * explicit x/y/z or a wide move that drags one along — leaves the cube solved
 * but turned in the hands. That still counts. Undo the turn by brute-forcing
 * the same 24 rotations the importer already uses, rather than trying to read
 * the rotation out of the algorithm text.
 */
function collSolved(p) {
  for (const rot of ROTATION_ALGS) {
    if (collSolvedInFrame(rot.toString() ? p.applyAlg(rot) : p)) return true;
  }
  return false;
}

/**
 * The post-AUF that makes `alg` solve `repPattern`, or null if none does.
 *
 * Mirrors src/drill/reveal.ts at served AUF 0, where the reveal is
 * `alg . U^-offset`. Every other served AUF follows from the same algebra, so
 * getting this right at 0 gets it right everywhere — which the reveal tests
 * check across all four rather than take on trust.
 */
function collAufOffset(repPattern, algString) {
  const applied = repPattern.applyAlg(new Alg(algString));
  for (let offset = 0; offset < 4; offset++) {
    const post = AUF_ALGS[(4 - offset) % 4];
    const end = post ? applied.applyAlg(post) : applied;
    if (collSolved(end)) return offset;
  }
  return null;
}

const collCases = [];
const collAlgFailures = [];
const indexInSubset = {};

for (const list of collGroupsArray) {
  const rep = list[0];
  const sub = rep.subset;
  indexInSubset[sub] = (indexInSubset[sub] || 0) + 1;
  const idx = indexInSubset[sub];

  const p = rebuildState(rep.state);
  const forms = [];
  let temp = p;
  for (let i = 0; i < 4; i++) {
    forms.push(JSON.stringify([
      temp.patternData.CORNERS.pieces,
      temp.patternData.CORNERS.orientation,
    ]));
    temp = temp.applyAlg(U);
  }
  const key = forms.sort()[0];
  const id = "COLL:" + key;
  const displayName = `${sub} #${idx}`;

  // The borrowed algorithms need their AUF offset RECOMPUTED, not inherited.
  //
  // Each member's `aufOffset` was solved against that member's own canonical
  // orientation. A COLL case is served at the representative's orientation,
  // and the two differ by a U rotation whenever the member's corner state is
  // not itself the lexicographically smallest corner form. That is rare —
  // case ids serialise corners first, so the smallest full state usually
  // carries the smallest corner form too — but it is not never: ties, which
  // is to say symmetric corner configurations, break the other way. Five of
  // the 477 borrowed algorithms land there, and inheriting the offset shows
  // the user an algorithm that does not solve the cube in their hands.
  //
  // Solved for rather than derived, in the spirit of scripts/facelets.mjs:
  // try all four offsets against the representative and keep the one that
  // actually works.
  const repPattern = rebuildState(rep.state);
  const algs = [];
  for (const member of list) {
    const a = member.algs[0];
    const offset = collAufOffset(repPattern, a.alg);
    if (offset === null) {
      collAlgFailures.push(`${displayName}: "${a.alg}" (from ${member.displayName}) solves no AUF of the representative`);
      continue;
    }
    algs.push({ alg: a.alg, aufOffset: offset });
  }

  const edgeIndices = [1, 3, 5, 7, 10, 13, 16, 19];
  const facelets = rep.facelets.map(fStr => {
    const chars = [...fStr];
    for (const i of edgeIndices) {
      chars[i] = '?';
    }
    return chars.join("");
  });

  collCases.push({
    id,
    algSet: "COLL",
    subset: "",
    group: sub,
    indexInGroup: idx,
    displayName,
    state: rep.state,
    facelets,
    algs,
  });
}

// A borrowed algorithm that solves no AUF of its representative means the
// grouping is wrong, not that one spreadsheet cell is odd. Fail rather than
// ship a case whose reveal lies.
if (collAlgFailures.length) {
  console.error(`\n[ERROR] ${collAlgFailures.length} COLL algorithms do not solve their case:`);
  for (const f of collAlgFailures.slice(0, 20)) console.error(`  ${f}`);
  process.exit(1);
}

const shortCollCases = collCases.filter((c) => c.algs.length !== 12 && c.algs.length !== 8);
if (shortCollCases.length) {
  console.error(`\n[ERROR] COLL cases with an unexpected algorithm count:`);
  for (const c of shortCollCases) console.error(`  ${c.displayName}: ${c.algs.length}`);
  process.exit(1);
}

const zbllCount = cases.length;
cases.push(...collCases);

// ---------------------------------------------------------------------------
// Import LXS cases (116 cases across 6 column-major sheets)
// ---------------------------------------------------------------------------
const LXS_SHEETS = [
  ["lxs-ufr.csv", "UFR", 30],
  ["lxs-rfu.csv", "RFU", 30],
  ["lxs-fur.csv", "FUR", 30],
  ["lxs-dfr.csv", "DFR", 8],
  ["lxs-rdf.csv", "RDF", 9],
  ["lxs-frd.csv", "FRD", 9],
];

const lxsCases = [];

for (const [file, sheetName, expectedCount] of LXS_SHEETS) {
  const text = readFileSync(join(ROOT, "data", "source", "apb", file), "utf8");
  const rows = parseCsv(text);
  let currentSection = "";
  let sheetImported = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const firstCell = (row[0] ?? "").trim();
    if (firstCell.startsWith("DR edge at")) {
      currentSection = firstCell;
      continue;
    }

    const headersInRow = [];
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] ?? "").trim();
      const m = /^(\d+):\s*([A-Z]{2})\/([A-Z]{2})$/.exec(cell);
      if (m) {
        headersInRow.push({ col: c, caseNum: parseInt(m[1], 10), drEdge: m[2], frEdge: m[3], raw: cell });
      }
    }

    if (headersInRow.length > 0) {
      for (const h of headersInRow) {
        const sourceAlgs = [];
        let blankCount = 0;
        for (let rSub = r + 1; rSub < rows.length; rSub++) {
          const subRow = rows[rSub];
          if (!subRow) { blankCount++; if (blankCount > 10) break; continue; }
          const subFirst = (subRow[0] ?? "").trim();
          if (subFirst.startsWith("DR edge at")) break;
          let isHeader = false;
          for (let c = 0; c < subRow.length; c++) {
            if (/^(\d+):\s*([A-Z]{2})\/([A-Z]{2})$/.exec((subRow[c] ?? "").trim())) {
              isHeader = true; break;
            }
          }
          if (isHeader) break;

          const cellVal = (subRow[h.col] ?? "").trim();
          if (cellVal) {
            blankCount = 0;
            for (const line of cellVal.split("\n")) {
              const cleanedLine = line.trim();
              if (cleanedLine) sourceAlgs.push(cleanedLine);
            }
          } else {
            blankCount++;
            if (blankCount > 10) break;
          }
        }

        const algs = [];
        let caseId = null;
        let caseState = null;

        for (const line of sourceAlgs) {
          const cleaned = normaliseAlg(line);
          if (!cleaned) continue;
          const res = analyse(cleaned, lxsLegality);
          if (res.error) {
            warnings.push({ set: "LXS", group: sheetName, index: h.caseNum, alg: line, reason: res.error });
            continue;
          }
          if (caseId === null) { caseId = res.id; caseState = res.state; }
          else if (res.id !== caseId) {
            warnings.push({ set: "LXS", group: sheetName, index: h.caseNum, alg: line, reason: "resolves to a different case than the primary" });
            continue;
          }
          algs.push({ alg: cleaned, aufOffset: res.aufOffset });
        }

        if (!algs.length) {
          rejects.push({ set: "LXS", group: sheetName, index: h.caseNum, row: r + 1, reason: "no usable algorithm" });
          continue;
        }

        lxsCases.push({
          id: caseId,
          algSet: "LXS",
          subset: "",
          group: sheetName,
          indexInGroup: h.caseNum,
          displayName: `LXS #${h.caseNum}`,
          state: toCubeState(caseState),
          facelets: stageFaceletsAllAufs(caseState),
          algs,
        });
        sheetImported++;
      }
    }
  }

  console.log(`LXS ${sheetName.padEnd(3)} cases imported ${String(sheetImported).padStart(3)}  expected ${expectedCount}${sheetImported === expectedCount ? "" : "   <-- MISMATCH"}`);
}

if (lxsCases.length !== 116) {
  console.error(`\n[ERROR] LXS import count mismatch! Got ${lxsCases.length}, expected 116`);
  process.exit(1);
}

cases.push(...lxsCases);

console.log(`\ntotal ZBLL imported: ${zbllCount} (expect 472)`);
console.log(`total COLL derived: ${collCases.length} (expect 40)`);
console.log(`total LXS imported: ${lxsCases.length} (expect 116)`);
console.log(`total cases: ${cases.length} (expect 628)`);
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


