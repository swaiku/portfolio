import {
  Fn, If, abs, atan, clamp, cross, dFdx, dFdy, dot, exp, float, length, cos, max, mix, mx_worley_noise_vec2, normalize, positionLocal, pow, sin,
  smoothstep, sqrt, vec3, vec4,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { CustomBlending, NodeMaterial, OneFactor, OneMinusSrcColorFactor } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { fbm, rampColor, sq, tonemap } from './common';

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
      fbm(d.mul(3).add(vec3(0, t.mul(0.12), 0)), 2),
      fbm(d.mul(3).add(vec3(5, 5, 5)).add(vec3(t.mul(0.1), 0, 0)), 2),
      fbm(d.mul(3).add(vec3(9, 9, 9)), 2),
    );
    // the photosphere boils in cells: bright where hot gas wells up, dark in the lanes where it sinks back. The cells sit
    // on top of broader, slower patches; where a cell would be smaller than a pixel it fades out instead of shimmering
    const cellFade = smoothstep(0.014, 0.005, max(length(dFdx(N0)), length(dFdy(N0))));
    const near = mx_worley_noise_vec2(d.mul(34).add(warp.mul(1.5)).add(vec3(0, 0, t.mul(0.25))));
    const f1 = sqrt(near.x);
    const cells = smoothstep(0.02, 0.24, sqrt(near.y).sub(f1)).mul(float(1).sub(f1.mul(0.6))).sub(0.55).mul(cellFade);
    const granulation = fbm(d.mul(13).add(warp.mul(0.9)).add(vec3(0, 0, t.mul(0.2))), 3).mul(0.85).add(cells.mul(0.24));
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

    // solar storm, in the order a real one runs. A prominence, an arch of plasma held up by the magnetic field and made of
    // fine threads, rises slowly from two footpoints on the limb. It loses its hold and erupts: the arch stretches outward
    // and tears, and a coronal mass ejection leaves ahead of it, a bubble with a bright front, a dark cavity and the torn
    // plasma as its core. Behind, a row of small bright loops closes over the wound and fades
    const flareI = float(0).toVar();
    if (o.flares !== false) {
      If(u.flare.greaterThan(0.002), () => {
        const fp = u.flareProg;
        const amt = u.flareAmt.mul(u.flareSize);
        // the plane of the sky round the footpoint: X along the limb, Y straight up from it, both in star radii
        const X = b.mul(dot(dir, normalize(cross(normalize(ro), u.flareDir)))).toVar();
        const Y = b.mul(dot(dir, u.flareDir)).sub(1).toVar();
        const erupt = sq(smoothstep(0.25, 0.75, fp)).toVar();
        const H = amt.mul(smoothstep(0, 0.3, fp).mul(0.22).add(0.1).add(erupt.mul(1.5)));
        const W = amt.mul(0.12).add(0.1).add(erupt.mul(0.08)).toVar();
        const ex = X.div(W);
        const ey = Y.div(H);
        const e = sqrt(sq(ex).add(sq(ey))).sub(1).toVar(); // 0 on the arch, negative under it
        const a = atan(ey, ex).toVar();
        const threads = fbm(vec3(a.mul(2.5), e.mul(16), t.mul(0.3)), 3).mul(1.8).add(0.75).clamp(0.05, 2);
        // plasma draining back down the field lines: coronal rain
        const rain = fbm(vec3(X.mul(22), Y.mul(5).add(t.mul(0.9)), 2), 2).mul(1.6).add(0.8).clamp(0.2, 1.8).toVar();
        const arch = exp(sq(e.div(erupt.mul(0.1).add(0.09))).negate()).mul(threads).mul(rain).mul(float(1).sub(smoothstep(0.5, 0.85, fp))).mul(2.4);
        const sheet = smoothstep(0.1, -0.5, e).mul(rain).mul(float(1).sub(erupt)).mul(0.25);

        const go = smoothstep(0.28, 1, fp).toVar();
        const reach = pow(go, 0.8).mul(amt.mul(0.9).add(0.5));
        const rho = reach.mul(0.55).add(0.02).toVar();
        const rise = Y.sub(reach.sub(rho));
        const dC = sqrt(sq(X).add(sq(rise))).toVar();
        const ragged = fbm(vec3(a.mul(3), reach.mul(2), t.mul(0.2)), 3).mul(1.4).add(0.8).clamp(0.2, 1.6).toVar();
        const leaving = smoothstep(0, 0.1, go).mul(float(1).sub(smoothstep(0.7, 1, fp)));
        const front = exp(sq(dC.sub(rho).div(rho.mul(0.16).add(0.02))).negate()).mul(smoothstep(-0.4, 0.3, rise.div(rho))).mul(ragged).mul(leaving).mul(0.55);
        const lump = exp(sq(dC.div(rho.mul(0.3))).negate()).mul(ragged).mul(leaving).mul(0.4);

        const arcade = exp(sq(X.div(W.mul(1.1))).negate()).mul(exp(Y.max(0).mul(-16))).mul(cos(X.mul(80)).mul(0.35).add(0.65)).mul(smoothstep(0.25, 0.4, fp)).mul(1.4);
        const burst = exp(fp.mul(-10)).mul(exp(sq(X).add(sq(Y)).div(-0.03))).mul(1.5);
        flareI.assign(float(1).sub(exp(arch.add(sheet).add(front).add(lump).add(arcade).add(burst).mul(smoothstep(-0.02, 0.05, Y)).mul(u.flare).negate()))
          .mul(smoothstep(0, 0.03, out)));
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
