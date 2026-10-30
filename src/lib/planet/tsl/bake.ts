import {
  Fn, float, mix, normalize, floor, fract, abs, clamp, select, smoothstep, cos, uniform, uv, vec2, vec3, vec4,
  positionGeometry, dot, If, max, texture,
} from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import type { Node, Texture } from 'three/webgpu';
import { Vector3 } from 'three';
import { dirFromUv, fbm, gnoise } from './common';

/** Every bake material draws one horizontal strip of an equirect texture, so a bake can be spread over frames. */
export const strip = { index: uniform(0), count: uniform(1) };

const stripVertex = vec4(
  positionGeometry.x,
  positionGeometry.y.div(strip.count).add(strip.index.mul(2).add(1).div(strip.count).sub(1)),
  0,
  1,
);
const stripUv = () => vec2(uv().x, strip.index.add(uv().y).div(strip.count));

const bakeMaterial = (fragment: Node) => {
  const m = new NodeMaterial();
  m.vertexNode = stripVertex;
  m.fragmentNode = fragment;
  m.depthTest = false;
  m.depthWrite = false;
  return m;
};

export interface TerrainUniforms {
  seed: ReturnType<typeof uniform<Vector3>>;
  cfreq: ReturnType<typeof uniform>;
  amp: ReturnType<typeof uniform>;
  ridge: ReturnType<typeof uniform>;
  warp: ReturnType<typeof uniform>;
  terrace: ReturnType<typeof uniform>;
  dry: ReturnType<typeof uniform>;
}

export const createTerrainUniforms = (): TerrainUniforms => ({
  seed: uniform(new Vector3()),
  cfreq: uniform(1.15), amp: uniform(0.2), ridge: uniform(0.16),
  warp: uniform(0), terrace: uniform(0), dry: uniform(0),
});

/** Pass 1: terrain height into a float32 target (one evaluation per texel). */
export const createTerrainHeightBake = (t: TerrainUniforms) => {
  const height = Fn(([p]: [Node]) => {
    const q = p.toVar();
    q.addAssign(
      vec3(
        fbm(p.mul(2).add(t.seed).add(vec3(4, 4, 4)), 3),
        fbm(p.mul(2).add(t.seed).add(vec3(9, 9, 9)), 3),
        fbm(p.mul(2).add(t.seed).add(vec3(15, 15, 15)), 3),
      ).mul(t.warp.mul(0.35)),
    );
    const c = fbm(q.mul(t.cfreq).add(t.seed), 5).mul(1.9);
    const land = select(t.dry.greaterThan(0.5), float(1), smoothstep(0.02, 0.22, c));
    const m = fbm(q.mul(4).add(t.seed.mul(1.7)), 6);
    const rdg = float(1).sub(abs(gnoise(q.mul(7).add(t.seed.mul(2.3))).mul(2))).toVar();
    rdg.assign(rdg.mul(rdg));
    const relief = fbm(q.mul(2.5).add(t.seed), 3).mul(0.9).add(0.55);
    const mount = select(t.dry.greaterThan(0.5), relief, smoothstep(0.14, 0.45, c).mul(relief));
    const h = c.add(land.mul(m.mul(t.amp).add(rdg.mul(t.ridge).mul(mount)))).toVar();
    If(t.terrace.greaterThan(0.5), () => {
      const s = h.mul(t.terrace);
      h.assign(floor(s).add(smoothstep(0.3, 0.7, fract(s))).div(t.terrace));
    });
    return h;
  });
  return bakeMaterial(Fn(() => vec4(height(dirFromUv(stripUv())), 0, 0, 1))());
};

/** Pass 1 for clouds: coverage density. */
export const createCloudDensityBake = (seed: ReturnType<typeof uniform<Vector3>>) => {
  const density = Fn(([p]: [Node]) => {
    const q = p.mul(2.4).add(seed.mul(0.31));
    const w = vec3(
      fbm(q.mul(1.2), 3),
      fbm(q.mul(1.2).add(vec3(5.2, 1.3, 2.8)), 3),
      fbm(q.mul(1.2).add(vec3(1.7, 9.2, 4.4)), 3),
    );
    const f = fbm(q.add(w.mul(1.4)), 6).mul(2);
    // storm tracks in the mid latitudes, a calmer belt on the equator
    const bands = cos(p.y.mul(11).add(w.x.mul(3))).mul(0.1).add(smoothstep(0.25, 0, abs(p.y)).mul(0.06));
    return smoothstep(0.16, 0.62, f.add(bands).sub(0.02));
  });
  return bakeMaterial(Fn(() => vec4(density(dirFromUv(stripUv())), 0, 0, 1))());
};

/**
 * Pass 2: reads the float height/density back at the neighbouring texels and writes
 * r = value, g/b = slope along east/north per radian of arc, a = `aux(direction)`.
 */
export const createSlopePass = (source: Texture, width: number, height: number, aux: (p: Node) => Node) =>
  bakeMaterial(
    Fn(() => {
      const uvn = stripUv();
      const at = (dx: number, dy: number) =>
        texture(source, vec2(uvn.x.add(dx / width), clamp(uvn.y.add(dy / height), 0, 1))).level(0).x;
      const cosLat = max(cos(uvn.y.sub(0.5).mul(Math.PI)), 0.05);
      const gx = at(1, 0).sub(at(-1, 0)).div(cosLat.mul((4 * Math.PI) / width));
      const gy = at(0, 1).sub(at(0, -1)).div((2 * Math.PI) / height);
      return vec4(at(0, 0), clamp(gx, -9, 9), clamp(gy, -9, 9), aux(dirFromUv(uvn)));
    })(),
  );

export const terrainMoisture = (seed: ReturnType<typeof uniform<Vector3>>) => (p: Node) =>
  fbm(p.mul(2.2).add(seed.mul(0.7)).add(vec3(9.1, 9.1, 9.1)), 4).mul(1.7).add(0.5);

export interface SkyUniforms {
  seed: ReturnType<typeof uniform<Vector3>>;
  a: ReturnType<typeof uniform<Vector3>>;
  b: ReturnType<typeof uniform<Vector3>>;
  c: ReturnType<typeof uniform<Vector3>>;
}
export const createSkyUniforms = (): SkyUniforms => ({
  seed: uniform(new Vector3()), a: uniform(new Vector3()), b: uniform(new Vector3()), c: uniform(new Vector3()),
});

/** Linear-light nebula and galactic band; stars are drawn procedurally by the dome itself. */
export const createSkyBake = (s: SkyUniforms) =>
  bakeMaterial(
    Fn(() => {
      const d = dirFromUv(stripUv());
      const G = normalize(vec3(0.28, 0.86, 0.42));
      const b = dot(d, G);
      const band = b.mul(b).mul(-14).exp();
      const core = b.mul(b).mul(-90).exp();
      const cloud = fbm(d.mul(3.2).add(s.seed.mul(0.4)), 6).mul(0.5).add(0.5);
      const dust = smoothstep(0.35, 0.7, fbm(d.mul(7).add(s.seed), 5).mul(0.5).add(0.5));
      const haze = fbm(d.mul(1.4).add(s.seed.mul(0.2)), 4).mul(0.5).add(0.5);

      let col = vec3(0.004, 0.005, 0.014);
      col = col.add(mix(s.b, s.a, haze).mul(haze.mul(haze).mul(0.8).add(0.16)).mul(0.3));
      col = col.add(
        mix(s.a, s.b, cloud).mul(0.55).add(s.c.mul(core).mul(0.5)).mul(band).mul(cloud).mul(0.55).mul(float(1).sub(dust.mul(0.7))),
      );
      return vec4(col, 1);
    })(),
  );
