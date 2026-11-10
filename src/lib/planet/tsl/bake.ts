import {
  Fn, float, mix, normalize, floor, fract, abs, clamp, select, smoothstep, cos, uniform, uv, vec2, vec3, vec4,
  positionGeometry, dot, If, max, texture, length, sin, exp, pow, atan,
} from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import type { Node, Texture } from 'three/webgpu';
import { Vector3 } from 'three';
import { dirFromUv, fbm, gnoise, mute, rampColor, ridged, sq, worley } from './common';
import type { Uniforms } from '../uniforms';

/** Every bake material draws one horizontal strip of an equirect texture, so a bake can be spread over frames. */
export const strip = { index: uniform(0), count: uniform(1) };

const stripVertex = vec4(
  positionGeometry.x,
  positionGeometry.y.div(strip.count).add(strip.index.mul(2).add(1).div(strip.count).sub(1)),
  0,
  1,
);
export const stripUv = () => vec2(uv().x, strip.index.add(uv().y).div(strip.count));

export const bakeMaterial = (fragment: Node) => {
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
  crater: ReturnType<typeof uniform>; // how heavily impacts have marked the ground, 0 to 1
  bands: ReturnType<typeof uniform>; // gas giants: band count pole to pole, 0 for rocky worlds
  swirl: ReturnType<typeof uniform>; // gas giants: how far turbulence bends the bands
}

export const createTerrainUniforms = (): TerrainUniforms => ({
  seed: uniform(new Vector3()),
  cfreq: uniform(1.15), amp: uniform(0.2), ridge: uniform(0.16),
  warp: uniform(0), terrace: uniform(0), dry: uniform(0), crater: uniform(0), bands: uniform(0), swirl: uniform(0.05),
});

/**
 * Pass 1: terrain height into a float32 target (one evaluation per texel). `detail` adds octaves on the larger textures,
 * which can hold them; on a small one they would only alias.
 */
export const createTerrainHeightBake = (t: TerrainUniforms, detail: number) => {
  const height = Fn(([p]: [Node]) => {
    const q = p.toVar();
    q.addAssign(
      vec3(
        fbm(p.mul(2).add(t.seed).add(vec3(4, 4, 4)), 3),
        fbm(p.mul(2).add(t.seed).add(vec3(9, 9, 9)), 3),
        fbm(p.mul(2).add(t.seed).add(vec3(15, 15, 15)), 3),
      ).mul(t.warp.mul(0.35)),
    );
    const dry = t.dry.greaterThan(0.5);
    const c = fbm(q.mul(t.cfreq).add(t.seed), 5 + detail).mul(1.9);
    const land = select(dry, float(1), smoothstep(0.02, 0.22, c));
    const m = fbm(q.mul(4).add(t.seed.mul(1.7)), 6 + detail);
    // mountain chains: branching ridges, bent by a little warp of their own so they never run straight
    const bend = vec3(gnoise(q.mul(3).add(t.seed)), gnoise(q.mul(3).add(t.seed).add(vec3(5, 2, 8))), gnoise(q.mul(3).add(t.seed).add(vec3(1, 9, 4))));
    const chain = ridged(q.mul(3.1).add(bend.mul(0.35)).add(t.seed.mul(2.3)), 4 + detail).mul(1.4);
    const relief = fbm(q.mul(2.5).add(t.seed), 3).mul(0.9).add(0.55);
    const mount = select(dry, relief, smoothstep(0.14, 0.45, c).mul(relief));
    const h = c.add(land.mul(m.mul(t.amp).add(chain.mul(t.ridge).mul(mount)))).toVar();
    // mesas: the ground only leans toward its steps, a full staircase reads as the contour lines of a map
    If(t.terrace.greaterThan(0.5), () => {
      const s = h.mul(t.terrace);
      h.assign(mix(h, floor(s).add(smoothstep(0.2, 0.8, fract(s))).div(t.terrace), 0.4));
    });
    // impact craters on airless ground: a bowl and a raised rim round every point of a jittered grid, at several sizes,
    // in patches so that old plains and fresh fields sit side by side
    If(t.crater.greaterThan(0.01), () => {
      let dent: Node = float(0);
      const sizes = [[3.5, 1], [8, 0.5], [19, 0.24], [44, 0.11]].slice(0, 2 + detail);
      for (const [f, a] of sizes) {
        const pp = q.mul(f).add(t.seed.mul(1.3 + f * 0.1));
        const r = worley(pp).div(0.38);
        const bowl = sq(r.min(1)).sub(1).mul(0.6);
        const rim = exp(sq(r.sub(1).div(0.18)).negate()).mul(0.3);
        const here = smoothstep(0, 0.25, gnoise(pp.mul(0.37)).add(0.1));
        dent = dent.add(bowl.add(rim).mul(here).mul(a));
      }
      h.addAssign(dent.mul(0.09).mul(t.crater));
    });
    // gas giants: no ground at all, just zonal bands along the latitude, bent by turbulence and sheared against each other
    If(t.bands.greaterThan(0.5), () => {
      const turb = fbm(vec3(p.x.mul(2.5), p.y.mul(16), p.z.mul(2.5)).add(t.seed), 4);
      const ly = p.y.add(turb.mul(t.swirl)).mul(t.bands).toVar();
      const zone = gnoise(vec3(ly, t.seed.x, t.seed.y)).mul(0.5)
        .add(gnoise(vec3(ly.mul(2.7), t.seed.z, 3)).mul(0.25))
        .add(gnoise(vec3(ly.mul(6.3), 5, t.seed.z)).mul(0.1));
      // streaks drawn out along the wind, coarse then fine
      const eddy = fbm(vec3(p.x.mul(7), ly.mul(1.6), p.z.mul(7)).add(t.seed.mul(1.3)), 5).mul(0.12)
        .add(fbm(vec3(p.x.mul(22), ly.mul(5), p.z.mul(22)).add(t.seed), 2 + detail).mul(0.05));
      // a few long-lived storms: ovals stretched along the bands, ringed like a vortex seen from above
      const sp = vec3(p.x.mul(2.2), p.y.mul(5.5), p.z.mul(2.2)).add(t.seed.mul(0.9));
      const sd = worley(sp);
      const few = smoothstep(0.02, 0.2, gnoise(sp.mul(0.6).add(vec3(7, 7, 7))));
      const storm = smoothstep(0.34, 0.1, sd).mul(few).mul(smoothstep(0.85, 0.6, abs(p.y)));
      h.assign(smoothstep(0.12, 0.88, zone.add(0.5).add(eddy).add(storm.mul(sin(sd.mul(38)).mul(0.12).add(0.26)))));
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
    ).toVar();
    // a second, finer warp on top of the first curls the fronts into hooks and eddies, as weather systems do
    const q2 = q.add(w.mul(1.4)).toVar();
    const w2 = vec3(
      fbm(q2.mul(2.6).add(vec3(3.1, 3.1, 3.1)), 3),
      fbm(q2.mul(2.6).add(vec3(8.4, 2.2, 5.1)), 3),
      fbm(q2.mul(2.6).add(vec3(1.9, 6.6, 9.3)), 3),
    );
    const f = fbm(q2.add(w2.mul(0.55)), 8).mul(2);
    // storm tracks in the mid latitudes, a calmer belt on the equator
    const bands = cos(p.y.mul(11).add(w.x.mul(3))).mul(0.1).add(smoothstep(0.25, 0, abs(p.y)).mul(0.06));
    return smoothstep(0.03, 0.45, f.add(bands));
  });
  return bakeMaterial(Fn(() => vec4(density(dirFromUv(stripUv())), 0, 0, 1))());
};

/**
 * Pass 2: reads the float height/density back at the neighbouring texels and writes
 * r = value, g/b = slope along east/north per radian of arc, a = `aux(direction, value)`.
 */
export const createSlopePass = (source: Texture, width: number, height: number, aux: (p: Node, value: Node) => Node) =>
  bakeMaterial(
    Fn(() => {
      const uvn = stripUv();
      const at = (dx: number, dy: number) =>
        texture(source, vec2(uvn.x.add(dx / width), clamp(uvn.y.add(dy / height), 0, 1))).level(0).x;
      const cosLat = max(cos(uvn.y.sub(0.5).mul(Math.PI)), 0.05);
      const gx = at(1, 0).sub(at(-1, 0)).div(cosLat.mul((4 * Math.PI) / width));
      const gy = at(0, 1).sub(at(0, -1)).div((2 * Math.PI) / height);
      const value = at(0, 0).toVar();
      return vec4(value, clamp(gx, -9, 9), clamp(gy, -9, 9), aux(dirFromUv(uvn), value));
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

/** How far above the lowest ground a height sits, 0 at the shore (or the deepest basin of a dry world) to about 1 on the peaks. */
const altitude = (u: Uniforms, h: Node) => h.sub(select(u.hasLiq.greaterThan(0.5), u.sea, float(-0.4))).div(0.95);

/**
 * What the ground gives off by itself, 0 to about 1: city lights (mode 0) or lava (mode 1). Baked beside the height, so
 * the surface shader only has to colour it.
 */
export const terrainGlow = (u: Uniforms) => (d: Node, h: Node) => {
  const sd = u.terrain.seed;
  const t = altitude(u, h);
  const em = float(0).toVar();
  If(u.glowAmt.greaterThan(0.001), () => {
    If(u.glowMode.lessThan(0.5), () => {
      // settlements gather on low ground and along the coasts, in clusters joined by thin threads of road
      const dens = smoothstep(0.42, 0.78, fbm(d.mul(8).add(sd).add(vec3(7, 7, 7)), 4).mul(1.6).add(0.35));
      const low = smoothstep(0.9, 0.2, t).mul(smoothstep(0.25, 0.02, t).mul(0.8).add(0.6));
      const spots = gnoise(d.mul(120).add(sd)).mul(0.5).add(0.5);
      const fine = gnoise(d.mul(260).add(sd)).mul(0.5).add(0.5);
      const pts = smoothstep(0.58, 0.88, spots.mul(0.65).add(fine.mul(0.55)));
      const roads = smoothstep(0.03, 0, abs(gnoise(d.mul(26).add(sd)))).mul(0.3);
      em.assign(dens.mul(low).mul(pts.mul(0.9).add(smoothstep(0.35, 0.8, spots).mul(0.18)).add(roads)));
    }).Else(() => {
      // lava: a branching net of cracks, wide ones feeding thin ones, alive only in some regions, and pooling into
      // crusted lakes on the lowest ground
      const w = vec3(gnoise(d.mul(2.5).add(sd)), gnoise(d.mul(2.5).add(sd).add(vec3(3, 3, 3))), gnoise(d.mul(2.5).add(sd).add(vec3(6, 6, 6))));
      const n1 = abs(gnoise(d.mul(5).add(w.mul(1.2)).add(sd)));
      const n2 = abs(gnoise(d.mul(13).add(w.mul(0.8)).add(sd)));
      const n3 = abs(gnoise(d.mul(31).add(w.mul(0.5)).add(sd)));
      const cracks = max(smoothstep(0.02, 0, n1), max(smoothstep(0.016, 0, n2).mul(0.7), smoothstep(0.014, 0, n3).mul(0.45)));
      const halo = smoothstep(0.13, 0, n1).mul(0.1);
      const active = smoothstep(-0.05, 0.22, fbm(d.mul(1.8).add(sd.mul(0.5)), 3));
      const lake = smoothstep(0.1, 0.02, t).mul(fbm(d.mul(24).add(sd), 3).mul(1.6).add(0.55).clamp(0.1, 1));
      em.assign(cracks.add(halo).mul(active).mul(smoothstep(0.75, 0.05, t).mul(1.1).add(0.15)).add(lake.mul(0.9)));
    });
  });
  return em;
};

/**
 * Pass 3: the colour of the ground, painted once. Everything that used to be noise evaluated for every pixel of every
 * frame (the detail of the palette, the staining, the ice) lives here instead, which also leaves room to do more of it.
 * rgb = albedo, square-rooted so 8 bits hold the dark tones; a = ice cover.
 */
export const createAlbedoBake = (u: Uniforms, source: Texture, detail: number) => {
  const moisture = terrainMoisture(u.terrain);
  return bakeMaterial(
    Fn(() => {
      const uvn = stripUv();
      const d = dirFromUv(uvn);
      const pd = texture(source, uvn).level(0);
      const h = pd.x;
      const sd = u.terrain.seed;
      const moist = moisture(d).toVar();
      const detA = fbm(d.mul(14).add(sd), 5).toVar();
      const detB = fbm(d.mul(52).add(sd), 3 + detail).toVar();

      const t = altitude(u, h).add(moist.sub(0.5).mul(0.3)).add(detA.mul(0.2)).add(detB.mul(0.06)).toVar();
      t.assign(mix(t, h.add(detA.mul(0.05)).add(detB.mul(0.02)), u.gas)); // bands read straight off the ramp
      // layered rock shows as faint banding, never as lines
      t.addAssign(u.strata.mul(0.07).mul(sin(h.mul(u.strataF).add(detA.mul(0.8)).mul(6.2832))).mul(float(1).sub(u.gas)));

      // gas giants: the second set of bands stains the first with the scheme's other two hues
      const stain = mix(mix(vec3(1, 1, 1), u.gasA, smoothstep(0.38, 0.52, moist)), u.gasB, smoothstep(0.62, 0.78, moist));
      const gasCol = mute(rampColor(u.ramp, t).mul(mix(vec3(1, 1, 1), stain, 0.9)), 0.8).mul(detB.mul(0.5).add(1));

      // rocky ground: wetter lowlands take a second hue (growth, or mineral staining on a dry world), steep faces show
      // darker bare rock, and nothing is ever one flat colour
      const wet = smoothstep(0.5, 0.72, moist).mul(smoothstep(0.6, 0.15, t));
      const rock = mix(rampColor(u.ramp, t), rampColor(u.ramp, t).mul(u.gasB).mul(0.75), wet.mul(0.45))
        .mul(float(1).sub(smoothstep(1.5, 6, length(pd.yz)).mul(0.38)))
        .mul(detB.mul(1.3).add(0.5).add(detA.mul(0.4)).mul(0.45).add(0.8).add(gnoise(d.mul(160).add(sd)).mul(0.1)));
      const ground = mix(mute(rock, 0.78), gasCol, u.gas);

      // ice: the caps reach further down where it is wet or high, with a ragged edge
      const iceStart = mix(1.08, 0.6, u.ice);
      const cold = abs(d.y).add(moist.sub(0.5).mul(0.09)).add(fbm(d.mul(12).add(sd), 3).mul(0.06)).add(max(t.sub(0.55), 0).mul(0.2));
      const iceM = smoothstep(iceStart, iceStart.add(0.07), cold).mul(smoothstep(0, 0.02, u.ice));
      const iceCol = u.iceCol.mul(gnoise(d.mul(9).add(vec3(3, 3, 3))).mul(0.5).add(0.5).mul(0.22).add(0.78)).mul(detB.mul(0.35).add(1));
      return vec4(clamp(mix(ground, iceCol, iceM), 0, 1).sqrt(), iceM);
    })(),
  );
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
      }).ElseIf(shape.greaterThan(5.5), () => {
        // spiral galaxy seen at an angle: a warm bulge, two arms winding out of it, dust lanes on their inner edge and
        // knots of young stars along them
        const ang = seed.z;
        const gx = d.x.mul(cos(ang)).add(d.y.mul(sin(ang)));
        const gy = d.x.mul(sin(ang).negate()).add(d.y.mul(cos(ang))).div(sin(seed.x.mul(1.9)).mul(0.18).add(0.5)); // the disk's tilt
        const rr = max(length(vec2(gx, gy)), 0.001).toVar();
        const wind = atan(gy, gx).sub(rr.add(0.06).log().mul(sin(seed.y).mul(0.6).add(3.1))).add(warp.x.mul(0.5)).toVar();
        const arm = pow(cos(wind.mul(2)).mul(0.5).add(0.5), 2);
        const lane = pow(cos(wind.mul(2).add(1.0)).mul(0.5).add(0.5), 6);
        const disk = exp(rr.mul(-3.4)).mul(smoothstep(1.25, 0.8, rr));
        const knots = pow(clamp(gnoise(vec3(q.mul(26), seed.x)).mul(1.7), 0, 1), 3).mul(arm);
        env.assign(clamp(disk.mul(arm.mul(2.4).add(0.35)).mul(float(1).sub(lane.mul(0.55).mul(smoothstep(0.08, 0.3, rr)))), 0, 1));
        dens.assign(clamp(mass.mul(0.45).add(0.75).add(knots.mul(1.5)), 0, 1.6));
        core.assign(exp(rr.mul(rr).mul(-38)).add(exp(rr.mul(-9)).mul(0.35)));
        glow.assign(knots.mul(disk).mul(1.2).add(arm.mul(disk).mul(0.25)));
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
