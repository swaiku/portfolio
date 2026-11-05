import {
  ClampToEdgeWrapping, FloatType, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Mesh, NearestFilter,
  OrthographicCamera, PlaneGeometry, RGBAFormat, RenderTarget, RepeatWrapping, Scene,
} from 'three/webgpu';
import { float } from 'three/tsl';
import type { NodeMaterial, WebGPURenderer } from 'three/webgpu';
import { randomSeed, rollWorld, type RollArgs, type World } from './archetypes';
import { applyWorld, type Uniforms, type WorldLook } from './uniforms';
import { createOpticalDepthBake, OPTICS_H, OPTICS_W } from './tsl/atmosphere';
import {
  createCloudDensityBake, createNebulaBake, createSkyBake, createSlopePass, createTerrainHeightBake, NEBULA_ASPECT, strip, terrainMoisture,
} from './tsl/bake';

interface Pass { material: NodeMaterial; target: RenderTarget; strips: number }

const makeTarget = (w: number, h: number, kind: 'color' | 'color-nomip' | 'float') =>
  new RenderTarget(w, h, {
    type: kind === 'float' ? FloatType : HalfFloatType,
    format: RGBAFormat,
    minFilter: kind === 'color' ? LinearMipmapLinearFilter : kind === 'float' ? NearestFilter : LinearFilter,
    magFilter: kind === 'float' ? NearestFilter : LinearFilter,
    wrapS: RepeatWrapping,
    wrapT: ClampToEdgeWrapping,
    generateMipmaps: kind === 'color',
    depthBuffer: false,
  });

/** Runs fullscreen passes into equirect targets, one strip per call, so no frame stalls on the GPU. */
class Bake {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: Mesh;
  private pass = 0;
  private next = 0;
  done = false;

  constructor(private readonly renderer: WebGPURenderer, private readonly passes: Pass[]) {
    this.quad = new Mesh(new PlaneGeometry(2, 2), passes[0].material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** The last pass holds the finished texture. */
  get target() {
    return this.passes[this.passes.length - 1].target;
  }

  /** Share of this bake's strips already drawn, 0 → 1. */
  get progress() {
    if (this.done) return 1;
    const total = this.passes.reduce((n, p) => n + p.strips, 0);
    const before = this.passes.slice(0, this.pass).reduce((n, p) => n + p.strips, 0);
    return (before + this.next) / total;
  }

  restart() {
    this.pass = 0;
    this.next = 0;
    this.done = false;
  }

  step() {
    if (this.done) return;
    const p = this.passes[this.pass];
    this.quad.material = p.material;
    strip.index.value = this.next;
    strip.count.value = p.strips;
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = this.next === 0; // clear once per pass, or each strip would wipe the previous ones
    this.renderer.setRenderTarget(p.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.autoClear = autoClear;
    if (++this.next < p.strips) return;
    this.next = 0;
    if (++this.pass >= this.passes.length) {
      this.done = true;
      this.pass = 0;
      // the float intermediates are only needed while baking; free them until the next reseed
      this.passes.slice(0, -1).forEach((q) => q.target.dispose());
    }
  }

  dispose() {
    this.passes.forEach((p) => p.target.dispose());
  }
}

export type Phase = 'sky' | 'nebula' | 'planet' | 'clouds' | 'fadein' | 'live' | 'fadeout';

/** Owns the baked textures and the life cycle of the current world: bake → fade in → live → fade out → next world. */
export class WorldBaker {
  readonly sky: Bake;
  readonly planet: Bake;
  readonly clouds: Bake;
  readonly nebula: Bake;
  /** Atmosphere lookup table: the same for every world, so it is baked once and never restarted. */
  readonly optics: Bake;
  phase: Phase = 'sky';
  fade = 0;
  world: World;
  look: WorldLook;
  private pending: World | null = null;
  private pendingArgs: RollArgs | null = null;
  private args: RollArgs;
  private readonly reduced: boolean;

  constructor(
    renderer: WebGPURenderer,
    private readonly u: Uniforms,
    private readonly onWorld: (w: World, look: WorldLook, args: RollArgs) => void,
    opts: { texture: number; reduced: boolean; restore?: RollArgs; boost?: Record<string, number> },
  ) {
    const params = new URLSearchParams(location.search);
    const seed = parseInt(params.get('planet') ?? '', 16);
    const kind = params.get('kind') ?? undefined;
    // a reload brings the saved world back; only the reseed button rolls a new one
    this.args = Number.isFinite(seed) ? { seed, kind } : kind ? { seed: randomSeed(), kind } : (opts.restore ?? { seed: randomSeed(), boost: opts.boost });
    this.world = this.roll(this.args);
    this.reduced = opts.reduced;

    const size = Number(params.get('bake')) || opts.texture; // ?bake=1024 is a dev knob for slow GPUs
    const cloudSize = Math.min(size, 2048);
    u.texW.value = size;
    u.cloudW.value = cloudSize;
    this.sky = new Bake(renderer, [
      { material: createSkyBake(u.sky), target: makeTarget(2048, 1024, 'color-nomip'), strips: 4 },
    ]);

    // two passes each: the expensive noise once into float32, then a cheap pass that derives slopes from neighbours
    const heights = makeTarget(size, size / 2, 'float');
    this.planet = new Bake(renderer, [
      { material: createTerrainHeightBake(u.terrain), target: heights, strips: size >= 4096 ? 32 : 16 },
      {
        material: createSlopePass(heights.texture, size, size / 2, terrainMoisture(u.terrain)),
        target: makeTarget(size, size / 2, 'color'),
        strips: 8,
      },
    ]);
    const density = makeTarget(cloudSize, cloudSize / 2, 'float');
    this.clouds = new Bake(renderer, [
      { material: createCloudDensityBake(u.terrain.seed), target: density, strips: 16 },
      {
        material: createSlopePass(density.texture, cloudSize, cloudSize / 2, () => float(1)),
        target: makeTarget(cloudSize, cloudSize / 2, 'color'),
        strips: 8,
      },
    ]);
    const nebulaW = Math.min(size, 1536);
    this.nebula = new Bake(renderer, [
      { material: createNebulaBake(u), target: makeTarget(nebulaW, Math.round(nebulaW / NEBULA_ASPECT / 2) * 2, 'color-nomip'), strips: 32 },
    ]);
    this.optics = new Bake(renderer, [{
      material: createOpticalDepthBake(),
      target: new RenderTarget(OPTICS_W, OPTICS_H, {
        type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter,
        wrapS: ClampToEdgeWrapping, wrapT: ClampToEdgeWrapping, generateMipmaps: false, depthBuffer: false,
      }),
      strips: 1,
    }]);
    this.look = applyWorld(u, this.world);
    onWorld(this.world, this.look, this.args);
  }

  /** True once every texture the world samples has been baked: drawing before then reads mip levels nothing has written yet. */
  get baked() {
    return this.phase === 'fadein' || this.phase === 'live' || this.phase === 'fadeout';
  }

  get state(): 'BOOT' | 'SURVEY' | 'LOCKED' {
    if (this.phase === 'live') return 'LOCKED';
    return this.phase === 'fadein' ? 'SURVEY' : 'BOOT';
  }

  /** How far the current world is from being drawn, 0 → 1; the bakes weigh in roughly as long as they take. */
  get progress() {
    const flat = this.look.kind !== 'planet' && this.look.kind !== 'nebula'; // stars and holes bake only the sky
    switch (this.phase) {
      case 'sky': return this.sky.progress * (flat ? 0.9 : 0.08);
      case 'nebula': return 0.08 + this.nebula.progress * 0.82;
      case 'planet': return 0.08 + this.planet.progress * 0.62;
      case 'clouds': return 0.7 + this.clouds.progress * 0.2;
      case 'fadein': return 0.9 + this.fade * 0.1;
      default: return 1;
    }
  }

  step(dt: number) {
    if (!this.optics.done) this.optics.step();
    switch (this.phase) {
      case 'sky': this.sky.step(); if (this.sky.done) this.phase = this.look.kind === 'planet' ? 'planet' : this.look.kind === 'nebula' ? 'nebula' : 'fadein'; break;
      case 'nebula': this.nebula.step(); if (this.nebula.done) this.phase = 'fadein'; break;
      case 'planet': this.planet.step(); if (this.planet.done) this.phase = 'clouds'; break;
      case 'clouds': this.clouds.step(); if (this.clouds.done) this.phase = 'fadein'; break;
      case 'fadein':
        this.fade = Math.min(1, this.fade + dt / (this.reduced ? 0.2 : 1.8));
        if (this.fade >= 1) this.phase = 'live';
        break;
      case 'fadeout':
        this.fade = Math.max(0, this.fade - dt / 0.5);
        if (this.fade <= 0 && this.pending) {
          this.world = this.pending;
          this.pending = null;
          this.look = applyWorld(this.u, this.world);
          this.args = this.pendingArgs!;
          this.onWorld(this.world, this.look, this.args);
          this.sky.restart(); this.planet.restart(); this.clouds.restart(); this.nebula.restart();
          this.phase = 'sky';
        }
        break;
    }
    this.u.fade.value = this.fade * this.fade * (3 - 2 * this.fade);
  }

  private roll = (a: RollArgs) => rollWorld(a.seed, a.kind, a.avoid, a.hue, a.boost);

  /** `kind` forces a type (a probe), `boost` tilts the odds toward types not yet seen. */
  reseed(kind?: string, boost?: Record<string, number>, replay?: RollArgs) {
    if (this.phase !== 'live') return;
    this.pendingArgs = replay ?? { seed: randomSeed(), kind, avoid: this.world.tpl.id, hue: this.world.hue, boost };
    this.pending = this.roll(this.pendingArgs);
    this.phase = 'fadeout';
  }

  /** Bakes the current world again from the (possibly hand-edited) uniforms. */
  rebake() {
    if (this.phase !== 'live') return;
    this.fade = 0;
    this.sky.restart(); this.planet.restart(); this.clouds.restart(); this.nebula.restart();
    this.phase = 'sky';
  }

  dispose() {
    [this.sky, this.planet, this.clouds, this.nebula, this.optics].forEach((b) => b.dispose());
  }
}
