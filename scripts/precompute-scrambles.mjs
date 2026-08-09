import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { KPattern } from "cubing/kpuzzle";
import { experimentalSolve3x3x3IgnoringCenters as solve } from "cubing/search";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

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

function parseAmount(modifier) {
  if (!modifier) return 1;
  if (modifier === "'") return 3;
  if (modifier === "2") return 2;
  if (modifier === "2'") return 2;
  if (modifier === "3") return 3;
  if (modifier === "3'") return 1;
  if (modifier === "4" || modifier === "4'") return 0;

  if (modifier.includes("2")) return 2;
  if (modifier.includes("3")) return modifier.includes("'") ? 1 : 3;
  if (modifier.includes("4")) return 0;
  if (modifier.includes("'")) return 3;
  return 1;
}

function cleanScramble(scrambleStr) {
  const moves = scrambleStr.split(/\s+/).filter(Boolean);
  const stack = [];
  for (const move of moves) {
    const match = move.match(/^([URFDLBmsdflrpxyz]+)(.*)$/);
    if (!match) continue;
    const face = match[1];
    const modifier = match[2];
    const amount = parseAmount(modifier);
    if (amount === 0) continue;

    if (stack.length > 0 && stack[stack.length - 1].face === face) {
      const top = stack.pop();
      const newAmount = (top.amount + amount) % 4;
      if (newAmount !== 0) {
        stack.push({ face, amount: newAmount });
      }
    } else {
      stack.push({ face, amount });
    }
  }

  return stack.map(m => {
    if (m.amount === 1) return m.face;
    if (m.amount === 2) return m.face + "2";
    if (m.amount === 3) return m.face + "'";
    return "";
  }).filter(Boolean).join(" ");
}

async function main() {
  const tStart = Date.now();
  
  // 1. Initialise cubing.js
  const kpuzzle = await cube3x3x3.kpuzzle();
  const SOLVED = kpuzzle.defaultPattern();

  // 2. Load cases.json
  const casesPath = join(ROOT, "data", "cases.json");
  const cases = JSON.parse(readFileSync(casesPath, "utf8"));
  console.log(`Loaded ${cases.length} cases from data/cases.json`);

  const scramblesPath = join(ROOT, "data", "scrambles.json");
  const existingScrambles = existsSync(scramblesPath) ? JSON.parse(readFileSync(scramblesPath, "utf8")) : {};

  const scramblesData = {};
  
  let totalScrambles = 0;
  let minLength = 999;
  let maxLength = 0;
  let failedVerificationCount = 0;

  const AUFS = [
    { val: 0, alg: new Alg("") },
    { val: 1, alg: new Alg("U") },
    { val: 2, alg: new Alg("U2") },
    { val: 3, alg: new Alg("U'") }
  ];

  // Helper to rebuild state from case.state
  function rebuildState(cubeState) {
    return new KPattern(kpuzzle, {
      CORNERS: {
        pieces: [...cubeState.corners.pieces],
        orientation: [...cubeState.corners.orientation]
      },
      EDGES: {
        pieces: [...cubeState.edges.pieces],
        orientation: [...cubeState.edges.orientation]
      },
      CENTERS: {
        pieces: [...SOLVED.patternData.CENTERS.pieces],
        orientation: [...SOLVED.patternData.CENTERS.orientation],
        orientationMod: [...SOLVED.patternData.CENTERS.orientationMod]
      }
    });
  }

  const serialise = (p) =>
    JSON.stringify([
      p.patternData.CORNERS.pieces, p.patternData.CORNERS.orientation,
      p.patternData.EDGES.pieces, p.patternData.EDGES.orientation,
    ]);

  /**
   * Cached scrambles are reusable only if they still land on the case they are
   * filed under. Solving is the slow part of this script and re-solving 9000
   * unchanged cases to add one set is waste — but a cache keyed on the case id
   * alone would survive a change to that case's *state*, leaving scrambles
   * that quietly present the wrong cube. Re-checking is cheap; re-solving is
   * not, so check every one.
   */
  function cacheIsGood(entries, targetState) {
    if (!Array.isArray(entries) || entries.length === 0) return false;
    for (const entry of entries) {
      if (typeof entry?.scramble !== "string" || !AUFS.some((a) => a.val === entry.auf)) return false;
      const want = serialise(targetState.applyAlg(AUFS[entry.auf].alg));
      let got;
      try {
        got = serialise(SOLVED.applyAlg(new Alg(entry.scramble)));
      } catch {
        return false;
      }
      if (got !== want) return false;
    }
    return true;
  }

  let reusedCases = 0;

  for (let idx = 0; idx < cases.length; idx++) {
    const c = cases[idx];
    const targetState = rebuildState(c.state);
    if (cacheIsGood(existingScrambles[c.id], targetState)) {
      scramblesData[c.id] = existingScrambles[c.id];
      reusedCases++;
      continue;
    }
    const caseScrambles = [];
    const seenScrambles = new Set();

    for (const aufObj of AUFS) {
      const targetState_auf = targetState.applyAlg(aufObj.alg);
      const targetSolutionInverted = (await solve(targetState_auf)).invert();

      let generated = 0;
      let attempts = 0;

      while (generated < 5) {
        attempts++;
        if (attempts > 500) {
          console.error(`Error: Too many attempts generating scramble for case ${c.id} AUF ${aufObj.val}`);
          process.exit(1);
        }

        const a = randomMoves(9);
        const afterA = SOLVED.applyAlg(a);
        const b = await solve(afterA);
        const s = a.concat(b).concat(targetSolutionInverted).experimentalSimplify({ cancel: true });
        const cleaned = cleanScramble(s.toString());

        // Check length
        const moves = cleaned.split(" ").filter(Boolean);
        const len = moves.length;
        if (len < 15 || len > 35) {
          continue;
        }

        // Check duplicates within this case
        if (seenScrambles.has(cleaned)) {
          continue;
        }

        // Verify state correctness
        const verifiedState = SOLVED.applyAlg(new Alg(cleaned));
        if (!verifiedState.isIdentical(targetState_auf)) {
          failedVerificationCount++;
          console.error(`Verification failed!`);
          console.error(`Case: ${c.displayName} (${c.id})`);
          console.error(`AUF: ${aufObj.val}`);
          console.error(`Scramble: ${cleaned}`);
          process.exit(1);
        }

        // Accept the scramble
        seenScrambles.add(cleaned);
        caseScrambles.push({
          scramble: cleaned,
          auf: aufObj.val
        });

        // Track stats
        if (len < minLength) minLength = len;
        if (len > maxLength) maxLength = len;
        totalScrambles++;
        generated++;
      }
    }

    scramblesData[c.id] = caseScrambles;

    // Log progress periodically
    if ((idx + 1) % 50 === 0 || idx === cases.length - 1) {
      console.log(`Processed ${idx + 1}/${cases.length} cases...`);
    }
  }

  // 4. Write data/scrambles.json
  writeFileSync(scramblesPath, JSON.stringify(scramblesData, null, 0));

  const tEnd = Date.now();
  const durationSec = ((tEnd - tStart) / 1000).toFixed(2);

  console.log("\n--- Precomputation Complete ---");
  console.log(`Total cases processed: ${cases.length}`);
  console.log(`Cases reused from cache: ${reusedCases} of ${cases.length}`);
  console.log(`Total scrambles generated: ${totalScrambles}`);
  console.log(`Failed verifications: ${failedVerificationCount}`);
  console.log(`Scramble length range: ${minLength} to ${maxLength} moves`);
  console.log(`Wrote output to: data/scrambles.json`);
  console.log(`Time taken: ${durationSec} seconds`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
