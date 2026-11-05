<script lang="ts">
  import { onMount } from 'svelte';
  import { T, useTask, useThrelte } from '@threlte/core/webgpu';
  import { Euler, Matrix3, Matrix4, MathUtils, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu';
  import type { Group, Mesh } from 'three/webgpu';
  import { WorldBaker } from '../../lib/planet/baker';
  import { trackStages } from '../../lib/planet/stages';
  import { sim } from '../../lib/planet/sim.svelte';
  import { BAKE, quality } from '../../lib/planet/quality.svelte';
  import { describe } from '../../lib/planet/facts';
  import { atlas, COOLDOWN, keepThumb, markLocked, noteWorld, wantsThumb } from '../../lib/atlas.svelte';
  import { stage } from '../../lib/interactions';
  import { createSkyMaterial } from '../../lib/planet/tsl/sky';
  import { createAtmosphereMaterial } from '../../lib/planet/tsl/atmosphere';
  import { createCloudMaterial, createPlanetMaterial, createRingMaterial } from '../../lib/planet/tsl/surface';
  import type { RollArgs, World } from '../../lib/planet/archetypes';
  import type { Uniforms, WorldLook } from '../../lib/planet/uniforms';
  import { createCoronaMaterial, createStarMaterial } from '../../lib/planet/tsl/star';
  import { createHoleMaterial } from '../../lib/planet/tsl/hole';
  import { createNebulaMaterial } from '../../lib/planet/tsl/space';
  import Globe from './Globe.svelte';

  let lockedAt = 0;
  const FOV = 30;
  const CAMERA_Z = 10;
  const SUN = new Vector3(-0.92, 0.3, 0.18).normalize();

  const { renderer, scene, camera, size, advance } = useThrelte();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  let { u }: { u: Uniforms } = $props();
  let look = $state<WorldLook>({ kind: 'planet', clouds: false, ring: false, sizeK: 1, size: 1, shiftX: 0, tilt: [0.3, -0.4], moons: [], belt: null, binary: false, jets: false, beamTilt: 0.8, spin: 4.6, period: 1, companion: null, body: 1 });

  // the first world is the saved one when there is one: a reload never rerolls
  let first = true;
  let replaying = false; // bringing back a world already seen: no effect on the odds
  const announce = (w: World, args: RollArgs) => {
    document.documentElement.style.setProperty('--color-amber', w.accent);
    const detail = { name: w.name, kind: w.type.label, family: w.kind, ring: !!w.ring, rarity: w.type.rarity, accent: w.accent, seed: w.seed.toString(16).toUpperCase().padStart(6, '0') };
    (window as unknown as { __planet?: unknown }).__planet = detail;
    dispatchEvent(new CustomEvent('planet:info', { detail }));
    sim.name = detail.name;
    sim.kind = detail.kind;
    sim.rarity = detail.rarity;
    sim.seed = detail.seed;
    sim.family = w.kind;
    sim.typeId = w.type.id;
    sim.args = args;
    const traits = [
      w.ring ? 'ringed' : '',
      w.moons.length ? `${w.moons.length} moon${w.moons.length > 1 ? 's' : ''}` : '',
      w.belt ? 'asteroid belt' : '',
    ].filter(Boolean);
    sim.traits = traits.join(', ');
    sim.facts = describe(w);
    noteWorld(w.type.id, detail.seed, !(first && restored) && !replaying, args, {
      variant: w.tpl.id, rarity: w.type.rarity, ring: !!w.ring, moons: w.moons.length, belt: !!w.belt, binary: !!w.companion,
    });
    first = false;
    replaying = false;
  };

  const restored = !!atlas.last;
  let group = $state<Group>();
  let baked = $state(false);
  let dome = $state<Mesh>();

  const baker = new WorldBaker(
    renderer,
    u,
    (w, l, a) => {
      look = l;
      announce(w, a);
    },
    { texture: BAKE[quality.tier], reduced, restore: atlas.last },
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

  // frame governor: caps the frame rate instead of rendering at the screen's refresh rate, and lowers the
  // resolution a notch whenever frames keep arriving later than the cap asks (floor: quality.floor)
  let sinceRender = 0;
  let period = 0; // smoothed time between two renders
  let lastRender = 0;
  let settleAt = performance.now() + 4000; // let shaders compile and the bake finish before judging
  const govern = (dt: number) => {
    const now = performance.now();
    const active = now - lastInput < 2500 || baker.phase === 'fadein' || baker.phase === 'fadeout';
    const slow = quality.tier === 'low';
    const interval = active ? (slow ? 1 / 30 : 1 / 60) : slow ? 1 / 20 : 1 / 30;
    sinceRender += dt;
    if (sinceRender < interval - 0.002) return;
    sinceRender = Math.min(Math.max(sinceRender - interval, 0), interval);
    advance();
    if (lastRender && !document.hidden) period += ((now - lastRender) / 1000 - period) * 0.1;
    lastRender = now;
    if (baker.phase !== 'live' || now < settleAt || !period) return;
    if (period > interval * 1.2 && quality.dpr > quality.floor) {
      quality.dpr = Math.max(quality.floor, quality.dpr - 0.25);
      settleAt = now + 3000;
      period = 0;
    }
  };

  let angle = 0;
  let drag = 0;
  let spin = 0;
  let drift = 0;
  let acc = 0;
  const rotateY = (m: Matrix3, a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    m.set(c, 0, s, 0, 1, 0, -s, 0, c);
  };
  const probe = new Vector3();
  const sunLocal = new Vector3();
  const cameraLocal = new Vector3();
  const inverseTilt = new Quaternion();
  const tiltEuler = new Euler();
  const toSky = new Matrix4();

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
  // the atlas keeps a small picture of the first world of each class: one extra frame, drawn and copied in the same
  // task so the canvas still holds it, cropped around the body
  let snapped = false;
  const THUMB = 288; // twice the largest size the atlas shows it at, for sharp screens
  const snap = () => {
    try {
      // the body alone on black: the sky is left out of this one frame
      if (dome) dome.visible = false;
      renderer.render(scene, camera.current);
      const c = renderer.domElement;
      const k = c.width / c.clientWidth;
      const r = stage.r * 2; // the whole body: atmosphere, rings and close moons
      const out = document.createElement('canvas');
      out.width = out.height = THUMB;
      const ctx = out.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(c, (stage.x - r) * k, (stage.y - r) * k, 2 * r * k, 2 * r * k, 0, 0, THUMB, THUMB);
      if (dome) dome.visible = true;
      renderer.render(scene, camera.current); // put the sky back before the frame is shown
      // an all-black read means the frame was already gone: keep no picture rather than a black square
      const px = ctx.getImageData(0, 0, THUMB, THUMB).data;
      let lit = 0;
      for (let i = 0; i < px.length; i += 16) lit += px[i] + px[i + 1] + px[i + 2];
      if (lit < 4000) return;
      keepThumb(atlas.current.id, out.toDataURL('image/webp', 0.9));
    } catch { /* no picture: the atlas shows the class's mark instead */ }
    if (dome) dome.visible = true;
  };

  // tuning away: hand the lens a copy of the frame on screen, at half size, so it can tear it apart (Lens.svelte)
  const grab = (kind?: string) => {
    try {
      renderer.render(scene, camera.current);
      const c = renderer.domElement;
      const out = document.createElement('canvas');
      out.width = Math.round(c.width / 2);
      out.height = Math.round(c.height / 2);
      out.getContext('2d')!.drawImage(c, 0, 0, out.width, out.height);
      dispatchEvent(new CustomEvent('planet:frame', { detail: { frame: out, kind } }));
    } catch { /* no copy: the lens cuts straight to static */ }
  };

  // arriving: the lens pulls focus on the new world, hunting once past it before it settles (global.css, .focus).
  // Once per world: the fade-in can outlast the pull
  let focused = false;
  let focusTimer = 0;
  const stepFocus = () => {
    if (baker.phase !== 'fadein' && baker.phase !== 'live') focused = false;
    // a weak device keeps the plain fade-in: a full-screen animated blur costs it frames while the world is still settling
    if (baker.phase !== 'fadein' || focused || reduced || quality.tier === 'low') return;
    focused = true;
    const root = document.documentElement;
    root.classList.remove('focus');
    void root.offsetWidth; // restart the animation
    root.classList.add('focus');
    clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => root.classList.remove('focus'), 3400);
  };
  const side = (x: number) => MathUtils.smoothstep(Math.abs(x), 0.15, 0.45);

  // nothing is drawn or baked until the shaders are compiled; the lens shows its tuning screen meanwhile (Lens.svelte)
  let compiled = false;
  const precompile = async () => {
    await baker.compile();
    // the world's surface and clouds stay hidden until baked: show them for the compile only, so their first frame is ready too
    const shown: Mesh[] = [];
    group?.traverse((o) => {
      const m = o as Mesh;
      if (look.kind === 'planet' && !m.visible && (m.material === materials.planet || m.material === materials.clouds)) {
        m.visible = true;
        shown.push(m);
      }
    });
    try {
      await renderer.compileAsync(scene, camera.current);
    } finally {
      shown.forEach((m) => (m.visible = false));
    }
  };

  useTask((dt) => {
    if (!compiled) return;
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
    // rings and coronas are sized for the side positions; `aside` only shifts the body clear of the text
    const aside = side(cur.x);
    let scale = cur.s;
    let y = cur.y;
    if (look.kind === 'hole') {
      scale = Math.min(cur.s, 1.1) * look.sizeK;
      y = Math.max(cur.y, -0.55);
    } else {
      scale = cur.s * look.sizeK;
      // only a planet may sink below the page end as a horizon: a star, nebula or comet has no limb to leave in view
      if (look.kind !== 'planet') y = Math.max(y, -0.55);
      // a binary's companion orbits wide: keep the pair above the footer at the page end
      if (look.companion) y = Math.max(y, -0.45);
    } // not blended with x: the body must not swell as it crosses the page
    const radius = scale * look.size * Math.min(halfH, halfW);
    // a planet sinking to the page end shows a cap: keep its top at the middle of the screen whatever its size, so enough of it is seen
    if (look.kind === 'planet') y = Math.max(y, -0.05 - radius / halfH);
    y += stages.state.shift;

    if (group) {
      group.rotation.set(look.tilt[0] + pointer.y * 0.03, 0, look.tilt[1]);
      group.position.set((cur.x + look.shiftX * aside * Math.sign(cur.x)) * halfW + pointer.x * 0.06, y * halfH - pointer.y * 0.04, 0);
      group.scale.setScalar(radius);
      group.updateMatrixWorld();
      // where the bodies are on screen, for taps and drags
      const px = (v: Vector3) => ((v.x / halfW) * 0.5 + 0.5) * size.current.width;
      const py = (v: Vector3) => (0.5 - (v.y / halfH) * 0.5) * size.current.height;
      const pr = (r: number) => (r / halfH) * 0.5 * size.current.height;
      const c = group.localToWorld(look.kind === 'planet' ? probe.set(0, 0, 0) : probe.copy(u.primaryAt.value));
      stage.x = px(c);
      stage.y = py(c);
      stage.r = pr(radius * (look.kind === 'planet' || look.kind === 'hole' ? 1 : u.primaryR.value || 1));
      stage.binary = !!look.companion;
      if (look.companion) {
        const k = group.localToWorld(probe.copy(u.companionAt.value));
        stage.cx = px(k);
        stage.cy = py(k);
        stage.cr = pr(radius * (u.companionR.value || 1));
      }
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

    // a mouse drag turns the body; the push it leaves behind fades out
    drag += stage.drag;
    stage.drag = 0;
    angle += reduced ? 0 : dt * 0.05;
    angle -= drag * 0.4; // rotateY turns the sampling frame, so the sign is opposite to the surface
    drag *= Math.exp(-dt * 3);
    spin += (stages.state.scroll * 0.6 - spin) * (reduced ? 1 : 1 - Math.exp(-dt * 1.6));
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
    if (baker.phase === 'live' && !lockedAt) {
      lockedAt = performance.now();
      markLocked();
    }
    if (baker.phase !== 'live') lockedAt = 0;
    stepFocus();
    if (!lockedAt) snapped = false;
    else if (!snapped && performance.now() - lockedAt > 1200 && wantsThumb()) {
      snapped = true;
      snap();
    }
    if (acc > 0.4) {
      acc = 0;
      sim.cool = lockedAt ? Math.max(0, Math.ceil(COOLDOWN - (performance.now() - lockedAt) / 1000)) : COOLDOWN;
      sim.state = baker.state;
      sim.phase = baker.phase;
      sim.progress = baker.progress;
    }
  });

  const reseed = (e: Event) => {
    // the dial or the atlas may ask for a class by name, or bring back a world already seen
    const { kind, replay } = (e as CustomEvent<{ kind?: string; replay?: RollArgs }>).detail ?? {};
    if (baker.phase === 'live' && sim.cool > 0 && !kind && !replay) return;
    const go = () => {
      pending = 0;
      replaying = !!replay;
      baker.reseed(kind, undefined, replay);
    };
    clearTimeout(pending);
    // the old world tears, then the lens holds on the tuning screen a moment before the new one starts
    if (baker.phase === 'live' && !reduced) {
      grab(kind);
      pending = window.setTimeout(go, 1000);
    } else go();
  };
  let pending = 0;
  // the debug panel changed a baked uniform: bake the current world again, without rolling a new one
  const rebake = () => baker.rebake();
  onMount(() => {
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', poke, { passive: true });
    addEventListener('wheel', poke, { passive: true });
    addEventListener('touchmove', poke, { passive: true });
    addEventListener('planet:reseed', reseed);
    addEventListener('planet:rebake', rebake);
    stages.refresh();
    // a failed precompile only costs the old stalls: draw anyway
    precompile().catch(() => {}).finally(() => (compiled = true));
    return () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', poke);
      removeEventListener('wheel', poke);
      removeEventListener('touchmove', poke);
      removeEventListener('planet:reseed', reseed);
      removeEventListener('planet:rebake', rebake);
      stages.dispose();
      baker.dispose();
    };
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, CAMERA_Z]} fov={FOV} near={0.1} far={200} />
<!-- drawn after the opaque bodies, so the depth test skips every sky pixel they cover -->
<T.Mesh bind:ref={dome} geometry={domeGeometry} material={skyMaterial} renderOrder={10} frustumCulled={false} />
<Globe bind:group {look} {u} {materials} {baked} />
