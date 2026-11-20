import {
  Fn, abs, clamp, cos, dot, exp, float, hash, instanceIndex, sin, length, max, mix, normalize, normalView, positionGeometry, positionLocal, positionViewDirection, pow,
  select, smoothstep, texture, uv, vec3, vec4,
} from 'three/tsl';
import { CustomBlending, DoubleSide, NodeMaterial, OneFactor, OneMinusSrcColorFactor, SpriteNodeMaterial } from 'three/webgpu';
import type { Node, Texture } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { fbm, gnoise, mute, SUN_DIR, tonemap, worley } from './common';

export const BEAM_LENGTH = 4.6;

const additive = (m: NodeMaterial) => {
  m.transparent = true;
  m.depthWrite = false;
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcColorFactor;
  return m;
};

/**
 * Belt rocks, drawn as instances. Each is lit on its own faces (the view-space normal follows the instance, which the local
 * position does not: lit by that, a whole belt shaded like one big sphere and every rock came out a flat disc).
 */
export const createRockMaterial = (u: Uniforms, seed: number) => {
  const m = new NodeMaterial();
  m.fragmentNode = Fn(() => {
    const N = normalize(normalView);
    const L = normalize(vec3(...SUN_DIR));
    const own = float(instanceIndex).mul(0.37).add(seed); // every rock its own patch of noise, and its own shade of the palette
    const c = fbm(positionGeometry.mul(2.2).add(vec3(own, own.mul(0.7), 3)), 3).add(0.5);
    const tone = fbm(vec3(own, 1, 2), 1).add(0.5);
    const albedo = mute(mix(u.ramp[1], u.ramp[3], clamp(tone, 0, 1)), 0.55).mul(c.mul(0.7).add(0.45)).mul(0.7);
    const col = albedo.mul(u.sunCol).mul(2.2).mul(max(dot(N, L), 0)).add(albedo.mul(0.012));
    return vec4(tonemap(col.mul(u.fade)), 1);
  })();
  return m;
};

/**
 * A moon with a look of its own: `tint` is its colour, `style` its surface (0 cratered rock, 1 smooth cracked ice,
 * 2 dark and mottled) and `seed` its noise. All three are uniforms so one material per moon slot can be re-dressed.
 */
export const createMoonMaterial = (u: Uniforms, tint: Node, style: Node, seed: Node) => {
  const m = new NodeMaterial();
  m.fragmentNode = Fn(() => {
    const N = normalize(positionLocal);
    const L = normalize(u.sunL);
    const sd = vec3(seed, seed.mul(0.7), 3);
    const c = fbm(N.mul(4).add(sd), 4).add(0.5);
    // impact craters at two sizes: a dark bowl inside a bright rim
    const c1 = worley(N.mul(5).add(sd));
    const c2 = worley(N.mul(12).add(sd));
    const pits = smoothstep(0.3, 0.08, c1).add(smoothstep(0.3, 0.08, c2).mul(0.6))
      .sub(smoothstep(0.07, 0, abs(c1.sub(0.36))).mul(0.5)).sub(smoothstep(0.07, 0, abs(c2.sub(0.36))).mul(0.3));
    const cracks = smoothstep(0.07, 0, abs(gnoise(N.mul(7).add(sd))));
    const blot = smoothstep(0.35, 0.65, c);
    const rock = float(1).sub(pits.mul(0.4)).add(c.sub(0.5).mul(0.5));
    const ice = float(1).sub(cracks.mul(0.4)).add(c.sub(0.5).mul(0.15));
    const dark = blot.mul(0.9).add(0.35);
    const shade = select(style.lessThan(0.5), rock, select(style.lessThan(1.5), ice, dark));
    const albedo = tint.mul(shade);
    const col = albedo.mul(u.sunCol).mul(2.2).mul(max(dot(N, L), 0)).add(albedo.mul(0.012));
    return vec4(tonemap(col.mul(u.fade)), 1);
  })();
  return m;
};

/**
 * One lighthouse beam: a thin cone seen as a shaft of light, hottest down its centre line (the view angle against the
 * surface normal gives the soft profile) and fading toward the far end.
 */
export const createBeamMaterial = (u: Uniforms, ramp: Node[] = u.ramp, gain: Node = float(1)) => {
  const m = additive(new NodeMaterial());
  m.depthTest = true; // the half of a beam behind the star must be hidden by it
  m.side = DoubleSide;
  m.fragmentNode = Fn(() => {
    const mu = abs(dot(normalize(normalView), positionViewDirection));
    const along = clamp(length(positionLocal).div(BEAM_LENGTH), 0, 1);
    const shaft = pow(mu, 1.1).mul(0.5).add(pow(mu, 5).mul(0.9)); // gentle profile, so the beam keeps its brightness as it turns
    const intensity = shaft.mul(pow(float(1).sub(along), 1.25)).mul(smoothstep(0, 0.03, along.add(0.015)));
    const col = mix(ramp[4], ramp[3], along.mul(1.4)).mul(intensity).mul(gain).mul(2.6);
    return vec4(float(1).sub(exp(col.mul(u.fade).negate())), 1);
  })();
  return m;
};

/** The baked nebula picture, screen-blended over the sky. */
export const createNebulaMaterial = (u: Uniforms, picture: Texture) => {
  const m = additive(new NodeMaterial());
  m.depthTest = false;
  m.fragmentNode = Fn(() => {
    const col = texture(picture, uv()).level(0).rgb;
    return vec4(float(1).sub(exp(col.mul(u.fade).mul(1.4).negate())), 1);
  })();
  return m;
};

/**
 * A spiral galaxy as a swarm of star sprites, one instance each, after Bruno Simon's TSL galaxy (three.js journey).
 * Everything about a star comes from a hash of its index, so there is no buffer to fill or rebuild: the world only
 * sets the number of arms, how tightly they wind and the three colours. The disk lies in the xz plane.
 *
 * Every star runs its own orbit, the inner ones lapping the outer ones. An arm is a traffic jam on the way: a star
 * slows as it reaches one, crowds there with the others, then speeds up again on the far side. So the arms stay
 * put while the stars stream through them (a density wave), instead of the whole picture turning as one.
 */
export const createGalaxyMaterial = (u: Uniforms) => {
  const m = additive(new SpriteNodeMaterial()) as SpriteNodeMaterial;
  m.depthTest = false;
  const rnd = (salt: number) => hash(instanceIndex.add(salt * 104729));
  const t = rnd(1); // 0 at the centre, 1 at the rim
  const radius = pow(t, 1.5).mul(1.3); // crowded toward the middle
  const free = rnd(2).mul(2 * Math.PI).add(u.clock.mul(0.1).div(radius.add(0.18))); // a flat rotation curve: same speed, shorter lap
  const jam = smoothstep(0.03, 0.25, t).mul(0.88); // no arms in the bulge; below 1 so a star never runs backward
  const wave = (a: Node) => a.sub(radius.mul(u.galTwist)).mul(u.galArms); // where an angle sits between two arms
  const angle = free.sub(sin(wave(free)).mul(jam).div(u.galArms));
  const crest = cos(wave(angle)).mul(0.5).add(0.5); // 1 on an arm
  const cube = (x: Node) => x.mul(x).mul(x); // keeps the sign, and most stars close to their arm
  const haze = rnd(7).lessThan(0.03); // a few wide, faint sprites: the unresolved light between the stars
  const spread = radius.mul(0.3).add(0.1).mul(float(1.7).div(u.galArms)); // tighter with more arms, or they merge
  const off = vec3(cube(rnd(3).mul(2).sub(1)), cube(rnd(4).mul(2).sub(1)).mul(mix(0.9, 0.22, smoothstep(0, 0.45, t))), cube(rnd(5).mul(2).sub(1))).mul(spread);
  m.positionNode = u.rotP.mul(vec3(cos(angle).mul(radius), 0, sin(angle).mul(radius)).add(off));
  m.scaleNode = select(haze, float(0.5), pow(rnd(6), 4).mul(0.05).add(0.012));
  m.colorNode = Fn(() => {
    const core = mix(u.nebC, vec3(1, 0.95, 0.85), 0.5);
    // young bright stars sit on the arms; between them only the older, dimmer ones are left
    const tint = mix(core, mix(u.nebA, u.nebB, crest.mul(rnd(8).mul(0.5).add(0.5))), smoothstep(0.04, 0.55, t)).mul(mix(1, crest.mul(0.75).add(0.25), jam));
    const d = length(uv().sub(0.5));
    // dimmer toward the middle, where thousands of sprites pile up and would burn to a flat white disc
    const point = clamp(float(0.035).div(d).sub(0.07), 0, 3).mul(mix(0.12, 1, smoothstep(0, 0.35, t)));
    const cloud = smoothstep(0.5, 0, d).mul(0.05);
    return vec4(float(1).sub(exp(tint.mul(select(haze, cloud, point)).mul(u.fade).negate())), 1);
  })();
  return m;
};
