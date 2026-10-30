import { Fn, Loop, dot, exp, float, length, max, normalize, pow, positionLocal, select, sqrt, vec2, vec3, vec4 } from 'three/tsl';
import { CustomBlending, NodeMaterial, OneFactor, OneMinusSrcColorFactor } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import type { Uniforms } from '../uniforms';

export const ATMO_RADIUS = 1.04;
const RP = 1;
const HR = 0.009; // Rayleigh scale height
const HM = 0.003; // Mie scale height
const BM = 1.1;
const SUN_I = 6;
const STEPS = 16;
const LIGHT_STEPS = 5;

const raySphere = Fn(([ro, rd, r]: [Node, Node, Node]) => {
  const b = dot(ro, rd);
  const h = b.mul(b).sub(dot(ro, ro).sub(r.mul(r)));
  const s = sqrt(max(h, 0));
  return select(h.lessThan(0), vec2(-1, -1), vec2(b.negate().sub(s), b.negate().add(s)));
});

/** Single-scattering ray march through a shell around the planet, composited with a screen blend. */
export const createAtmosphereMaterial = (u: Uniforms) => {
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = false;
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcColorFactor;

  m.fragmentNode = Fn(() => {
    const ro = u.camL;
    const rd = normalize(positionLocal.mul(ATMO_RADIUS).sub(ro));
    const L = normalize(u.sunL);
    const ta = raySphere(ro, rd, float(ATMO_RADIUS));
    const t0 = max(ta.x, 0);
    const tp = raySphere(ro, rd, float(RP));
    const t1 = select(tp.x.greaterThan(0), tp.x.min(ta.y), ta.y);
    const ds = t1.sub(t0).div(STEPS);

    const mu = dot(rd, L);
    const phR = float(3 / (16 * Math.PI)).mul(mu.mul(mu).add(1));
    const g = 0.78;
    const phM = float(3 / (8 * Math.PI)).mul(float(1 - g * g).mul(mu.mul(mu).add(1)))
      .div(float(2 + g * g).mul(pow(float(1 + g * g).sub(mu.mul(2 * g)), 1.5)));

    const sumR = vec3(0).toVar();
    const sumM = vec3(0).toVar();
    const odR = float(0).toVar();
    const odM = float(0).toVar();

    Loop(STEPS, ({ i }) => {
      const p = ro.add(rd.mul(t0.add(ds.mul(float(i).add(0.5)))));
      const h = max(length(p).sub(RP), 0);
      const dR = exp(h.negate().div(HR)).mul(ds);
      const dM = exp(h.negate().div(HM)).mul(ds);
      odR.addAssign(dR);
      odM.addAssign(dM);

      const inShadow = raySphere(p, L, float(RP)).x.greaterThan(0);
      const dl = raySphere(p, L, float(ATMO_RADIUS)).y.div(LIGHT_STEPS);
      const lR = float(0).toVar();
      const lM = float(0).toVar();
      Loop(LIGHT_STEPS, ({ i: j }) => {
        const hq = max(length(p.add(L.mul(dl.mul(float(j).add(0.5))))).sub(RP), 0);
        lR.addAssign(exp(hq.negate().div(HR)).mul(dl));
        lM.addAssign(exp(hq.negate().div(HM)).mul(dl));
      });
      const tau = u.br.mul(odR.add(lR)).add(vec3(BM * 1.1).mul(odM.add(lM)));
      const att = exp(tau.negate()).mul(select(inShadow, float(0), float(1)));
      sumR.addAssign(att.mul(dR));
      sumM.addAssign(att.mul(dM));
    });

    const radiance = u.sunCol.mul(SUN_I).mul(sumR.mul(u.br).mul(phR).add(sumM.mul(BM).mul(phM))).mul(u.scatter).mul(0.7);
    const mapped = vec3(1).sub(exp(radiance.mul(-0.9)));
    return vec4(mapped.mul(u.fade), 1);
  })();
  return m;
};
