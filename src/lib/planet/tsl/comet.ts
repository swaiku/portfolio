import { Fn, abs, clamp, exp, float, length, max, mix, positionLocal, pow, smoothstep, vec3, vec4 } from 'three/tsl';
import { CustomBlending, NodeMaterial, OneFactor, OneMinusSrcColorFactor } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { fbm } from './common';

/** The comet is one flat sheet painted by this shader: x runs from the head down the tail, y across it. */
export const COMET_LENGTH = 9;
export const COMET_HALF_WIDTH = 3;
export const COMET_HEAD_OVERHANG = 1.5;

const sq = (x: Node): Node => x.mul(x);

export const createCometMaterial = (u: Uniforms) => {
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = false;
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcColorFactor;
  m.fragmentNode = Fn(() => {
    const [length_, ionAmt, ionW, streakAmt] = [u.cometA.x, u.cometA.y, u.cometA.z, u.cometA.w];
    const [dustAmt, curve, kinkAmt, headK] = [u.cometB.x, u.cometB.y, u.cometB.z, u.cometB.w];
    const x = positionLocal.x;
    const y = positionLocal.y;
    const r = length(positionLocal.xy).div(headK);
    const L = length_.mul(COMET_LENGTH);
    const t = clamp(x.div(L), 0, 1);
    const fadeOut = pow(float(1).sub(t), 1.4);
    const startIn = smoothstep(0, 0.7, x);
    const near = float(1).add(exp(x.mul(-1.1)).mul(2.5)); // the tail is brightest next to the head
    const drift = u.clock.mul(0.08);
    const sd = u.cometSeed;

    // head: a white-hot core inside the glow of the coma's gas; both are gaussians, so they reach zero well inside the sheet
    const halo = exp(sq(r).mul(-2.8)).mul(0.85);
    const core = exp(sq(r).mul(-70)).mul(2.6).add(exp(r.mul(-9)).mul(0.5));
    const head = u.cometHead.mul(halo).add(vec3(1, 1, 1).mul(core));

    // ion tail: thin, straight, split into streaks by noise stretched along the tail, with a lazy kink far from the head
    const kink = fbm(vec3(x.mul(0.18), drift.mul(0.4), sd), 3).mul(t).mul(kinkAmt).mul(0.8);
    const across = y.sub(kink).div(t.mul(0.55).add(0.07).mul(ionW));
    const streaks = smoothstep(-0.12, 0.3, fbm(vec3(x.mul(0.35).sub(drift), across.mul(3.5), sd.add(0.5)), 4)).mul(streakAmt).add(0.3);
    const ion = exp(sq(across).mul(-1.6)).mul(streaks).mul(fadeOut).mul(startIn).mul(near).mul(ionAmt);
    const ionCol = mix(vec3(0.7, 0.85, 1), u.cometTip, smoothstep(0, 0.45, t));

    // dust tail: wider, paler, softer, bending to one side
    const acrossDust = y.sub(t.mul(t).mul(curve)).div(t.mul(1.2).add(0.18));
    const cloud = fbm(vec3(x.mul(0.3).sub(drift.mul(0.5)), acrossDust.mul(1.4), sd.add(3)), 3).mul(1.2).add(0.55);
    const dust = exp(sq(acrossDust).mul(-1.1)).mul(cloud).mul(fadeOut).mul(startIn).mul(near).mul(dustAmt).mul(0.35);
    const dustCol = mix(vec3(1, 0.96, 0.88), u.cometTip.mul(0.9).add(0.15), smoothstep(0, 0.6, t));

    // fade to exactly zero at every border of the sheet, so its outline can never show
    const window = smoothstep(-COMET_HEAD_OVERHANG, -COMET_HEAD_OVERHANG + 0.8, x)
      .mul(smoothstep(COMET_HALF_WIDTH, COMET_HALF_WIDTH - 1, abs(y)))
      .mul(smoothstep(COMET_LENGTH, COMET_LENGTH - 1.5, x));
    const col = max(head.add(ionCol.mul(ion)).add(dustCol.mul(dust)).mul(window).mul(u.fade).sub(0.004), 0);
    return vec4(float(1).sub(exp(col.negate())), 1);
  })();
  return m;
};
