import { Fn, If, abs, atan, clamp, cross, dot, exp, float, length, cos, max, mix, normalize, positionLocal, pow, sin, smoothstep, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { CustomBlending, NodeMaterial, OneFactor, OneMinusSrcColorFactor } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { fbm, rampColor, tonemap } from './common';

export const CORONA_RADIUS = 2.6;

/** A star can bring its own colours, spin and pulsar poles; the defaults are the world's primary star. */
export interface StarOpts {
  ramp?: Node[];
  rot?: Node;
  pulsar?: Node;
  tilt?: Node;
  phase?: number; // offset of its slow brightness variation, so two stars do not breathe in step
  flares?: boolean; // whether the solar storm erupts on this star (the primary only)
}

/** Convective surface: advected granulation, drifting sunspots and bright storm patches, limb-darkened. */
export const createStarMaterial = (u: Uniforms, o: StarOpts = {}) => {
  const ramp = o.ramp ?? u.ramp;
  const rot = o.rot ?? u.rotP;
  const pulsar = o.pulsar ?? u.pulsar;
  const tilt = o.tilt ?? u.beamTilt;
  const phase = o.phase ?? 0;
  const m = new NodeMaterial();
  m.fragmentNode = Fn(() => {
    const N0 = normalize(positionLocal);
    const V = normalize(u.camL.sub(positionLocal));
    const d = rot.mul(N0);
    const t = u.clock.mul(u.activity.mul(0.5).add(0.25));

    const warp = vec3(
      fbm(d.mul(3).add(vec3(0, t.mul(0.12), 0)), 3),
      fbm(d.mul(3).add(vec3(5, 5, 5)).add(vec3(t.mul(0.1), 0, 0)), 3),
      fbm(d.mul(3).add(vec3(9, 9, 9)), 3),
    );
    const granulation = fbm(d.mul(13).add(warp.mul(0.9)).add(vec3(0, 0, t.mul(0.2))), 5);
    const spots = smoothstep(0.1, 0.34, fbm(d.mul(2.3).add(vec3(2, 2, 2)).add(vec3(t.mul(0.02), 0, 0)), 3)).mul(u.activity).mul(0.3);
    const storm = pow(smoothstep(0.35, 0.8, fbm(d.mul(4.5).add(vec3(t.mul(0.35), 0, 3)), 4).mul(1.4)), 2).mul(u.activity).mul(u.storms.mul(2.2).add(1));

    // sunspots: near-black umbra inside a dimmer penumbra, confined to the active latitudes; `u.spots` sets how many
    const sf = fbm(d.mul(2.6).add(vec3(2, 5, 2)).add(vec3(t.mul(0.012), 0, 0)), 3);
    const lat = smoothstep(0.8, 0.35, abs(d.y));
    const thr = mix(0.3, 0.09, u.spots);
    const umbra = smoothstep(thr, thr.add(0.045), sf).mul(lat);
    const penumbra = smoothstep(thr.sub(0.07), thr, sf).mul(lat);

    // a pulsar's magnetic poles: hot caps where the beams leave the surface, fixed in the star's frame so they turn with it
    const pole = vec3(0, cos(tilt), sin(tilt));
    const cap = pow(abs(dot(d, pole)), 14).mul(pulsar);

    const breathe = float(1).add(u.twinkle.mul(sin(u.clock.mul(u.twinkleRate).add(phase))));

    const mu = max(dot(N0, V), 0);
    const limb = pow(mu, 0.55).mul(0.55).add(0.45);
    // the flare's footpoint: a white-hot patch on the disc, just inside the limb where the loops rise
    const site = normalize(u.flareDir.add(normalize(u.camL).mul(0.45)));
    const flash = o.flares === false ? float(0) : pow(max(dot(N0, site), 0), 90).mul(u.flare).mul(0.8);
    const heat = granulation.mul(1.1).add(0.55).sub(spots.mul(0.55)).add(storm.mul(0.7)).add(cap.mul(0.9)).add(flash);
    const dark = float(1).sub(umbra.mul(0.96)).mul(float(1).sub(penumbra.mul(0.3)));
    return vec4(tonemap(rampColor(ramp, heat.mul(limb)).mul(limb).mul(dark).mul(float(1).add(cap.mul(0.6))).mul(breathe).mul(2.4).mul(u.fade)), 1);
  })();
  return m;
};

/**
 * `center` and `scale` place the star (its radius is `scale`); `occluder` is another star that may sit between this
 * corona and the camera, whose body must hide it instead of letting the glow show through.
 */
export interface CoronaOpts {
  center?: Node;
  scale?: Node;
  ramp?: Node[];
  occluder?: { center: Node; radius: Node };
  phase?: number;
  flares?: boolean;
}

/** Corona and prominences: evaluated from the ray's closest approach to the star, screen-blended over the scene. */
export const createCoronaMaterial = (u: Uniforms, o: CoronaOpts = {}) => {
  const center = o.center ?? vec3(0, 0, 0);
  const scale = o.scale ?? float(1);
  const ramp = o.ramp ?? u.ramp;
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = false;
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcColorFactor;
  m.fragmentNode = Fn(() => {
    const ro = u.camL.sub(center);
    const rd = normalize(positionLocal.mul(scale.mul(CORONA_RADIUS)).sub(ro));
    const pc = ro.add(rd.mul(dot(ro, rd).negate()));
    const b = max(length(pc).div(scale), 0.001);
    const dir = pc.div(max(length(pc), 0.001));
    const t = u.clock.mul(u.activity.mul(0.5).add(0.25));
    const out = max(b.sub(1), 0);

    const base = exp(out.mul(-5.5)).mul(0.9).add(exp(out.mul(-1.4)).mul(0.22));
    const n = fbm(dir.mul(3.2).add(vec3(0, 0, t.mul(0.12))), 4).add(0.5);
    const streamers = pow(clamp(n, 0, 1.4), 2.2).mul(exp(out.mul(-1.1))).mul(0.55);
    const arcs = pow(smoothstep(0.1, 0.5, fbm(dir.mul(5.5).add(vec3(t.mul(0.3), 1, 2)), 3)), 2)
      .mul(exp(out.mul(-5))).mul(1.8).mul(u.activity);
    // eruptions: in a few sectors, tall loops of plasma that swell and fall back; only violent stars have them
    const sector = smoothstep(0.3, 0.7, fbm(dir.mul(2).add(vec3(0, t.mul(0.07), 5)), 3).mul(1.6).add(0.4)).mul(u.storms);
    const loops = pow(smoothstep(0.08, 0.5, fbm(dir.mul(4.4).add(vec3(t.mul(0.45), 3, 1)), 3)), 2);
    const eruption = sector.mul(loops).mul(exp(out.mul(-1.4))).mul(smoothstep(0, 0.12, out)).mul(sin(t.mul(1.3)).mul(0.3).add(0.8)).mul(6);
    const outsideDisc = smoothstep(0.985, 1, b);
    // a companion in front of this star hides its glow: does the view ray hit the occluder before reaching this star?
    const occ = float(0).toVar();
    if (o.occluder) {
      const oc = u.camL.sub(o.occluder.center);
      const bb = dot(oc, rd);
      const disc = bb.mul(bb).sub(dot(oc, oc)).add(o.occluder.radius.mul(o.occluder.radius));
      const tHit = bb.negate().sub(max(disc, 0).sqrt());
      const tOwn = dot(ro, rd).negate();
      // the ray's miss distance squared ramps from 0 to the sphere's radius squared, so the soft edge must scale with it: a fixed
      // width let a small body (a pulsar) hide only half of what sat behind it, which showed as a bright outline passing through
      const hit = smoothstep(0, o.occluder.radius.mul(o.occluder.radius).mul(0.04).add(1e-6), disc);
      const front = hit.mul(smoothstep(tOwn.add(0.02), tOwn, tHit)).mul(smoothstep(-0.01, 0.01, tHit));
      // hidden outright behind the other star's body; in front of it the glow is almost entirely held back, or the star behind would look washed out and nested inside this one
      occ.assign(front.add(hit.sub(front).mul(0.9)));
    }

    // solar storm: a pair of nested loops that rise from the footpoint and swell, then a shock front of plasma thrown outward
    const flareI = float(0).toVar();
    if (o.flares !== false) {
      If(u.flare.greaterThan(0.002), () => {
        const fp = u.flareProg;
        const phi = length(dir.sub(u.flareDir));
        const amt = u.flareAmt.mul(u.flareSize);
        const grow = smoothstep(0, 0.45, fp);
        const h = mix(0.15, 0.9, grow).mul(amt);
        const half = mix(0.13, 0.36, grow);
        const x = clamp(phi.div(half), 0, 1);
        // ragged edge for the loops, and streaks stretched along the height and advected upward, so the plasma licks like flames
        const rag = fbm(vec3(phi.mul(12), out.mul(7).sub(fp.mul(4)), t.mul(0.35)), 3);
        const lick = fbm(vec3(phi.mul(18), out.mul(2.2).sub(fp.mul(3)), t.mul(0.5)), 3);
        const loop = (k: number) => {
          const xk = clamp(x.mul(k), 0, 1);
          const arch = h.div(k).mul(pow(float(1).sub(xk.mul(xk)), 0.7));
          const d = out.sub(arch).add(rag.mul(0.32)).div(float(0.03).add(fp.mul(0.025)));
          return exp(d.mul(d).negate()).mul(smoothstep(1.0, 0.85, x.mul(k)));
        };
        const loops = loop(1).add(loop(1.45).mul(0.7)).mul(clamp(rag.mul(1.8).add(1), 0.1, 2)).mul(2.2);
        // tongues of fire licking up from the footpoints, thinning out toward the crest
        const reach = h.mul(1.15).add(0.12);
        const tongues = smoothstep(0.02, 0.45, lick.mul(1.7).add(0.22))
          .mul(exp(pow(phi.div(half.mul(1.1).add(out.mul(0.3))), 2).negate()))
          .mul(pow(float(1).sub(smoothstep(0, reach, out)), 1.3)).mul(smoothstep(0, 0.04, out)).mul(2.6);
        const under = exp(out.mul(-3.5)).mul(exp(pow(phi.div(half.mul(1.1)), 2).negate())).mul(0.3);
        // ejecta: clumps of plasma thrown outward, ragged rather than a clean ring
        const front = fp.sub(0.15).mul(2);
        const clumps = smoothstep(0.1, 0.55, fbm(vec3(phi.mul(5), out.sub(front).mul(3.2), t.mul(0.25)), 3).mul(1.5).add(0.3));
        const shell = clumps.mul(exp(pow(out.sub(front).div(0.5), 2).negate())).mul(exp(pow(phi.div(0.55), 2).negate()))
          .mul(smoothstep(0.15, 0.3, fp)).mul(float(1).sub(smoothstep(0.5, 1, fp))).mul(amt).mul(0.3);
        const burst = exp(fp.mul(-7)).mul(exp(out.mul(-2.2))).mul(exp(pow(phi.div(0.35), 2).negate())).mul(0.7);
        flareI.assign(float(1).sub(exp(loops.add(tongues).add(under).add(shell).add(burst).mul(u.flare).negate())).mul(smoothstep(0, 0.1, out)));
      });
    }

    // lens glare: thin diffraction spikes and a faint ghost ring, strongest on bright, active stars
    const e1 = normalize(cross(rd, vec3(0, 1, 0)));
    const e2 = cross(rd, e1);
    const ang = atan(dot(dir, e2), dot(dir, e1));
    const spikeA = pow(abs(cos(ang.mul(3))), 90);
    const spikeB = pow(abs(cos(ang.mul(3).add(0.5236 * 3))), 140).mul(0.4);
    const spikes = spikeA.add(spikeB).mul(exp(out.mul(-1.7))).div(out.mul(4).add(1)).mul(u.activity.mul(0.25).add(0.2));
    const ghost = exp(pow(b.sub(1.95).div(0.09), 2).negate()).mul(0.035);

    const intensity = base.add(streamers).add(arcs).add(eruption).add(spikes).add(ghost).mul(outsideDisc).mul(smoothstep(CORONA_RADIUS, 1.5, b)).mul(float(1).sub(occ));
    const breathe = float(1).add(u.twinkle.mul(sin(u.clock.mul(u.twinkleRate).add(o.phase ?? 0))));
    const col = mix(ramp[2], ramp[4], clamp(exp(out.mul(-6)).add(spikes.mul(1.5)), 0, 1)).mul(intensity).mul(breathe).mul(1.6);
    const hot = rampColor(ramp, clamp(flareI.mul(0.6).add(0.3), 0, 1)).mul(flareI).mul(float(1).sub(occ)).mul(outsideDisc).mul(smoothstep(CORONA_RADIUS, 1.9, b)).mul(1.3);
    return vec4(vec3(1).sub(exp(col.add(hot).mul(u.fade).negate())), 1);
  })();
  return m;
};
