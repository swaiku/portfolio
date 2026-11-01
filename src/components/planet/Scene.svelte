<script lang="ts">
  import { onMount } from 'svelte';
  import { T, useTask, useThrelte } from '@threlte/core/webgpu';
  import { Euler, Matrix3, Matrix4, MathUtils, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu';
  import type { Group, Mesh } from 'three/webgpu';
  import { WorldBaker } from '../../lib/planet/baker';
  import { trackStages } from '../../lib/planet/stages';
  import { sim } from '../../lib/planet/sim.svelte';
  import { describe } from '../../lib/planet/facts';
  import { createSkyMaterial } from '../../lib/planet/tsl/sky';
  import { createAtmosphereMaterial } from '../../lib/planet/tsl/atmosphere';
  import { createCloudMaterial, createPlanetMaterial, createRingMaterial } from '../../lib/planet/tsl/surface';
  import type { World } from '../../lib/planet/archetypes';
  import type { Uniforms, WorldLook } from '../../lib/planet/uniforms';
  import { createCoronaMaterial, createStarMaterial } from '../../lib/planet/tsl/star';
  import { createHoleMaterial } from '../../lib/planet/tsl/hole';
  import { createNebulaMaterial } from '../../lib/planet/tsl/space';
  import Globe from './Globe.svelte';

  const FOV = 30;
  const CAMERA_Z = 10;
  const SUN = new Vector3(-0.92, 0.3, 0.18).normalize();

  const { renderer, size, advance } = useThrelte();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  let { u }: { u: Uniforms } = $props();
  let look = $state<WorldLook>({ kind: 'planet', clouds: false, ring: false, sizeK: 1, size: 1, shiftX: 0, tilt: [0.3, -0.4], moons: [], belt: null, binary: false, jets: false, beamTilt: 0.8, spin: 4.6, period: 1, companion: null, body: 1 });

  const announce = (w: World) => {
    document.documentElement.style.setProperty('--color-amber', w.accent);
    const detail = { name: w.name, kind: w.type.label, rarity: w.type.rarity, accent: w.accent, seed: w.seed.toString(16).toUpperCase().padStart(6, '0') };
    (window as unknown as { __planet?: unknown }).__planet = detail;
    dispatchEvent(new CustomEvent('planet:info', { detail }));
    sim.name = detail.name;
    sim.kind = detail.kind;
    sim.rarity = detail.rarity;
    sim.seed = detail.seed;
    const traits = [
      w.ring ? 'ringed' : '',
      w.moons.length ? `${w.moons.length} moon${w.moons.length > 1 ? 's' : ''}` : '',
      w.belt ? 'asteroid belt' : '',
    ].filter(Boolean);
    sim.traits = traits.join(', ');
    sim.facts = describe(w);
  };

  let group = $state<Group>();
  let baked = $state(false);
  let dome = $state<Mesh>();

  const baker = new WorldBaker(
    renderer,
    u,
    (w, l) => {
      look = l;
      announce(w);
    },
    { texture: coarse ? 2048 : 4096, reduced },
  );

  const materials = {
    planet: createPlanetMaterial(u, baker.planet.target.texture, baker.clouds.target.texture),
    clouds: createCloudMaterial(u, baker.clouds.target.texture),
    atmosphere: createAtmosphereMaterial(u, baker.optics.target.texture),
    ring: createRingMaterial(u),
    star: createStarMaterial(u),
    corona: createCoronaMaterial(u, { center: u.primaryAt, scale: u.primaryScale, occluder: { center: u.companionAt, radius: u.companionR } }),
    hole: createHoleMaterial(u, baker.sky.target.texture),
    nebula: createNebulaMaterial(u, baker.nebula.target.texture),
  };
  const skyMaterial = createSkyMaterial(baker.sky.target.texture, u);
  const domeGeometry = new SphereGeometry(80, 48, 32);

  const stages = trackStages();
  const cur = { x: 0.5, y: 0, s: 0.9 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  // the scene only moves slowly on its own, so it renders at 30 fps when nobody is interacting and at 60 fps otherwise
  let lastInput = -Infinity;
  const poke = () => (lastInput = performance.now());
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
    poke();
  };

  // frame governor: caps the frame rate instead of rendering at the screen's refresh rate
  let sinceRender = 0;
  const govern = (dt: number) => {
    const now = performance.now();
    const active = now - lastInput < 2500 || baker.phase === 'fadein' || baker.phase === 'fadeout';
    const interval = active ? 1 / 60 : 1 / 30;
    sinceRender += dt;
    if (sinceRender < interval - 0.002) return;
    sinceRender = Math.min(Math.max(sinceRender - interval, 0), interval);
    advance();
  };

  let angle = 0;
  let spin = 0;
  let drift = 0;
  let acc = 0;
  const rotateY = (m: Matrix3, a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    m.set(c, 0, s, 0, 1, 0, -s, 0, c);
  };
  const sunLocal = new Vector3();
  const cameraLocal = new Vector3();
  const inverseTilt = new Quaternion();
  const tiltEuler = new Euler();
  const toSky = new Matrix4();
  const lerp = MathUtils.lerp;

  // solar storm: every so often a loop rises from the limb, swells and falls back; calmer stars wait longer between them
  const flareView = new Vector3();
  const flareSide = new Vector3();
  const storm = { wait: 4, t: -1 };
  const stepStorm = (dt: number) => {
    const live = look.kind === 'star' && !look.jets && !reduced && baked;
    if (!live) {
      u.flare.value = 0;
      storm.t = -1;
      return;
    }
    if (storm.t < 0) {
      storm.wait -= dt;
      if (storm.wait > 0) return;
      // rise from a random point of the limb: perpendicular to the line of sight, so the loop is seen in profile
      flareView.copy(u.camL.value).sub(u.primaryAt.value).normalize();
      flareSide.set(0, 1, 0).cross(flareView).normalize();
      const a = Math.random() * Math.PI * 2;
      u.flareDir.value.copy(flareSide).multiplyScalar(Math.cos(a)).addScaledVector(flareView.cross(flareSide), Math.sin(a)).normalize();
      // from a small puff to a big eruption, a few of them huge
      u.flareSize.value = 0.45 + Math.random() ** 1.6 * 0.95;
      storm.t = 0;
      return;
    }
    storm.t += dt;
    const dur = 6 + u.flareAmt.value * u.flareSize.value * 6;
    const p = storm.t / dur;
    if (p >= 1) {
      u.flare.value = 0;
      storm.t = -1;
      // a furious star erupts again almost at once, a dormant one waits half a minute or more
      storm.wait = MathUtils.lerp(40, 1.5, u.flareRate.value) * (0.6 + Math.random() * 0.8);
      return;
    }
    u.flareProg.value = p;
    u.flare.value = MathUtils.smoothstep(p, 0, 0.1) * (1 - MathUtils.smoothstep(p, 0.5, 1));
  };
  const side = (x: number) => MathUtils.smoothstep(Math.abs(x), 0.15, 0.45);

  useTask((dt) => {
    dt = Math.min(dt, 0.1);
    govern(dt);
    baker.step(dt);
    if (baker.baked !== baked) baked = baker.baked;

    // the pose is already scrubbed along the scroll by GSAP; a quick follow only irons out frame-to-frame noise
    const ease = reduced ? 1 : 1 - Math.exp(-dt * 14);
    cur.x += (stages.target.x - cur.x) * ease;
    cur.y += (stages.target.y - cur.y) * ease;
    cur.s += (stages.target.s - cur.s) * ease;
    const follow = 1 - Math.exp(-dt * 3);
    pointer.x += (pointer.tx - pointer.x) * follow;
    pointer.y += (pointer.ty - pointer.y) * follow;

    const halfH = Math.tan(MathUtils.degToRad(FOV / 2)) * CAMERA_Z;
    const halfW = halfH * (size.current.width / size.current.height);
    // rings and coronas need room when the body sits to one side; centred, it can fill the frame
    const aside = side(cur.x);
    let scale = cur.s;
    let y = cur.y;
    if (look.kind === 'hole') {
      scale = Math.min(cur.s, 1.1) * look.sizeK;
      y = Math.max(cur.y, -0.55);
    } else scale = cur.s * lerp(1, look.sizeK, aside);
    const radius = scale * look.size * Math.min(halfH, halfW);

    if (group) {
      group.rotation.set(look.tilt[0] + pointer.y * 0.03, 0, look.tilt[1]);
      group.position.set((cur.x + look.shiftX * aside * Math.sign(cur.x)) * halfW + pointer.x * 0.06, y * halfH - pointer.y * 0.04, 0);
      group.scale.setScalar(radius);
      group.updateMatrixWorld();
      group.worldToLocal(cameraLocal.set(0, 0, CAMERA_Z));
      inverseTilt.copy(group.quaternion).invert();
      sunLocal.copy(SUN).applyQuaternion(inverseTilt);
      u.camL.value.copy(cameraLocal);
      u.sunL.value.copy(sunLocal);
      if (look.kind === 'hole' && dome) {
        // lensed rays leave in the hole's frame; the sky lives in the dome's frame
        toSky.makeRotationFromQuaternion(dome.quaternion.clone().invert().multiply(group.quaternion));
        u.holeToSky.value.setFromMatrix4(toSky);
      }
    }

    angle += reduced ? 0 : dt * 0.022;
    spin += (stages.state.scroll * 2.2 - spin) * (reduced ? 1 : 1 - Math.exp(-dt * 1.6));
    drift += reduced ? 0 : dt * 0.0035;
    if (!reduced) u.clock.value += dt;
    stepStorm(dt);
    // a pulsar's surface is carried round with its beams: same axis, same rate (rotateY turns the sampling frame, hence the sign)
    if (look.jets) {
      rotateY(u.rotP.value, -u.clock.value * look.spin);
    } else rotateY(u.rotP.value, angle + spin);
    rotateY(u.rotC.value, angle + spin + drift);

    if (dome) {
      dome.rotation.y = stages.state.scroll * 0.5;
      dome.rotation.x = stages.state.scroll * 0.12;
    }

    acc += dt;
    if (acc > 0.4) {
      acc = 0;
      sim.state = baker.state;
      sim.phase = baker.phase;
      sim.progress = baker.progress;
    }
  });

  const reseed = () => baker.reseed();
  onMount(() => {
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', poke, { passive: true });
    addEventListener('wheel', poke, { passive: true });
    addEventListener('touchmove', poke, { passive: true });
    addEventListener('planet:reseed', reseed);
    stages.refresh();
    return () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', poke);
      removeEventListener('wheel', poke);
      removeEventListener('touchmove', poke);
      removeEventListener('planet:reseed', reseed);
      stages.dispose();
      baker.dispose();
    };
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, CAMERA_Z]} fov={FOV} near={0.1} far={200} />
<!-- drawn after the opaque bodies, so the depth test skips every sky pixel they cover -->
<T.Mesh bind:ref={dome} geometry={domeGeometry} material={skyMaterial} renderOrder={10} frustumCulled={false} />
<Globe bind:group {look} {u} {materials} {baked} />
