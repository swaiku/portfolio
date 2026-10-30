import {
  clamp, cos, float, fract, hash, instanceIndex, length, mix, pow, sin, smoothstep, uv, vec2, vec3,
} from 'three/tsl';
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import type { Uniforms } from '../uniforms';

export const TAIL_LENGTH = 5;

const TAU = Math.PI * 2;

/** One reproducible random number per particle: `k` picks the channel. */
const rnd = (k: number): Node => hash(instanceIndex.add(k * 7919 + 13));

interface Particle {
  position: Node;
  size: Node;
  color: Node;
  alpha: Node;
}

/**
 * A GPU particle cloud: no buffers, each instance derives everything from its index and the clock in the vertex stage.
 * Sprites face the camera; their size is in planet radii because the sprite sits inside the planet's scaled group.
 */
const particles = (u: Uniforms, count: number, build: () => Particle): Sprite => {
  const m = new SpriteNodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = false;
  m.blending = AdditiveBlending;
  const p = build();
  m.positionNode = p.position;
  m.scaleNode = vec2(p.size, p.size);
  const soft = pow(clamp(float(1).sub(length(uv().sub(0.5)).mul(2)), 0, 1), 2);
  m.colorNode = p.color;
  m.opacityNode = soft.mul(p.alpha).mul(u.fade);
  const sprite = new Sprite(m);
  sprite.count = count;
  sprite.frustumCulled = false;
  return sprite;
};

/**
 * A comet's tail, in a frame where it streams along +Y (the caller points it away from the sun). Two populations:
 * a narrow straight ion tail, and a wider dust tail that bends to one side.
 */
export const createTailParticles = (u: Uniforms) =>
  particles(u, 6000, () => {
    const age = fract(rnd(1).add(u.clock.mul(rnd(5).mul(0.05).add(0.05))));
    const ion = float(1).sub(smoothstep(0.28, 0.3, rnd(2)));
    const spread = mix(age.mul(0.6).add(0.05), age.mul(0.1).add(0.02), ion);
    const radius = pow(rnd(4), 0.6).mul(spread);
    const angle = rnd(3).mul(TAU);
    const bend = age.mul(age).mul(0.7).mul(float(1).sub(ion));
    const position = vec3(cos(angle).mul(radius).add(bend), age.mul(TAIL_LENGTH), sin(angle).mul(radius));
    const alpha = pow(float(1).sub(age), 1.6).mul(rnd(2).mul(0.6).add(0.4)).mul(mix(0.55, 0.9, ion));
    return {
      position,
      size: mix(age.mul(0.07).add(0.035), age.mul(0.02).add(0.03), ion),
      color: mix(u.ramp[2].mul(1.6), u.ramp[4], ion),
      alpha,
    };
  });
