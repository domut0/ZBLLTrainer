// Spike 5 — pin down the (orbit, ord, ori) -> face/colour mapping from
// PuzzleGeometry rather than deriving cube geometry by hand.
//
// Established here:
//   * PG's CORNERS/EDGES move definitions are identical to the kpuzzle the
//     importer uses, so PG's sticker indices are directly applicable.
//   * PG hands us face normals and per-sticker centroids, which is enough to
//     lay out a last-layer diagram without hand-derived geometry.
import { cube3x3x3 } from "cubing/puzzles";
import { getPuzzleGeometryByName } from "cubing/puzzle-geometry";

const kpuzzle = await cube3x3x3.kpuzzle();
const kdef = kpuzzle.definition;
const pg = getPuzzleGeometryByName("3x3x3", { allMoves: true });
const pgdef = pg.getKPuzzleDefinition(true);

// Only CORNERS and EDGES matter for a last layer; CENTERS orientation differs
// between the two definitions and is irrelevant here.
let match = true;
for (const mv of ["U", "R", "F", "D", "L", "B"]) {
  for (const orbit of ["CORNERS", "EDGES"]) {
    if (JSON.stringify(kdef.moves[mv][orbit]) !== JSON.stringify(pgdef.moves[mv][orbit])) {
      match = false;
      console.log(`MISMATCH ${mv}.${orbit}`);
    }
  }
}
console.log(`CORNERS/EDGES definitions identical: ${match}`);

const dat = pg.get3d();

console.log("\n=== faces ===");
dat.faces.forEach((f, i) => {
  console.log(`  ${i} name=${f.name} coords=[${f.coords.map((n) => n.toFixed(3)).join(", ")}]`);
});

console.log("\n=== face colours (PG's own, chirality-correct) ===");
const faceColour = new Map();
for (const s of dat.stickers) {
  if (s.isDup) continue;
  if (!faceColour.has(s.face)) faceColour.set(s.face, s.color);
}
for (const [f, c] of [...faceColour].sort((a, b) => a[0] - b[0])) {
  console.log(`  face ${f} (${dat.faces[f].name}) -> ${c}`);
}

// Centroid of a sticker polygon: coords is a flat list of 3D points.
function centroid(coords) {
  const n = coords.length / 3;
  const c = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    c[0] += coords[i * 3];
    c[1] += coords[i * 3 + 1];
    c[2] += coords[i * 3 + 2];
  }
  return c.map((v) => v / n);
}

console.log("\n=== U-face stickers (face index for 'U') ===");
const uFace = dat.faces.findIndex((f) => f.name === "U");
for (const s of dat.stickers) {
  if (s.isDup || s.face !== uFace) continue;
  const c = centroid(s.coords);
  console.log(`  ${s.orbit.padEnd(7)} ord=${s.ord} ori=${s.ori}  centroid=[${c.map((v) => v.toFixed(2)).join(", ")}]`);
}

console.log("\n=== corner slot -> (ori -> face) in the solved state ===");
for (let ord = 0; ord < 8; ord++) {
  const row = [];
  for (let ori = 0; ori < 3; ori++) {
    const s = dat.stickers.find((s) => !s.isDup && s.orbit === "CORNERS" && s.ord === ord && s.ori === ori);
    row.push(s ? dat.faces[s.face].name : "?");
  }
  console.log(`  corner ${ord}: ${row.join(" ")}`);
}

console.log("\n=== edge slot -> (ori -> face) in the solved state ===");
for (let ord = 0; ord < 12; ord++) {
  const row = [];
  for (let ori = 0; ori < 2; ori++) {
    const s = dat.stickers.find((s) => !s.isDup && s.orbit === "EDGES" && s.ord === ord && s.ori === ori);
    row.push(s ? dat.faces[s.face].name : "?");
  }
  console.log(`  edge ${ord}: ${row.join(" ")}`);
}
