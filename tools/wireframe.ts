// Turns a 3D model into the line drawing of a tile: bun tools/wireframe.ts <model.glb|.stl> <out.svg> [options]
//   --yaw --pitch --roll   view angles in degrees (orthographic)
//   --up x|y|z|-x|-y|-z    which model axis points up (default y)
//   --box w,h              the svg's viewBox size
//   --fit n                the model's on-screen height in box units, less if the box is too narrow for that
//   --floor n              y of the model's lowest point (default: centred)
//   --crease n             angle in degrees past which an edge between two faces is drawn (default 40)
//   --min n                shortest stroke kept, in box units (default 1)
//   --clip lo,hi           keep only the triangles between these fractions of the model's height (drops a stand)
//   --eps n                how far behind a surface a line may sit and still show, as a fraction of the depth (default 0.004)
// The models are NASA's (github.com/nasa/NASA-3D-Resources, free of copyright) and are not kept in this repo.
//
// A line is drawn where the surface ends, folds sharply, or turns away from the eye (its outline); then every line is
// tested against a depth picture of the model, so what a nearer part hides is left out.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const [input, output] = args;
const deg = (name: string) => (Number(opt(name, '0')) * Math.PI) / 180;
const [boxW, boxH] = opt('box', '200,130').split(',').map(Number);
const fit = Number(opt('fit', String(boxH * 0.9)));
const crease = Math.cos((Number(opt('crease', '40')) * Math.PI) / 180);
const minLen = Number(opt('min', '1'));

// ---- triangles, in the model's own space ----
const tris: number[] = []; // x y z, three points per triangle
const data = readFileSync(input);
if (input.endsWith('.stl')) {
  const n = data.readUInt32LE(80);
  for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) tris.push(data.readFloatLE(84 + i * 50 + 12 + k * 4));
} else {
  const jsonLen = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLen).toString());
  const bin = data.subarray(20 + jsonLen + 8);
  const view = (i: number) => { const v = gltf.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
  const accessor = (i: number): number[] => {
    const a = gltf.accessors[i];
    const v = gltf.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC3: 3 }[a.type as 'SCALAR' | 'VEC3'];
    const [bytes, read] = ({ 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] } as Record<number, [number, 'readFloatLE']>)[a.componentType];
    const b = view(a.bufferView);
    const stride = v.byteStride ?? bytes * size;
    const out: number[] = [];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < size; c++) out.push(b[read]((a.byteOffset ?? 0) + k * stride + c * bytes));
    return out;
  };
  // Draco-compressed meshes: three.js ships the decoder
  let draco: any;
  if (gltf.extensionsUsed?.includes('KHR_draco_mesh_compression')) {
    const require = createRequire(import.meta.url);
    const dir = require.resolve('three').replace(/build\/.*$/, 'examples/jsm/libs/draco/');
    draco = await require(dir + 'draco_decoder.js')({ wasmBinary: readFileSync(dir + 'draco_decoder.wasm') });
  }
  const primitive = (p: any): { pos: number[]; idx: number[] } => {
    const ext = p.extensions?.KHR_draco_mesh_compression;
    if (!ext) { const pos = accessor(p.attributes.POSITION); return { pos, idx: p.indices != null ? accessor(p.indices) : pos.map((_, i) => i).slice(0, pos.length / 3) }; }
    const raw = view(ext.bufferView);
    const decoder = new draco.Decoder();
    const buffer = new draco.DecoderBuffer();
    buffer.Init(new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength), raw.byteLength);
    const mesh = new draco.Mesh();
    decoder.DecodeBufferToMesh(buffer, mesh);
    const floats = new draco.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, decoder.GetAttributeByUniqueId(mesh, ext.attributes.POSITION), floats);
    const pos = Array.from({ length: mesh.num_points() * 3 }, (_, i) => floats.GetValue(i));
    const face = new draco.DracoInt32Array();
    const idx: number[] = [];
    for (let f = 0; f < mesh.num_faces(); f++) { decoder.GetFaceFromMesh(mesh, f, face); idx.push(face.GetValue(0), face.GetValue(1), face.GetValue(2)); }
    return { pos, idx };
  };
  const walk = (i: number, parent: Matrix4) => {
    const n = gltf.nodes[i];
    const local = n.matrix ? new Matrix4().fromArray(n.matrix)
      : new Matrix4().compose(new Vector3(...(n.translation ?? [0, 0, 0])), new Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new Vector3(...(n.scale ?? [1, 1, 1])));
    const world = parent.clone().multiply(local);
    if (n.mesh != null) for (const p of gltf.meshes[n.mesh].primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const { pos, idx } = primitive(p);
      const v = new Vector3();
      for (const k of idx) { v.fromArray(pos, k * 3).applyMatrix4(world); tris.push(v.x, v.y, v.z); }
    }
    (n.children ?? []).forEach((c: number) => walk(c, world));
  };
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((i: number) => walk(i, new Matrix4()));
}

// ---- the view: x right, y up, z toward the eye ----
const up = opt('up', 'y');
const upright = new Matrix4().makeRotationFromEuler(
  ({ y: new Euler(), '-y': new Euler(Math.PI, 0, 0), z: new Euler(-Math.PI / 2, 0, 0), '-z': new Euler(Math.PI / 2, 0, 0), x: new Euler(0, 0, Math.PI / 2), '-x': new Euler(0, 0, -Math.PI / 2) } as Record<string, Euler>)[up],
);
const viewM = new Matrix4().makeRotationFromEuler(new Euler(deg('pitch'), deg('yaw'), deg('roll'), 'ZXY')).multiply(upright);
let P = new Float64Array(tris.length);
{
  const v = new Vector3();
  for (let i = 0; i < tris.length; i += 3) { v.fromArray(tris, i).applyMatrix4(viewM); P[i] = v.x; P[i + 1] = v.y; P[i + 2] = v.z; }
}
if (args.includes('--clip')) {
  const [lo, hi] = opt('clip', '0,1').split(',').map(Number);
  let [a, b] = [Infinity, -Infinity];
  for (let i = 1; i < P.length; i += 3) { a = Math.min(a, P[i]); b = Math.max(b, P[i]); }
  const keep: number[] = [];
  for (let t = 0; t < P.length; t += 9) {
    const mid = ((P[t + 1] + P[t + 4] + P[t + 7]) / 3 - a) / (b - a);
    if (mid >= lo && mid <= hi) keep.push(...P.subarray(t, t + 9));
  }
  P = Float64Array.from(keep);
}
let [x0, x1, y0, y1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
console.log(`triangles ${P.length / 9}, on screen ${(x1 - x0).toFixed(2)} × ${(y1 - y0).toFixed(2)}, deep ${(z1 - z0).toFixed(2)}`);

// ---- a depth picture of the model, to hide what is behind something ----
const RES = 2400 / Math.max(x1 - x0, y1 - y0);
const W = Math.ceil((x1 - x0) * RES) + 4, H = Math.ceil((y1 - y0) * RES) + 4;
const depth = new Float32Array(W * H).fill(-Infinity);
const sx = (x: number) => (x - x0) * RES + 2, sy = (y: number) => (y1 - y) * RES + 2;
for (let t = 0; t < P.length; t += 9) {
  const [ax, ay, az, bx, by, bz, cx, cy, cz] = [sx(P[t]), sy(P[t + 1]), P[t + 2], sx(P[t + 3]), sy(P[t + 4]), P[t + 5], sx(P[t + 6]), sy(P[t + 7]), P[t + 8]];
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) continue;
  for (let y = Math.max(0, Math.floor(Math.min(ay, by, cy))); y <= Math.min(H - 1, Math.ceil(Math.max(ay, by, cy))); y++)
    for (let x = Math.max(0, Math.floor(Math.min(ax, bx, cx))); x <= Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx))); x++) {
      const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area, w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * az + w1 * bz + w2 * cz;
      if (z > depth[y * W + x]) depth[y * W + x] = z;
    }
}

// ---- which edges are worth a line ----
const Q = 1e5 / Math.max(x1 - x0, y1 - y0, z1 - z0); // weld points that are the same to five digits
const key = (i: number) => `${Math.round(P[i] * Q)},${Math.round(P[i + 1] * Q)},${Math.round(P[i + 2] * Q)}`;
const edges = new Map<string, { a: number; b: number; normals: number[][] }>();
for (let t = 0; t < P.length; t += 9) {
  const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2], vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  const l = Math.hypot(n[0], n[1], n[2]);
  if (l < 1e-12) continue;
  const normal = n.map((c) => c / l);
  for (const [i, j] of [[0, 3], [3, 6], [6, 0]]) {
    const ka = key(t + i), kb = key(t + j);
    if (ka === kb) continue;
    const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    const e = edges.get(k) ?? { a: t + i, b: t + j, normals: [] };
    e.normals.push(normal);
    edges.set(k, e);
  }
}
const EPS = (z1 - z0) * Number(opt('eps', '0.004'));
const scale = Math.min(fit / (y1 - y0), (boxW - 4) / (x1 - x0)); // whichever of height and width runs out first
const floor = Number(opt('floor', String(boxH - (boxH - (y1 - y0) * scale) / 2))); // y of the model's lowest point
const ox = boxW / 2 - ((x0 + x1) / 2) * scale;
const px = (x: number) => ox + x * scale, py = (y: number) => floor - (y - y0) * scale;
const segs: { outline: boolean; p: number[] }[] = []; // x y x y, in box units
const seen = new Set<string>();
const r1 = (n: number) => String(Math.round(n * 10) / 10);
for (const e of edges.values()) {
  const ns = e.normals;
  const outline = ns.length === 1 || ns.some((n) => n[2] > 0) !== ns.every((n) => n[2] > 0);
  const fold = ns.length > 1 && ns.some((n, i) => i > 0 && n[0] * ns[0][0] + n[1] * ns[0][1] + n[2] * ns[0][2] < crease);
  if (!outline && !fold) continue;
  const [ax, ay, az, bx, by, bz] = [P[e.a], P[e.a + 1], P[e.a + 2], P[e.b], P[e.b + 1], P[e.b + 2]];
  const steps = Math.max(1, Math.ceil(Math.hypot(sx(bx) - sx(ax), sy(by) - sy(ay))));
  let start = -1;
  const flush = (end: number) => {
    if (start < 0) return;
    const [f0, f1] = [start / steps, end / steps];
    const [mx, my, lx, ly] = [px(ax + (bx - ax) * f0), py(ay + (by - ay) * f0), px(ax + (bx - ax) * f1), py(ay + (by - ay) * f1)];
    start = -1;
    const id = [r1(mx), r1(my), r1(lx), r1(ly)];
    const k = id.join(' '), back = [id[2], id[3], id[0], id[1]].join(' ');
    if (seen.has(k) || seen.has(back) || (id[0] === id[2] && id[1] === id[3])) return;
    seen.add(k);
    segs.push({ outline, p: [mx, my, lx, ly] });
  };
  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    const X = Math.round(sx(ax + (bx - ax) * f)), Y = Math.round(sy(ay + (by - ay) * f)), z = az + (bz - az) * f;
    // the least of the neighbouring depths: on an outline the surface next to the line rises steeply and would hide it
    let nearest = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = X + dx, yy = Y + dy;
      nearest = Math.min(nearest, xx < 0 || yy < 0 || xx >= W || yy >= H ? -Infinity : depth[yy * W + xx]);
    }
    if (z + EPS >= nearest) { if (start < 0) start = s; } else flush(s - 1);
  }
  flush(steps);
}
// ---- join the pieces end to end into long strokes: a curved outline is thousands of edges shorter than a pixel ----
const strokes = (outline: boolean) => {
  const list = segs.filter((g) => g.outline === outline);
  const ends = new Map<string, number[]>();
  const at = (x: number, y: number) => r1(x) + ' ' + r1(y);
  list.forEach((g, i) => { for (const k of [at(g.p[0], g.p[1]), at(g.p[2], g.p[3])]) ends.set(k, [...(ends.get(k) ?? []), i]); });
  const used = new Uint8Array(list.length);
  const out: string[] = [];
  let count = 0;
  list.forEach((g, i) => {
    if (used[i]) return;
    used[i] = 1;
    let line = [...g.p];
    for (const forward of [true, false]) {
      for (;;) {
        const n = line.length;
        const [x, y, fromX, fromY] = forward ? [line[n - 2], line[n - 1], line[n - 4], line[n - 3]] : [line[0], line[1], line[2], line[3]];
        // carry on with the piece that turns the least
        let best = -1, bestTurn = -0.2, flip = false;
        for (const j of ends.get(at(x, y)) ?? []) {
          if (used[j]) continue;
          const q = list[j].p;
          const starts = at(q[0], q[1]) === at(x, y);
          const [tx, ty] = starts ? [q[2] - q[0], q[3] - q[1]] : [q[0] - q[2], q[1] - q[3]];
          const turn = ((x - fromX) * tx + (y - fromY) * ty) / (Math.hypot(x - fromX, y - fromY) * Math.hypot(tx, ty) || 1);
          if (turn > bestTurn) { best = j; bestTurn = turn; flip = !starts; }
        }
        if (best < 0) break;
        used[best] = 1;
        const q = list[best].p;
        const next = flip ? [q[0], q[1]] : [q[2], q[3]];
        line = forward ? [...line, ...next] : [...next, ...line];
      }
    }
    // drop the points a straight run does not need
    const keep = [0];
    for (let k = 2; k < line.length - 2; k += 2) {
      const a = keep[keep.length - 1];
      const [dx, dy] = [line[k + 2] - line[a], line[k + 3] - line[a + 1]];
      if (Math.abs((line[k] - line[a]) * dy - (line[k + 1] - line[a + 1]) * dx) / (Math.hypot(dx, dy) || 1) > 0.12) keep.push(k);
    }
    keep.push(line.length - 2);
    let length = 0;
    for (let k = 1; k < keep.length; k++) length += Math.hypot(line[keep[k]] - line[keep[k - 1]], line[keep[k] + 1] - line[keep[k - 1] + 1]);
    if (length < minLen) return;
    count++;
    out.push('M' + keep.map((k) => r1(line[k]) + ' ' + r1(line[k + 1])).join('L'));
  });
  return { d: out.join(''), count };
};
const [folds, outlines] = [strokes(false), strokes(true)];
const path = (d: string, extra: string) => `<path ${extra} d="${d}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boxW} ${boxH}" fill="none" stroke="#c6ccea" stroke-linecap="round">`
  + path(folds.d, 'stroke-opacity=".45" stroke-width=".6" vector-effect="non-scaling-stroke"') + path(outlines.d, 'stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"') + '</svg>\n';
writeFileSync(output, svg);
console.log(`${folds.count + outlines.count} strokes, ${(svg.length / 1024).toFixed(1)} kB → ${output}`);
