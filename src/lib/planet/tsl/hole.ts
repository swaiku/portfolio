import {
  Break, Fn, If, Loop, atan, clamp, cos, cross, dFdx, dFdy, dot, exp, float, fwidth, length, max, mix, normalize, positionLocal,
  pow, sin, smoothstep, sqrt, vec3, vec4,
} from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import type { Texture } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { fbm, rampColor, tonemap } from './common';
import { skyColor } from './sky';

// in units of the bounding sphere (radius 1)
const HORIZON = 0.075;
const SHADOW = HORIZON * 2.598; // critical impact parameter, 3√3/2 · r_s
const STEPS = 160;

/**
 * Ray-marches light through a Schwarzschild-style bend, Gargantua style: a thin, very bright disk, its far side lensed
 * over and under the shadow.
 *
 * The shadow is analytic in the ray's impact parameter (known where the ray enters the bounding
 * sphere), which makes their edges exact and anti-aliased from the screen-space derivative. The disk comes from
 * integrating the ray and counting its crossings of the equatorial plane. Deflection fades out toward the bounding
 * sphere so the lensed sky stays continuous with the backdrop dome.
 */
export const createHoleMaterial = (u: Uniforms, skyTex: Texture) => {
  const h = u.hole;
  const m = new NodeMaterial();
  // writes depth like any opaque body, so the sky dome drawn after it leaves its pixels alone
  m.fragmentNode = Fn(() => {
    const p0 = positionLocal;
    const v0 = normalize(p0.sub(u.camL));
    const impact = length(cross(p0, v0));
    const aa = fwidth(impact); // derivatives before any branch
    const footprint = max(length(dFdx(v0)), length(dFdy(v0)));

    const p = p0.toVar();
    const v = v0.toVar();
    const emission = vec3(0).toVar();
    const transmit = float(1).toVar();

    Loop(STEPS, () => {
      const r = length(p);
      const ds = clamp(r.mul(0.035), 0.002, 0.035);
      // a long, gentle fade: the far field's 1/b deflection cut off over a short band shears the sky into streaks
      const window = smoothstep(1, 0.35, r);
      const hh = length(cross(p, v));
      const pull = p.mul(hh.mul(hh).mul(-1.5 * HORIZON).div(pow(r, 5)).mul(window));
      v.assign(normalize(v.add(pull.mul(ds))));
      const next = p.add(v.mul(ds));

      // thick, faint gas above and below the thin disk: a gaussian slab that flares outward; it is what gives the disk a glow
      const rho = length(p.xz);
      const slab = exp(p.y.div(rho.mul(0.17).add(0.015)).pow(2).negate());
      const span = smoothstep(h.diskIn.mul(0.75), h.diskIn.mul(1.3), rho).mul(smoothstep(h.diskOut.mul(1.15), h.diskOut.mul(0.6), rho));
      const hazeHeat = pow(float(1).sub(rho.sub(h.diskIn).div(h.diskOut.sub(h.diskIn)).clamp(0, 1)), 1.4).mul(0.8);
      const hv = normalize(vec3(p.z.negate(), 0, p.x));
      const hg = float(1).div(float(1).sub(float(HORIZON / 2).div(rho.sub(HORIZON).max(0.01)).sqrt().mul(h.doppler).mul(dot(hv, v.negate())).min(0.85)));
      emission.addAssign(transmit.mul(slab).mul(span).mul(rampColor(u.ramp, hazeHeat.mul(hg))).mul(pow(hg, 2.5)).mul(ds.mul(h.exposure).mul(3.4)));

      If(p.y.mul(next.y).lessThan(0), () => {
        const hit = mix(p, next, p.y.div(p.y.sub(next.y)));
        const rr = length(hit.xz);
        If(rr.greaterThan(h.diskIn).and(rr.lessThan(h.diskOut)), () => {
          const k = rr.sub(h.diskIn).div(h.diskOut.sub(h.diskIn));
          // Keplerian shear: inner rings lap the outer ones
          const phi = atan(hit.z, hit.x).sub(u.clock.mul(1.1).div(pow(rr.div(h.diskIn), 1.5)));
          const streak = fbm(vec3(rr.mul(70), cos(phi).mul(2.2), sin(phi).mul(2.2)), 4).add(0.5);
          const clump = fbm(vec3(rr.mul(18), cos(phi).mul(3), sin(phi).mul(3)), 2).add(0.5);
          // razor inner edge at the innermost stable orbit, long soft fade outward
          const edge = smoothstep(0, 0.07, k).mul(smoothstep(1, 0.3, k));
          const density = edge.mul(streak.mul(1.0).add(0.2)).mul(clump.mul(0.9).add(0.45)).clamp(0, 1);

          // relativistic Doppler g = 1 / (γ (1 − β cos θ)), orbital β from Kepler; `doppler` tames it toward art
          const beta = sqrt(float(HORIZON / 2).div(rr.sub(HORIZON))).mul(h.doppler).min(0.9);
          const velocity = normalize(vec3(hit.z.negate(), 0, hit.x));
          const cosT = dot(velocity, v.negate());
          const g = sqrt(float(1).sub(beta.mul(beta))).div(float(1).sub(beta.mul(cosT)));
          const redshift = sqrt(float(1).sub(float(HORIZON).div(rr))); // climbing out of the well

          // hottest just outside the inner edge; beaming shifts the colour as well as the brightness
          const temp = pow(float(1).sub(k), 1.6).mul(smoothstep(0, 0.08, k).mul(0.25).add(0.75));
          const heat = temp.mul(g).mul(redshift).mul(1.2).add(0.32).add(streak.sub(0.5).mul(0.1));
          const intensity = pow(g, 3).mul(temp.mul(11).add(2));
          emission.addAssign(transmit.mul(density).mul(rampColor(u.ramp, heat)).mul(intensity).mul(h.exposure));
          transmit.mulAssign(float(1).sub(density.mul(0.55)));
        });
      });
      p.assign(next);

      If(length(p).lessThan(HORIZON), () => Break());
      If(length(p).greaterThan(1).and(dot(p, v).greaterThan(0)), () => Break());
    });

    // anti-aliased shadow edge
    const shadow = smoothstep(float(SHADOW).sub(aa), float(SHADOW).add(aa), impact);

    // Einstein ring: a thin bright circle where the light skims the shadow, with the stars it gathers fading out just beyond
    const ringD = impact.sub(SHADOW);
    const ringLine = exp(ringD.div(aa.mul(0.8).add(SHADOW * 0.004)).pow(2).negate());
    const ringHalo = exp(ringD.max(0).div(SHADOW * 0.09).negate()).mul(smoothstep(float(SHADOW).sub(aa), float(SHADOW).add(aa), impact));
    emission.addAssign(vec3(1, 0.93, 0.82).mul(ringLine.mul(1.4).add(ringHalo.mul(0.3))).mul(transmit).mul(h.ring));

    // where the bend squeezes many stars into one pixel they average out instead of sparkling into snow and scratches
    const squeeze = max(length(dFdx(v)), length(dFdy(v))).div(footprint);
    const starGain = pow(float(1).div(max(squeeze, 1)), 0.6).mul(max(squeeze, 1).pow(0.25).min(2.5));
    const background = skyColor(skyTex, u.clock, u.sky.seed, u.holeToSky.mul(v), footprint, starGain);
    const open = mix(float(1), transmit.mul(shadow), u.fade);
    return vec4(tonemap(emission.mul(u.fade)).add(background.mul(open)), 1);
  })();
  return m;
};
