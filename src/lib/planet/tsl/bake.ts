import {
  Fn, float, mix, normalize, floor, fract, abs, clamp, select, smoothstep, cos, uniform, uv, vec2, vec3, vec4,
  positionGeometry, dot, If, max, texture, length, sin, exp, pow,
} from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import type { Node, Texture } from 'three/webgpu';
import { Vector3 } from 'three';
import { dirFromUv, fbm, gnoise } from './common';
import type { Uniforms } from '../uniforms';

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
  bands: ReturnType<typeof uniform>; // gas giants: band count pole to pole, 0 for rocky worlds
  swirl: ReturnType<typeof uniform>; // gas giants: how far turbulence bends the bands
}

export const createTerrainUniforms = (): TerrainUniforms => ({
  seed: uniform(new Vector3()),
  cfreq: uniform(1.15), amp: uniform(0.2), ridge: uniform(0.16),
  warp: uniform(0), terrace: uniform(0), dry: uniform(0), bands: uniform(0), swirl: uniform(0.05),
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
    // gas giants: no ground at all, just zonal bands along the latitude, bent by turbulence and sheared against each other
    If(t.bands.greaterThan(0.5), () => {
      const turb = fbm(vec3(p.x.mul(2.5), p.y.mul(16), p.z.mul(2.5)).add(t.seed), 4);
      const ly = p.y.add(turb.mul(t.swirl)).mul(t.bands);
      const zone = gnoise(vec3(ly, t.seed.x, t.seed.y)).mul(0.5).add(gnoise(vec3(ly.mul(2.7), t.seed.z, 3)).mul(0.25));
      const eddy = fbm(vec3(p.x.mul(7), ly.mul(1.6), p.z.mul(7)).add(t.seed.mul(1.3)), 4).mul(0.12);
      h.assign(smoothstep(0.12, 0.88, zone.add(0.5).add(eddy))); // contrast, so the bands read as sharply edged stripes
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

/** Second map beside the height. Rocky worlds: moisture. Gas giants: a second, independent set of bands that picks the band's hue. */
export const terrainMoisture = (t: TerrainUniforms) => (p: Node) => {
  const moist = fbm(p.mul(2.2).add(t.seed.mul(0.7)).add(vec3(9.1, 9.1, 9.1)), 4).mul(1.7).add(0.5);
  const turb = fbm(vec3(p.x.mul(2.5), p.y.mul(16), p.z.mul(2.5)).add(t.seed), 4);
  const ly = p.y.add(turb.mul(t.swirl)).mul(t.bands).mul(0.8);
  const hueBand = gnoise(vec3(ly, t.seed.y.add(5), t.seed.z)).mul(0.6).add(gnoise(vec3(ly.mul(2.3), 8, t.seed.x)).mul(0.3)).add(0.5);
  return select(t.bands.greaterThan(0.5), hueBand, moist);
};

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

export const NEBULA_ASPECT = 1.2;

/**
 * A nebula as a picture, painted once into a texture. Six shapes share one set of dust filaments and one colouring
 * (outer dust, middle, hot core, a scatter of tiny stars); each shape only decides where the gas is:
 * 0 emission cloud with cavities, 1 planetary shell, 2 supernova bubble, 3 bipolar lobes, 4 pillars, 5 veil of arcs.
 * Shown on a flat quad, so it costs next to nothing per frame however grand it looks.
 */
export const createNebulaBake = (u: Uniforms) =>
  bakeMaterial(
    Fn(() => {
      const uvn = stripUv();
      const q = vec2(uvn.x.sub(0.5).mul(2 * NEBULA_ASPECT), uvn.y.sub(0.5).mul(2));
      const seed = u.sky.seed;
      const ridge = (n: Node, k: number) => pow(clamp(float(1).sub(abs(n.mul(k))), 0, 1), 2);

      const centre = vec2(sin(seed.x).mul(0.2), sin(seed.y.mul(1.7)).mul(0.14));
      const d = q.sub(centre);
      const r = max(length(d), 0.001);
      const dir = d.div(r);

      const warp = vec2(fbm(vec3(q.mul(1.3), seed.x), 3), fbm(vec3(q.mul(1.3).add(7), seed.y), 3));
      const qw = q.add(warp.mul(0.75));
      const mass = fbm(vec3(qw.mul(1.5), seed.z), 5).mul(1.8).add(0.45);

      // dust threads: one family fanning out from the centre, one drifting across
      const sx = vec3(dir.x.mul(5), dir.y.mul(5), r.mul(0.9)).add(seed);
      const fan = ridge(gnoise(sx).add(gnoise(sx.mul(2.1)).mul(0.5)), 2.4);
      const sy = vec3(qw.x.mul(10), qw.y.mul(1.3), seed.x.add(2));
      const drift = ridge(gnoise(sy).add(gnoise(sy.mul(2.3)).mul(0.5)), 2.4);
      const arcs = ridge(gnoise(vec3(qw.mul(1.7), seed.z)).add(gnoise(vec3(qw.mul(3.9), seed.y)).mul(0.4)), 2.7);
      const dens = clamp(mass.mul(0.8).add(fan.mul(0.5)).add(drift.mul(0.3)).sub(0.22), 0, 1.3).toVar();

      const env = float(0).toVar(); // where the gas is
      const core = float(0).toVar(); // a bright star or core at the centre
      const glow = float(0).toVar(); // extra heat: rims, cavities lit from inside
      const shape = u.nebShape;

      If(shape.lessThan(0.5), () => {
        // emission cloud: a ragged glowing mass round a core, with cavities blown clear
        const edge = fbm(vec3(q.mul(1.1), seed.y.add(3)), 4);
        env.assign(smoothstep(1.25, 0.3, r.add(edge.mul(0.6))));
        const hole = (cx: Node, cy: Node, rad: number) => smoothstep(rad, rad * 0.15, length(q.sub(vec2(cx, cy)).add(warp.mul(0.18))));
        const cav = max(
          hole(sin(seed.z.mul(2.1)).mul(0.55).add(0.35), sin(seed.x.mul(3.3)).mul(0.3), 0.42),
          hole(sin(seed.y.mul(1.3)).mul(0.5).sub(0.4), sin(seed.z.mul(2.7)).mul(0.35), 0.3),
        );
        dens.mulAssign(float(1).sub(cav.mul(0.88)));
        core.assign(exp(r.mul(r).mul(-16)));
        glow.assign(cav.mul(0.55).mul(env));
      }).ElseIf(shape.lessThan(1.5), () => {
        // planetary shell: a lumpy ring of gas round a small hot star, a fainter shell outside it
        const rr = length(d.add(warp.mul(0.24)));
        const r0 = sin(seed.x.mul(2.3)).mul(0.1).add(0.52);
        env.assign(clamp(exp(pow(rr.sub(r0).div(0.13), 2).negate()).add(exp(pow(rr.sub(r0.mul(1.55)).div(0.24), 2).negate()).mul(0.3)), 0, 1));
        dens.mulAssign(1.5);
        core.assign(exp(r.mul(r).mul(70)).reciprocal());
        glow.assign(smoothstep(r0, r0.mul(0.3), rr).mul(0.5));
      }).ElseIf(shape.lessThan(2.5), () => {
        // supernova bubble: a thin shell of arcs, hottest on its rim, hollow inside
        const rr = length(d.add(warp.mul(0.32)));
        const shell = exp(pow(rr.sub(0.78).div(0.17), 2).negate());
        env.assign(shell);
        dens.assign(clamp(mass.mul(0.35).add(arcs.mul(1.0)), 0, 1.3));
        glow.assign(shell.mul(0.5).add(smoothstep(0.7, 0, rr).mul(0.18)));
      }).ElseIf(shape.lessThan(3.5), () => {
        // bipolar: two lobes pinched at the waist, a thin disk across it
        const ang = seed.z;
        const a = d.x.mul(cos(ang)).add(d.y.mul(sin(ang))).add(warp.x.mul(0.1));
        const b = d.x.mul(sin(ang).negate()).add(d.y.mul(cos(ang))).add(warp.y.mul(0.1));
        const width = float(0.07).add(smoothstep(0, 0.55, abs(a)).mul(smoothstep(1.25, 0.6, abs(a))).mul(0.34));
        const lobe = smoothstep(width, width.mul(0.35), abs(b)).mul(smoothstep(1.3, 0.5, abs(a)));
        const disk = smoothstep(0.07, 0, abs(a)).mul(smoothstep(0.55, 0.1, abs(b))).mul(0.8);
        env.assign(max(lobe, disk));
        core.assign(exp(r.mul(r).mul(-40)));
        glow.assign(lobe.mul(0.25));
      }).ElseIf(shape.lessThan(4.5), () => {
        // pillars: dark columns rising into a glowing wall of gas, their rims lit
        const h = q.y.mul(0.5).add(0.5);
        const colVal = fbm(vec3(qw.x.mul(2.4), 0.3, seed.y), 3).mul(1.6).add(0.45).sub(h.mul(0.95)).sub(0.05);
        const pillar = smoothstep(0, 0.08, colVal);
        const rim = smoothstep(0, 0.05, colVal).mul(float(1).sub(smoothstep(0.05, 0.16, colVal)));
        const wall = smoothstep(-0.2, 1.1, h).mul(smoothstep(1.5, 0.4, abs(q.x)));
        env.assign(clamp(wall.mul(float(1).sub(pillar)).mul(0.9).add(rim.mul(0.8)), 0, 1));
        dens.assign(mix(dens, float(0.35), pillar));
        glow.assign(rim.mul(0.6));
      }).Else(() => {
        // veil: long thin sheets of shocked gas, no centre
        const edge = fbm(vec3(q.mul(1.1), seed.y.add(3)), 4);
        env.assign(smoothstep(1.45, 0.2, r.add(edge.mul(0.7))).mul(arcs.mul(1.3).add(0.12)));
        dens.assign(clamp(mass.mul(0.3).add(arcs.mul(0.9)), 0, 1.3));
        glow.assign(arcs.mul(0.2));
      });

      const heat = clamp(core.mul(1.3).add(dens.mul(0.4).mul(float(1.3).sub(r))).add(glow), 0, 1.6);
      const dust = mix(u.nebA, u.nebB, smoothstep(0.15, 0.6, heat));
      const tint = mix(dust, u.nebC, smoothstep(0.5, 1.05, heat));
      const body = dens.mul(env);
      let col = tint.mul(body.mul(heat.mul(1.3).add(0.55)));
      col = col.add(u.nebC.mul(core).mul(1.6)).add(vec3(1, 1, 1).mul(pow(core, 3)).mul(1.1));

      const star = pow(clamp(gnoise(vec3(q.mul(170), seed.x)).mul(1.7), 0, 1), 14).mul(2);
      col = col.add(mix(u.nebC, vec3(1, 1, 1), 0.5).mul(star).mul(float(1).sub(clamp(body, 0, 1).mul(0.6))));
      return vec4(col, 1);
    })(),
  );
