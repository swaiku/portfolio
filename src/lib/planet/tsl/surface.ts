import {
  Fn, If, Discard, abs, clamp, cross, dFdx, dFdy, dot, exp, float, length, max, mix, normalize, pow, positionLocal,
  select, sin, smoothstep, texture, transpose, vec3, vec4,
} from 'three/tsl';
import { NodeMaterial, DoubleSide } from 'three/webgpu';
import type { Node, Texture } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { dirToUv, fbm, gnoise, lodFor, rampColor, tonemap } from './common';

const SUN = 2.35;

/** Sunlight reddened by the atmosphere it grazes near the terminator, then tinted by the star's colour. */
const sunColor = (mu: Node, u: Uniforms) => {
  const tr = vec3(0.05, 0.11, 0.26).div(max(mu, 0).add(0.055)).negate().exp();
  return u.sunCol.mul(tr).div(vec3(0.95, 0.9, 0.78));
};

const tangentFrame = (n: Node) => {
  const up = select(abs(n.y).greaterThan(0.999), vec3(1, 0, 0), vec3(0, 1, 0));
  const T = normalize(cross(up, n));
  return { T, B: cross(n, T) };
};

/** Ring opacity at distance `r` from the planet's axis, in the ring plane. Shared by the ring itself and its shadow. */
const ringAlpha = (u: Uniforms, r: Node) => {
  const k = r.sub(u.ringIn).div(u.ringOut.sub(u.ringIn));
  const b1 = gnoise(vec3(r.mul(u.ringF1), 1, 2)).mul(0.5).add(0.5);
  const b2 = gnoise(vec3(r.mul(u.ringF2), 4, 7)).mul(0.5).add(0.5);
  const bands = clamp(b1.mul(0.55).add(b2.mul(0.35)), 0, 1);
  let open: Node = float(0);
  for (const g of u.ringGaps) open = max(open, smoothstep(g.y, 0, abs(k.sub(g.x))));
  const edge = smoothstep(0, 0.05, k).mul(smoothstep(1, 0.9, k));
  return { alpha: edge.mul(bands.mul(0.82).add(0.18)).mul(float(1).sub(open.mul(0.92))).mul(u.ringAmt), b1 };
};

/** How much of the sun the rings take from a point on the planet: walk the sun ray up to the ring plane. */
const ringShadow = (u: Uniforms, p: Node, L: Node) => {
  const t = p.y.negate().div(L.y);
  const hit = p.add(L.mul(t));
  const a = ringAlpha(u, length(hit.xz)).alpha;
  return select(t.greaterThan(0.0001), a, float(0)).mul(u.hasRing).mul(0.6); // softer than a full-strength shadow
};

const sampleAt = (tex: Texture, dir: Node, lod: Node) => texture(tex, dirToUv(dir)).level(lod);

export const createPlanetMaterial = (u: Uniforms, planetTex: Texture, cloudTex: Texture) => {
  const ramp = (t: Node) => rampColor(u.ramp, t);

  const m = new NodeMaterial();
  m.fragmentNode = Fn(() => {
    const N0 = normalize(positionLocal).toVar();
    const V = normalize(u.camL.sub(positionLocal));
    const L = normalize(u.sunL);
    const d = u.rotP.mul(N0).toVar();
    // derivatives must run before any branch (WGSL requires uniform control flow)
    const lod = lodFor(N0, u.texW).toVar();
    const fpx = max(length(dFdx(N0)), length(dFdy(N0))).toVar();

    const pd = sampleAt(planetTex, d, lod).toVar();
    const h = pd.x;
    const sl = pd.yz;
    // strata are contour lines of the height: where they would pack tighter than a pixel they blur into noise, so they fade out
    const strataArg = h.mul(u.strataF);
    const strataFade = smoothstep(0.7, 0.25, max(length(dFdx(strataArg)), length(dFdy(strataArg)))).toVar();
    const moist = pd.w;
    const { T, B } = tangentFrame(N0);

    const liquid = u.hasLiq.greaterThan(0.5);
    const landM = select(liquid, smoothstep(u.sea.sub(0.006), u.sea.add(0.006), h), float(1)).toVar();
    const lat = abs(N0.y);
    const detFade = smoothstep(0.012, 0.0025, fpx).toVar();
    // fine detail only shows up close; each block below is skipped wherever its weight is zero, so a small or distant
    // planet, a dry world, a world without ice or the night side pay nothing for it (nearby pixels branch together)
    const grit = vec3(0).toVar();
    If(detFade.mul(landM).mul(float(1).sub(u.gas)).greaterThan(0.0005), () => {
      grit.assign(transpose(u.rotP).mul(
        vec3(gnoise(d.mul(90)), gnoise(d.mul(90).add(vec3(7, 7, 7))), gnoise(d.mul(90).add(vec3(13, 13, 13)))),
      ));
    });
    const n = normalize(N0.sub(T.mul(sl.x).add(B.mul(sl.y)).mul(landM.mul(0.11))).add(grit.mul(detFade.mul(landM).mul(0.16))));

    // --- albedo from the world's own palette ---
    const detA = fbm(d.mul(14), 4).toVar();
    const detB = float(0).toVar();
    If(detFade.greaterThan(0.0005), () => {
      detB.assign(fbm(d.mul(52).add(vec3(4, 4, 4)), 4).mul(detFade));
    });
    const lo = select(liquid, u.sea, float(-0.4));
    const t = h.sub(lo).div(0.95).add(moist.sub(0.5).mul(0.3)).add(detA.mul(0.2)).add(detB.mul(0.06)).toVar();
    t.assign(mix(t, h.add(detA.mul(0.05)), u.gas)); // bands read straight off the ramp
    t.addAssign(u.strata.mul(0.16).mul(strataFade).mul(sin(strataArg.add(detA.mul(0.8)).mul(6.2832))));

    const grain = float(0).toVar();
    If(fpx.lessThan(0.004), () => {
      grain.assign(gnoise(d.mul(160)).mul(smoothstep(0.004, 0.0008, fpx)));
    });
    const stainA = smoothstep(0.38, 0.52, moist);
    const stainB = smoothstep(0.62, 0.78, moist);
    const stain = mix(mix(vec3(1, 1, 1), u.gasA, stainA), u.gasB, stainB);
    const land = ramp(t).mul(mix(vec3(1, 1, 1), stain, u.gas.mul(0.9)))
      .mul(float(1).sub(smoothstep(1.5, 6, length(sl)).mul(0.38).mul(float(1).sub(u.gas))))
      .mul(detB.mul(1.3).add(0.5).add(detA.mul(0.4)).mul(0.45).add(0.8).add(grain.mul(0.1)));

    const depth = max(u.sea.sub(h), 0);
    const liq = mix(u.liqShallow, u.liqDeep, smoothstep(0, 0.16, depth)).add(u.liqShallow.mul(exp(depth.mul(-70))).mul(0.7));

    const iceM = float(0).toVar();
    const iceCol = u.iceCol.toVar();
    If(u.ice.greaterThan(0.01), () => {
      const iceStart = mix(1.08, 0.6, u.ice);
      iceM.assign(smoothstep(iceStart, iceStart.add(0.07), lat.add(moist.sub(0.5).mul(0.09)).add(gnoise(d.mul(12)).mul(0.025))));
      If(iceM.greaterThan(0), () => {
        iceCol.assign(u.iceCol.mul(gnoise(d.mul(9).add(vec3(3, 3, 3))).mul(0.5).add(0.5).mul(0.22).add(0.78)));
      });
    });

    const albedo = mix(mix(liq, land, landM), iceCol, iceM).toVar();
    const oceanM = float(1).sub(landM).mul(float(1).sub(iceM)).toVar();
    const nUse = mix(mix(n, N0, iceM.mul(float(1).sub(landM))), N0, u.gas); // no relief on a gas giant

    // --- cloud shadow: sample the cloud shell along the sun ray ---
    const ndlG = dot(N0, L).toVar();
    const q = normalize(N0.add(L.mul(float(0.012).div(max(ndlG, 0.14)))));
    const cs = sampleAt(cloudTex, u.rotC.mul(q), lod.add(1)).x.mul(u.cloudAmt).toVar();
    const shadow = float(1).sub(cs.mul(0.72)).mul(float(1).sub(ringShadow(u, N0, L))).toVar();

    // --- direct light ---
    const ndl = max(dot(nUse, L), 0);
    const horizon = smoothstep(-0.06, 0.07, ndlG).toVar();
    const sunC = sunColor(ndlG, u).toVar();
    const col = albedo.mul(sunC).mul(SUN).mul(ndl).mul(shadow).mul(horizon).toVar();

    // --- twilight band hugging the terminator, tinted by the sky ---
    const band = smoothstep(-0.14, -0.01, ndlG).mul(smoothstep(0.2, 0, ndlG));
    col.addAssign(albedo.mul(mix(vec3(0.95, 0.34, 0.1), u.atmoCol.mul(1.6), 0.55)).mul(band).mul(0.55).mul(shadow));
    const twi = smoothstep(-0.28, 0.35, ndlG).toVar();
    col.addAssign(albedo.mul(u.atmoCol).mul(0.16).mul(twi.mul(1.1).add(0.12)).mul(float(1).sub(cs.mul(0.5))));
    col.addAssign(albedo.mul(vec3(0.0016, 0.0024, 0.005)));

    // --- liquid: wave-broken sun glint and sky reflection ---
    const fres = float(0.02).add(pow(float(1).sub(max(dot(N0, V), 0)), 5).mul(0.98)).toVar();
    // the glint only exists on sunlit liquid; the waves that break it up are the most expensive noise here
    If(oceanM.mul(horizon).greaterThan(0), () => {
      const H = normalize(L.add(V));
      const waves = vec3(gnoise(d.mul(120)), gnoise(d.mul(120).add(vec3(7, 7, 7))), gnoise(d.mul(120).add(vec3(13, 13, 13)))).mul(0.5).toVar();
      If(fpx.lessThan(0.006), () => {
        waves.addAssign(vec3(gnoise(d.mul(340)), gnoise(d.mul(340).add(vec3(5, 5, 5))), gnoise(d.mul(340).add(vec3(11, 11, 11)))).mul(0.5)
          .mul(smoothstep(0.006, 0.0015, fpx)));
      });
      const ndh = max(dot(normalize(N0.add(waves.mul(0.045))), H), 0);
      const glint = pow(ndh, 40).mul(0.03).add(pow(ndh, 8).mul(0.006));
      col.addAssign(oceanM.mul(glint).mul(sunC).mul(shadow).mul(horizon).mul(fres.mul(0.6).add(0.4)));
    });
    col.addAssign(oceanM.mul(fres).mul(u.atmoCol).mul(twi.add(0.12)).mul(0.22));

    // --- emission: city lights (mode 0) or glowing veins (mode 1) ---
    const night = smoothstep(0.07, -0.16, ndlG);
    const vis = night.add(u.glowDay.mul(float(1).sub(night)));
    const cd = sampleAt(cloudTex, u.rotC.mul(N0), lod.add(1)).x.mul(u.cloudAmt);
    const em = float(0).toVar();
    If(u.glowAmt.greaterThan(0.001), () => {
      If(u.glowMode.lessThan(0.5), () => {
        const cl = fbm(d.mul(8).add(vec3(7, 7, 7)), 4).mul(1.6).add(0.35);
        const dens = smoothstep(0.42, 0.78, cl);
        const low = smoothstep(0.9, 0.2, t);
        const res = clamp(fpx.mul(260), 0, 1);
        const spots = gnoise(d.mul(120)).mul(0.5).add(0.5);
        const fine = gnoise(d.mul(260)).mul(0.5).add(0.5);
        const pts = smoothstep(0.58, 0.88, spots.mul(0.65).add(mix(fine, 0.5, res).mul(0.55)));
        const glow = smoothstep(0.35, 0.8, spots);
        em.assign(dens.mul(low).mul(pts.mul(0.9).add(glow.mul(0.18))).mul(float(1).sub(iceM)));
      }).Else(() => {
        const w = vec3(gnoise(d.mul(2.5)), gnoise(d.mul(2.5).add(vec3(3, 3, 3))), gnoise(d.mul(2.5).add(vec3(6, 6, 6))));
        const th = fpx.mul(4).add(0.022);
        const v1 = smoothstep(th, 0, abs(gnoise(d.mul(4.2).add(w.mul(1.4)))));
        const v2 = smoothstep(th, 0, abs(gnoise(d.mul(9).add(w)))).mul(0.35);
        const basin = smoothstep(0.75, 0.05, t); // veins pool in the low ground
        em.assign(v1.add(v2).mul(basin.mul(1.1).add(0.15)).mul(float(1).sub(iceM.mul(0.5))));
      });
    });
    col.addAssign(em.mul(u.glowCol).mul(u.glowAmt).mul(vis).mul(landM).mul(float(1).sub(cd.mul(0.85))));

    return vec4(tonemap(col.mul(u.fade)), 1);
  })();
  return m;
};

export const createCloudMaterial = (u: Uniforms, cloudTex: Texture) => {
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.fragmentNode = Fn(() => {
    const N0 = normalize(positionLocal);
    const L = normalize(u.sunL);
    const lod = lodFor(N0, u.cloudW);
    const c = sampleAt(cloudTex, u.rotC.mul(N0), lod).toVar();
    const dens = c.x.mul(u.cloudAmt);
    const { T, B } = tangentFrame(N0);
    const n = normalize(N0.sub(T.mul(c.y).add(B.mul(c.z)).mul(u.cloudAmt.mul(0.16))));
    const ndlG = dot(N0, L);
    const lit = max(dot(n, L).add(0.18).div(1.18), 0).mul(smoothstep(-0.04, 0.1, ndlG));
    const thick = float(1).sub(smoothstep(0.2, 1, dens)).mul(0.38).add(0.62);
    const twi = smoothstep(-0.28, 0.35, ndlG);
    const col = u.cloudTint.mul(sunColor(ndlG, u)).mul(SUN).mul(lit).mul(thick)
      .add(u.atmoCol.mul(twi.mul(0.9).add(0.1)).mul(0.14))
      .add(vec3(0.003, 0.004, 0.0075));
    const alpha = smoothstep(0, 0.6, dens).mul(0.93).mul(u.fade);
    If(dens.lessThan(0.003), () => Discard());
    return vec4(tonemap(col), alpha);
  })();
  return m;
};

export const createRingMaterial = (u: Uniforms) => {
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.side = DoubleSide;
  m.fragmentNode = Fn(() => {
    const { alpha, b1 } = ringAlpha(u, length(positionLocal.xz));

    // the planet shadows its own rings
    const L = normalize(u.sunL);
    const bb = dot(positionLocal, L);
    const hh = bb.mul(bb).sub(dot(positionLocal, positionLocal).sub(1));
    const sh = select(bb.lessThan(0), mix(float(1), float(0.05), smoothstep(0, 0.05, hh)), float(1));
    const base = mix(u.ringA, u.ringB, b1);
    const col = base.mul(u.sunCol).mul(SUN * 0.85).mul(sh).add(base.mul(0.02));
    If(alpha.lessThan(0.004), () => Discard());
    return vec4(tonemap(col.mul(u.fade)), alpha.mul(u.fade));
  })();
  return m;
};
