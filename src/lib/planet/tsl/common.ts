import {
  abs, asin, atan, clamp, cos, dFdx, dFdy, dot, float, length, log2, max, mix, mx_noise_float, mx_worley_noise_float, sin, smoothstep,
  vec2, vec3,
} from 'three/tsl';
import type { Node } from 'three/webgpu';

export const PI = Math.PI;

/** Perlin noise remapped to roughly ±0.6, the amplitude every constant below was tuned against. */
export const gnoise = (p: Node): Node => mx_noise_float(p).mul(0.6);

export const fbm = (p0: Node, octaves: number): Node => {
  let p = p0;
  let amp = 0.5;
  let sum: Node = float(0);
  for (let i = 0; i < octaves; i++) {
    sum = sum.add(gnoise(p).mul(amp));
    p = p.mul(2.03).add(vec3(1.7, 9.2, 3.1));
    amp *= 0.5;
  }
  return sum;
};

export const sq = (x: Node): Node => x.mul(x); // pow() of a negative base is undefined on some GPUs

/** Distance to the nearest point of a jittered grid: 0 on a point, about 1 at most. Craters, storm ovals. */
export const worley = (p: Node): Node => mx_worley_noise_float(p);

/** Ridged multifractal: sharp crests whose own height feeds the next octave, so ridges branch into chains instead of worms. */
export const ridged = (p0: Node, octaves: number): Node => {
  let p = p0;
  let amp = 0.5;
  let weight: Node = float(1);
  let sum: Node = float(0);
  for (let i = 0; i < octaves; i++) {
    const n = clamp(float(1).sub(abs(gnoise(p)).mul(2.2)), 0, 1);
    const crest = n.mul(n);
    sum = sum.add(crest.mul(weight).mul(amp));
    weight = clamp(crest.mul(1.8), 0, 1);
    p = p.mul(2.11).add(vec3(3.3, 7.1, 1.9));
    amp *= 0.5;
  }
  return sum;
};

/** Pulls a colour toward its own grey: `k` = 1 keeps it, 0 is fully grey. */
export const mute = (c: Node, k: number): Node => mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, k);

/** Where the sun is, in world space; the camera never turns, so this is also its direction in view space. */
export const SUN_DIR = [-0.92, 0.3, 0.18] as const;

/** Equirectangular uv → unit direction. */
export const dirFromUv = (uv: Node): Node => {
  const lon = uv.x.sub(0.5).mul(2 * PI);
  const lat = uv.y.sub(0.5).mul(PI);
  return vec3(cos(lat).mul(sin(lon)), sin(lat), cos(lat).mul(cos(lon)));
};

export const dirToUv = (d: Node): Node =>
  vec2(atan(d.x, d.z).div(2 * PI).add(0.5), asin(clamp(d.y, -1, 1)).div(PI).add(0.5));

/** Narkowicz ACES. Output stays linear: the renderer applies the sRGB transfer once. */
export const tonemap = (x: Node): Node => {
  const v = x.mul(0.95);
  return clamp(v.mul(v.mul(2.51).add(0.03)).div(v.mul(v.mul(2.43).add(0.59)).add(0.14)), 0, 1);
};

/** Mip level that matches the on-screen footprint of a unit-sphere direction. */
export const lodFor = (n: Node, texWidth: Node): Node => {
  const fp = max(length(dFdx(n)), length(dFdy(n)));
  return max(log2(fp.mul(texWidth).div(2 * PI)).sub(0.5), 0);
};

/** Five-stop colour ramp, `t` in 0..1. */
export const rampColor = (ramp: Node[], t: Node): Node => {
  const t4 = clamp(t, 0, 1).mul(4);
  let c = mix(ramp[0], ramp[1], smoothstep(0, 1, t4));
  for (let i = 2; i < 5; i++) c = mix(c, ramp[i], smoothstep(i - 1, i, t4));
  return c;
};
