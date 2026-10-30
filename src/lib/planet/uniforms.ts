import { Matrix3, Vector2, Vector3 } from 'three';
import { uniform } from 'three/tsl';
import { tintWith, type Kind, type World } from './archetypes';
import { createSkyUniforms, createTerrainUniforms } from './tsl/bake';

const v3 = (x = 0, y = x, z = x) => uniform(new Vector3(x, y, z));
const v2 = () => uniform(new Vector2(-1, 0.0001));

/** Every value the shaders read. Built once per canvas; `applyWorld` rewrites it when a new world is rolled. */
export const createUniforms = () => ({
  clock: uniform(0), // seconds of animation; frozen under prefers-reduced-motion
  sunL: v3(), camL: v3(), rotP: uniform(new Matrix3()), rotC: uniform(new Matrix3()), holeToSky: uniform(new Matrix3()),
  fade: uniform(0), sunCol: v3(1), texW: uniform(4096), cloudW: uniform(2048),
  ramp: Array.from({ length: 5 }, () => v3()),
  liqDeep: v3(), liqShallow: v3(), iceCol: v3(1), glowCol: v3(), cloudTint: v3(1), atmoCol: v3(0.05, 0.13, 0.34),
  ringA: v3(), ringB: v3(),
  ringIn: uniform(1.3), ringOut: uniform(2), ringAmt: uniform(0.9), ringF1: uniform(30), ringF2: uniform(120),
  ringGaps: [v2(), v2(), v2()], hasRing: uniform(0),
  sea: uniform(0.1), hasLiq: uniform(0), strata: uniform(0), strataF: uniform(6), ice: uniform(0),
  glowAmt: uniform(0), glowDay: uniform(0), glowMode: uniform(0), cloudAmt: uniform(1), activity: uniform(0.7),
  br: v3(7.6, 17.8, 45), scatter: uniform(0.62),
  hole: { exposure: uniform(1.3), doppler: uniform(0.75), diskIn: uniform(0.2), diskOut: uniform(0.6), ring: uniform(1) },
  terrain: createTerrainUniforms(),
  sky: createSkyUniforms(),
});
export type Uniforms = ReturnType<typeof createUniforms>;

export interface WorldLook {
  kind: Kind;
  clouds: boolean;
  ring: boolean;
  /** footprint multiplier once the planet sits to one side (rings and coronas need the room) */
  sizeK: number;
  size: number; // this world's own size, a little either side of 1
  shiftX: number;
  tilt: [number, number];
}

const tintVec = (tint: ReturnType<typeof tintWith>, v: Vector3) => {
  // treat the vector as a colour direction, rotate it, keep its magnitude
  const m = Math.max(v.x, v.y, v.z);
  const hex = '#' + [v.x, v.y, v.z].map((c) => Math.round(Math.pow(c / m, 1 / 2.2) * 255).toString(16).padStart(2, '0')).join('');
  const c = tint(hex);
  const k = m / Math.max(c.x, c.y, c.z, 1e-4);
  return c.multiplyScalar(k);
};

export function applyWorld(u: Uniforms, w: World): WorldLook {
  const tint = tintWith(w);
  const tpl = w.tpl;

  u.sky.seed.value = w.terrainSeed;
  u.sky.a.value = tint(tpl.sky[0]).multiplyScalar(0.55);
  u.sky.b.value = tint(tpl.sky[1]).multiplyScalar(0.55);
  u.sky.c.value = tint(tpl.sky[2]).multiplyScalar(0.55);
  tpl.ramp.forEach((c, i) => (u.ramp[i].value = tint(c)));
  u.activity.value = w.activity;

  u.hasRing.value = w.ring ? 1 : 0;
  const look: WorldLook = { kind: w.kind, clouds: false, ring: false, sizeK: 1, size: w.size, shiftX: 0, tilt: w.tilt };

  if (w.kind === 'star') {
    u.sunCol.value = tint(tpl.ramp[3]).lerp(new Vector3(1, 1, 1), 0.4);
    look.sizeK = 0.62;
    look.shiftX = 0.1;
    return look;
  }
  if (w.kind === 'hole') {
    look.sizeK = 1.9;
    look.shiftX = -0.16; // pull it in so the disk is not cropped by the edge of the screen
    return look;
  }

  const a = w.arch!;
  const t = a.terrain;
  u.terrain.seed.value = w.terrainSeed;
  u.terrain.cfreq.value = t.cfreq;
  u.terrain.amp.value = t.amp;
  u.terrain.ridge.value = t.ridge;
  u.terrain.warp.value = t.warp;
  u.terrain.terrace.value = t.terrace;
  u.terrain.dry.value = t.dry ? 1 : 0;

  u.hasLiq.value = a.liquid ? 1 : 0;
  u.sea.value = a.liquid?.level ?? -9;
  u.liqDeep.value = tint(a.liquid?.deep ?? '#000000');
  u.liqShallow.value = tint(a.liquid?.shallow ?? '#000000');
  u.strata.value = a.strata;
  u.strataF.value = a.strataF;
  u.ice.value = a.ice?.amount ?? 0;
  u.iceCol.value = tint(a.ice?.color ?? '#ffffff');
  u.cloudAmt.value = a.cloud.amt;
  u.cloudTint.value = tint(a.cloud.tint);
  u.glowAmt.value = a.glow?.amt ?? 0;
  u.glowMode.value = a.glow?.mode ?? 0;
  u.glowDay.value = a.glow?.day ?? 0;
  u.glowCol.value = tint(a.glow?.color ?? '#000000');
  u.sunCol.value = tint(a.sun);

  const br = tintVec(tint, new Vector3(...a.atmo.br));
  u.br.value = br;
  u.scatter.value = a.atmo.scatter;
  u.atmoCol.value = br.clone().multiplyScalar(0.6 / br.length());

  look.clouds = a.cloud.amt > 0.01;
  if (w.ring) {
    const r = w.ring;
    look.ring = true;
    u.ringIn.value = r.inner;
    u.ringOut.value = r.outer;
    u.ringAmt.value = r.amount;
    u.ringF1.value = r.f1;
    u.ringF2.value = r.f2;
    u.ringA.value = tint(r.a);
    u.ringB.value = tint(r.b);
    u.ringGaps.forEach((g, i) => g.value.set(r.gaps[i]?.[0] ?? -1, r.gaps[i]?.[1] ?? 0.0001));
    look.sizeK = Math.min(1, Math.max(0.52, 1.6 / r.outer));
    look.shiftX = 0.12;
  }
  return look;
}
