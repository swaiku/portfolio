import {
  Fn, If, clamp, dFdx, dFdy, dot, float, floor, fract, length, max, mix, mx_cell_noise_float, normalize, positionLocal, pow, screenCoordinate, sin,
  smoothstep, texture, vec2, vec3, vec4,
} from 'three/tsl';
import { BackSide, NodeMaterial } from 'three/webgpu';
import type { Node, Texture } from 'three/webgpu';
import type { Uniforms } from '../uniforms';
import { dirToUv } from './common';

const rand = (cell: Node, salt: number) => mx_cell_noise_float(cell.add(vec3(salt, salt * 1.7, salt * 2.3)));

/**
 * One layer of procedural stars: a jittered point per grid cell on the sphere, sized to the pixel footprint.
 * Most cells are empty, so the rest of the work only runs where a star exists (whole cells branch together).
 */
const starLayer = (dir: Node, footprint: Node, clock: Node, seed: Node, scale: number, density: number, salt: number) => {
  const p = dir.mul(scale).add(seed.mul(7.31)); // the world's seed shifts the grid, so every world gets its own star field
  const cell = floor(p).toVar();
  const out = vec3(0).toVar();
  If(rand(cell, salt).greaterThanEqual(1 - density), () => {
    const f = fract(p);
    const centre = vec3(rand(cell, salt + 1), rand(cell, salt + 2), rand(cell, salt + 3)).mul(0.7).add(0.15);
    const radius = max(footprint.mul(scale).mul(1.65), 0.045);
    const core = smoothstep(radius, 0, length(f.sub(centre)));
    const luma = pow(rand(cell, salt + 4), 5).mul(1.6).add(0.25);
    const tint = mix(vec3(0.72, 0.85, 1), vec3(1, 0.82, 0.62), rand(cell, salt + 5));
    const twinkle = sin(clock.mul(rand(cell, salt + 6).mul(1.4).add(0.6)).add(rand(cell, salt + 7).mul(40))).mul(0.18).add(0.82);
    out.assign(tint.mul(core).mul(luma).mul(twinkle));
  });
  return out;
};

/** Nebula + stars along a direction. Shared by the dome and by the black hole's lensed view of it. */
export const skyColor = (skyTex: Texture, clock: Node, seed: Node, dir: Node, footprint: Node, starGain: Node = float(1)): Node => {
  const nebula = texture(skyTex, dirToUv(dir)).level(0).rgb;
  // footprint and gain may hold screen-space derivatives: evaluate them here, before the per-cell branches, where every
  // pixel still runs the same code (inside a branch, derivatives across cell edges are garbage and draw grid lines)
  const fp = footprint.toVar();
  const gain = starGain.toVar();
  const stars = starLayer(dir, fp, clock, seed, 70, 0.15, 11)
    .add(starLayer(dir, fp, clock, seed, 150, 0.21, 31))
    .add(starLayer(dir, fp, clock, seed, 320, 0.27, 53));
  return nebula.add(stars.mul(gain));
};

/** Backdrop dome, drawn after the opaque bodies and behind them, so covered pixels cost nothing. */
export const createSkyMaterial = (skyTex: Texture, u: Uniforms) => {
  const m = new NodeMaterial();
  m.side = BackSide;
  m.depthWrite = false;
  m.fragmentNode = Fn(() => {
    const dir = normalize(positionLocal);
    const footprint = max(length(dFdx(dir)), length(dFdy(dir)));
    // interleaved gradient noise on the pixel grid, about one sRGB step of the dark sky (the transfer is applied after this).
    // Keyed on the direction it drew curved bands: a hash of one linear function of dir repeats along great circles.
    const dither = fract(fract(dot(screenCoordinate, vec2(0.06711056, 0.00583715))).mul(52.9829189)).sub(0.5).mul(0.0006);
    return vec4(clamp(skyColor(skyTex, u.clock, u.sky.seed, dir, footprint).add(dither), 0, 4), 1);
  })();
  return m;
};
