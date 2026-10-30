import { Fn, clamp, dot, exp, float, length, max, mix, normalize, positionLocal, pow, smoothstep, vec3, vec4 } from 'three/tsl';
import { CustomBlending, NodeMaterial, OneFactor, OneMinusSrcColorFactor } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { fbm, rampColor, tonemap } from './common';

export const CORONA_RADIUS = 2.6;

/** Convective surface: advected granulation, drifting sunspots and bright storm patches, limb-darkened. */
export const createStarMaterial = (u: Uniforms) => {
  const m = new NodeMaterial();
  m.fragmentNode = Fn(() => {
    const N0 = normalize(positionLocal);
    const V = normalize(u.camL.sub(positionLocal));
    const d = u.rotP.mul(N0);
    const t = u.clock.mul(u.activity.mul(0.5).add(0.25));

    const warp = vec3(
      fbm(d.mul(3).add(vec3(0, t.mul(0.12), 0)), 3),
      fbm(d.mul(3).add(vec3(5, 5, 5)).add(vec3(t.mul(0.1), 0, 0)), 3),
      fbm(d.mul(3).add(vec3(9, 9, 9)), 3),
    );
    const granulation = fbm(d.mul(13).add(warp.mul(0.9)).add(vec3(0, 0, t.mul(0.2))), 5);
    const spots = smoothstep(0.1, 0.34, fbm(d.mul(2.3).add(vec3(2, 2, 2)).add(vec3(t.mul(0.02), 0, 0)), 3)).mul(u.activity);
    const storm = pow(smoothstep(0.35, 0.8, fbm(d.mul(4.5).add(vec3(t.mul(0.35), 0, 3)), 4).mul(1.4)), 2).mul(u.activity);

    const mu = max(dot(N0, V), 0);
    const limb = pow(mu, 0.55).mul(0.55).add(0.45);
    const heat = granulation.mul(1.1).add(0.55).sub(spots.mul(0.55)).add(storm.mul(0.7));
    return vec4(tonemap(rampColor(u.ramp, heat.mul(limb)).mul(limb).mul(2.4).mul(u.fade)), 1);
  })();
  return m;
};

/** Corona and prominences: evaluated from the ray's closest approach to the star, screen-blended over the scene. */
export const createCoronaMaterial = (u: Uniforms) => {
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = false;
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcColorFactor;
  m.fragmentNode = Fn(() => {
    const ro = u.camL;
    const rd = normalize(positionLocal.mul(CORONA_RADIUS).sub(ro));
    const pc = ro.add(rd.mul(dot(ro, rd).negate()));
    const b = max(length(pc), 0.001);
    const dir = pc.div(b);
    const t = u.clock.mul(u.activity.mul(0.5).add(0.25));
    const out = max(b.sub(1), 0);

    const base = exp(out.mul(-5.5)).mul(0.9).add(exp(out.mul(-1.4)).mul(0.22));
    const n = fbm(dir.mul(3.2).add(vec3(0, 0, t.mul(0.12))), 4).add(0.5);
    const streamers = pow(clamp(n, 0, 1.4), 2.2).mul(exp(out.mul(-1.1))).mul(0.55);
    const arcs = pow(smoothstep(0.1, 0.5, fbm(dir.mul(5.5).add(vec3(t.mul(0.3), 1, 2)), 3)), 2)
      .mul(exp(out.mul(-5))).mul(1.8).mul(u.activity);
    const outsideDisc = smoothstep(0.985, 1, b);
    const intensity = base.add(streamers).add(arcs).mul(outsideDisc).mul(smoothstep(CORONA_RADIUS, 1.5, b));
    const col = mix(u.ramp[2], u.ramp[4], exp(out.mul(-6))).mul(intensity).mul(1.6);
    return vec4(vec3(1).sub(exp(col.mul(u.fade).negate())), 1);
  })();
  return m;
};
