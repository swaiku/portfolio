import { Color, Matrix3, Vector2, Vector3 } from 'three';
import { uniform } from 'three/tsl';
import { paint, pulsarSpin, Role, type Kind, type Moon, type World } from './archetypes';
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
  ringGaps: [v2(), v2(), v2()], hasRing: uniform(0), gas: uniform(0), gasA: v3(), gasB: v3(), nebA: v3(), nebB: v3(), nebC: v3(), nebShape: uniform(0),
  // binary stars: where each star is, and the radius each one hides things with (0 when there is no companion)
  primaryAt: v3(), companionAt: v3(), primaryR: uniform(0), companionR: uniform(0), primaryScale: uniform(1),
  // a star's slow variation in brightness: amplitude, and rate in rad/s
  twinkle: uniform(0), twinkleRate: uniform(0.4),
  // solar storm: envelope of the current flare (0 when quiet), how far through it we are, its size, and where on the limb it rises
  flare: uniform(0), flareProg: uniform(0), flareAmt: uniform(0), flareSize: uniform(1), flareRate: uniform(0), flareDir: v3(0, 1, 0),
  sea: uniform(0.1), hasLiq: uniform(0), strata: uniform(0), strataF: uniform(6), ice: uniform(0),
  glowAmt: uniform(0), glowDay: uniform(0), glowMode: uniform(0), cloudAmt: uniform(1), activity: uniform(0.7), spots: uniform(0.1), storms: uniform(0), pulsar: uniform(0), beamTilt: uniform(0.8),
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
  moons: (Moon & { color: Vector3 })[];
  belt: World['belt'];
  binary: boolean;
  jets: boolean;
  beamTilt: number;
  spin: number; // rad/s on screen
  period: number; // seconds, real
  companion: LookCompanion | null;
  body: number; // radius of the star's body, in the group's units; a pulsar is a tiny dense point
}

export interface LookCompanion {
  radius: number;
  r1: number; // distance of the primary from the barycentre
  r2: number; // distance of the companion from it
  omega: number; // orbital rate, rad/s
  phase: number;
  incline: number;
  ramp: Vector3[];
  pulsar: boolean;
  tilt: number;
  spin: number;
}

const hexVec = (hex: string) => { const c = new Color(hex); return new Vector3(c.r, c.g, c.b); };

export function applyWorld(u: Uniforms, w: World): WorldLook {
  const color = paint(w);
  const tpl = w.tpl;

  u.sky.seed.value = w.terrainSeed;
  u.sky.a.value = color(Role.liquid, tpl.sky[0]).multiplyScalar(0.55);
  u.sky.b.value = color(Role.air, tpl.sky[1]).multiplyScalar(0.55);
  u.sky.c.value = color(Role.ground, tpl.sky[2]).multiplyScalar(0.55);
  tpl.ramp.forEach((c, i) => (u.ramp[i].value = color(Role.ground, c, i - 2)));
  u.activity.value = w.activity;
  u.spots.value = w.spots;
  u.storms.value = w.storms;
  u.pulsar.value = w.type.jets ? 1 : 0;
  u.beamTilt.value = w.beamTilt;
  // a furious star throws huge loops, a dormant one only the odd small one; a pulsar's surface stays calm
  u.flareAmt.value = w.type.jets ? 0 : 0.35 + 0.65 * w.tempest;
  u.flareRate.value = w.type.jets ? 0 : w.tempest;
  u.flare.value = 0;

  u.hasRing.value = w.ring ? 1 : 0;
  const look: WorldLook = { kind: w.kind, clouds: false, ring: false, sizeK: 1, size: w.size, shiftX: 0, tilt: w.tilt, moons: w.moons.map((m) => ({ ...m, color: color(m.role, m.tone) })), belt: w.belt, binary: !!w.type.binary, jets: !!w.type.jets, beamTilt: w.beamTilt, spin: pulsarSpin(w.period), period: w.period, companion: null, body: 1 };

  if (w.kind === 'star') {
    u.sunCol.value = color(Role.ground, tpl.ramp[3], 1).lerp(new Vector3(1, 1, 1), 0.4);
    // a neutron star is about 12 km across against a star's hundreds of thousands: shown as a small hot point, with the beams
    // (which are what make it visible) taking the room, and a size that varies only a little because neutron stars barely do
    const body = w.type.jets ? 0.13 + ((w.size - 0.84) / 0.3) * 0.06 : 1;
    look.body = body;
    // ordinary stars vary a few percent over some seconds, like real variable stars; a pulsar's variation is its beams sweeping past
    u.twinkle.value = w.type.jets ? 0 : 0.03 + ((w.activity - 0.4) / 0.6) * 0.05;
    u.twinkleRate.value = 0.2 + (1 - (w.activity - 0.4) / 0.6) * 0.4;
    u.primaryScale.value = body;
    look.sizeK = w.type.jets ? 0.7 : 0.62;
    look.shiftX = 0.1;
    u.primaryAt.value.set(0, 0, 0);
    u.companionAt.value.set(0, 0, 0);
    u.primaryR.value = 0;
    u.companionR.value = 0;
    const c = w.companion;
    if (c) {
      // both stars circle their common centre of mass: the heavier one sits closer to it and moves less
      const radius = w.type.jets ? body * (0.9 + 0.1 * c.q) : Math.max(0.4, Math.pow(c.q, 0.7));
      const d = w.type.jets ? c.d * 0.45 : c.d; // neutron stars are tiny, so their orbit is tight
      const r1 = (d * c.q) / (1 + c.q);
      const r2 = d / (1 + c.q);
      look.companion = {
        radius, r1, r2, phase: c.phase, incline: c.incline, tilt: c.tilt,
        omega: 0.16 * Math.sqrt((1 + c.q) / 2) * Math.pow(3.1 / d, 1.5), // Kepler: a heavier pair circles faster, a wider one slower
        ramp: c.tpl.ramp.map((tone, i) => color(c.role, tone, i - 2)),
        pulsar: !!w.type.jets,
        spin: pulsarSpin(c.period),
      };
      u.primaryR.value = body;
      u.companionR.value = radius;
      // both stars and the best part of their coronas must stay on screen: the pair is pulled toward the middle, where there
      // is room on both sides, and scaled to the room that leaves
      look.sizeK = Math.min(look.sizeK, 0.68 / Math.max(r1 + 1.15 * body, r2 + 1.15 * radius));
      look.shiftX = -0.2;
    }
    return look;
  }
  if (w.kind === 'nebula') {
    // outer dust, middle and hot core each take a different hue of the scheme, like the red, green and blue of a real survey
    u.nebA.value = color(Role.ground, [0.85, 0.3]);
    u.nebB.value = color(Role.air, [0.55, 0.42]);
    u.nebC.value = color(Role.liquid, [0.6, 0.8]);
    u.nebShape.value = w.nebula;
    look.sizeK = 1;
    return look;
  }
  if (w.kind === 'comet') {
    u.sunCol.value = color(Role.ground, [0.2, 0.9]);
    look.sizeK = 0.5;
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
  u.terrain.bands.value = a.gas?.bands ?? 0;
  u.terrain.swirl.value = a.gas?.swirl ?? 0;
  u.gas.value = a.gas ? 1 : 0;
  // gas giants stain their bands with the other two hues of the scheme, at full strength so the stripes stay distinct
  const stain = (role: number) => { const c = color(role, [0.95, 0.5]); return c.divideScalar(Math.max(c.x, c.y, c.z, 1e-4)); };
  u.gasA.value = stain(Role.liquid);
  u.gasB.value = stain(Role.air);

  u.hasLiq.value = a.liquid ? 1 : 0;
  u.sea.value = a.liquid?.level ?? -9;
  u.liqDeep.value = a.liquid ? color(Role.liquid, a.liquid.deep) : new Vector3();
  u.liqShallow.value = a.liquid ? color(Role.liquid, a.liquid.shallow, 1) : new Vector3();
  u.strata.value = a.strata;
  u.strataF.value = a.strataF;
  u.ice.value = a.ice?.amount ?? 0;
  u.iceCol.value = color(Role.ground, a.ice?.color ?? [0, 1]);
  u.cloudAmt.value = a.cloud.amt;
  u.cloudTint.value = color(Role.air, a.cloud.tint);
  u.glowAmt.value = a.glow?.amt ?? 0;
  u.glowMode.value = a.glow?.mode ?? 0;
  u.glowDay.value = a.glow?.day ?? 0;
  u.glowCol.value = a.glow ? color(Role.air, a.glow.color) : new Vector3();
  u.sunCol.value = color(Role.ground, a.sun);

  const air = color(Role.liquid, a.atmo.tone);
  const br = air.multiplyScalar(a.atmo.power / Math.max(air.x, air.y, air.z, 1e-4));
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
    u.ringA.value = hexVec(r.a);
    u.ringB.value = hexVec(r.b);
    u.ringGaps.forEach((g, i) => g.value.set(r.gaps[i]?.[0] ?? -1, r.gaps[i]?.[1] ?? 0.0001));
    look.sizeK = Math.min(1, Math.max(0.52, 1.6 / r.outer));
    look.shiftX = 0.12;
  }
  // moons and belts orbit outside the planet and need the same room as rings
  const reach = Math.max(w.belt?.outer ?? 0, ...w.moons.map((m) => m.orbit + m.size));
  if (reach > 0) {
    look.sizeK = Math.min(look.sizeK, Math.min(1, Math.max(0.52, 1.6 / reach)));
    look.shiftX = 0.12;
  }
  return look;
}
