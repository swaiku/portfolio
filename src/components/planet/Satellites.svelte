<script lang="ts">
  import { T, useTask } from '@threlte/core/webgpu';
  import {
    CylinderGeometry, IcosahedronGeometry, InstancedMesh, Matrix3, Matrix4, Object3D, PlaneGeometry, SphereGeometry, Vector3,
  } from 'three/webgpu';
  import type { Group, Material, Mesh } from 'three/webgpu';
  import { uniform } from 'three/tsl';
  import { CORONA_RADIUS, createCoronaMaterial, createStarMaterial } from '../../lib/planet/tsl/star';
  import { BEAM_LENGTH, createBeamMaterial, createGalaxyMaterial, createMoonMaterial, createRockMaterial } from '../../lib/planet/tsl/space';
  import { COMET_HALF_WIDTH, COMET_HEAD_OVERHANG, COMET_LENGTH, createCometMaterial } from '../../lib/planet/tsl/comet';
  import type { Uniforms, WorldLook } from '../../lib/planet/uniforms';
  import { quality } from '../../lib/planet/quality.svelte';

  let { look, u, materials, primary }: { look: WorldLook; u: Uniforms; materials: Record<string, Material>; primary: Group | undefined } = $props();

  // everything here lives in the planet's own frame (unit = planet radius), so it follows the tilt and the scale
  // one material per moon slot, re-dressed from the world's moon list whenever it changes
  const slots = [0, 1, 2].map(() => {
    const tint = uniform(new Vector3(0.5, 0.5, 0.5));
    const style = uniform(0);
    const seed = uniform(0);
    return { tint, style, seed, material: createMoonMaterial(u, tint, style, seed) };
  });
  $effect(() => {
    look.moons.forEach((m, i) => {
      const slot = slots[i];
      if (!slot) return;
      slot.tint.value.copy(m.color);
      slot.style.value = m.style;
      slot.seed.value = m.seed;
    });
  });
  const beltRock = createRockMaterial(u, 5.5);
  // a beam is brightest when it points at us: the lighthouse effect, kept gentle
  const beamGain = uniform(1);
  const beamGain2 = uniform(1);
  const beam = createBeamMaterial(u, u.ramp, beamGain);
  // narrow at the star, flaring a little toward the far end; one cone per pole, baked in the beam frame (+Y and -Y)
  const beamUp = new CylinderGeometry(0.15, 0.012, BEAM_LENGTH, 32, 1, true).translate(0, BEAM_LENGTH / 2, 0);
  const beamDown = new CylinderGeometry(0.15, 0.012, BEAM_LENGTH, 32, 1, true).rotateX(Math.PI).translate(0, -BEAM_LENGTH / 2, 0);
  let spinner = $state<Group>();
  let spinner2 = $state<Group>();
  const comet = createCometMaterial(u);
  const cometSheet = new PlaneGeometry(COMET_LENGTH + COMET_HEAD_OVERHANG, COMET_HALF_WIDTH * 2)
    .translate((COMET_LENGTH - COMET_HEAD_OVERHANG) / 2, 0, 0);
  const nebulaPlane = new PlaneGeometry(2.6 * 1.2, 2.6);
  let nebulaMesh = $state<Mesh>();
  // fewer stars on a weak device; the sprites are small, so the count is what costs
  const galaxy = new InstancedMesh(new PlaneGeometry(1, 1), createGalaxyMaterial(u), { off: 1, low: 12000, mid: 24000, high: 45000 }[quality.tier]);
  galaxy.frustumCulled = false; // every instance sits at the origin as far as three.js knows
  galaxy.rotation.x = 1.08; // the disk leans toward the camera

  // the second star of a binary: its own colours, spin and pulsar poles, so it need not be the primary's twin
  const compRamp = Array.from({ length: 5 }, () => uniform(new Vector3()));
  const compRot = uniform(new Matrix3());
  const compPulsar = uniform(0);
  const compTilt = uniform(0.8);
  const compRadius = uniform(1);
  const companionStar = createStarMaterial(u, { ramp: compRamp, rot: compRot, pulsar: compPulsar, tilt: compTilt, phase: 2.1, flares: false });
  const companionCorona = createCoronaMaterial(u, {
    center: u.companionAt, scale: compRadius, ramp: compRamp, occluder: { center: u.primaryAt, radius: u.primaryR }, phase: 2.1, flares: false,
  });
  const companionBeam = createBeamMaterial(u, compRamp, beamGain2);
  $effect(() => {
    const c = look.companion;
    if (!c) return;
    c.ramp.forEach((col, i) => compRamp[i].value.copy(col));
    compPulsar.value = c.pulsar ? 1 : 0;
    compTilt.value = c.tilt;
    compRadius.value = c.radius;
  });
  const camDir = new Vector3();
  /** How squarely a beam axis, tilted `tilt` from the spin axis and turned `angle` about it, points at the camera: 0 to 1. */
  const alignment = (tilt: number, angle: number) => {
    camDir.copy(u.camL.value).normalize();
    const along = Math.sin(tilt) * Math.sin(angle) * camDir.x + Math.cos(tilt) * camDir.y + Math.sin(tilt) * Math.cos(angle) * camDir.z;
    return Math.abs(along);
  };
  const rotateY = (m: Matrix3, a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    m.set(c, 0, s, 0, 1, 0, -s, 0, c);
  };

  const sphere = new SphereGeometry(1, 48, 32);
  const rockGeometry = new IcosahedronGeometry(1, 1);

  const BELT_ROCKS = 1600; // many small rocks rather than a few boulders: a belt is mostly rubble
  const belt = new InstancedMesh(rockGeometry, beltRock, BELT_ROCKS);
  belt.frustumCulled = false;
  const dummy = new Object3D();
  $effect(() => {
    const b = look.belt;
    if (!b) return;
    let a = b.seed;
    const rnd = () => ((a = (Math.imul(a, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
    for (let i = 0; i < BELT_ROCKS; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = b.inner + (b.outer - b.inner) * (0.15 + 0.7 * rnd() + 0.15 * rnd());
      dummy.position.set(Math.cos(ang) * rad, (rnd() - 0.5) * 0.07 * (1 + (rad - b.inner)), Math.sin(ang) * rad);
      dummy.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
      const s = 0.004 + rnd() ** 4 * 0.03;
      dummy.scale.set(s * (0.7 + rnd() * 0.6), s * (0.5 + rnd() * 0.5), s * (0.7 + rnd() * 0.6)); // lumps, not balls
      dummy.updateMatrix();
      belt.setMatrixAt(i, dummy.matrix);
    }
    belt.instanceMatrix.needsUpdate = true;
  });

  let moonMeshes: Mesh[] = [];
  let companion = $state<Mesh>();
  let companionGlow = $state<Mesh>();
  let cometMesh = $state<Mesh>();
  const away = new Vector3();
  const across = new Vector3();
  const facing = new Vector3();
  const basis = new Matrix4();

  useTask(() => {
    const t = u.clock.value;
    look.moons.forEach((m, i) => {
      const mesh = moonMeshes[i];
      if (!mesh) return;
      const a = m.phase + t * m.speed * 6;
      mesh.position.set(Math.cos(a) * m.orbit, Math.sin(a) * m.orbit * Math.sin(m.incline), Math.sin(a) * m.orbit * Math.cos(m.incline));
    });
    if (look.belt) belt.rotation.y = t * 0.02;
    if (look.kind === 'nebula' && nebulaMesh) nebulaMesh.lookAt(0, 0, 10); // the picture always faces the camera
    const c = look.companion;
    if (c) {
      // both stars circle the centre of mass, on opposite sides of it
      const a = c.phase + t * c.omega;
      const x = Math.cos(a);
      const z = Math.sin(a) * Math.cos(c.incline);
      const y = Math.sin(a) * Math.sin(c.incline);
      u.primaryAt.value.set(-x * c.r1, -y * c.r1, -z * c.r1);
      u.companionAt.value.set(x * c.r2, y * c.r2, z * c.r2);
      rotateY(compRot.value, -t * c.spin);
      if (spinner2) {
        spinner2.position.copy(u.companionAt.value);
        spinner2.rotation.y = t * c.spin;
      }
      beamGain2.value = 0.72 + 0.28 * Math.pow(alignment(c.tilt, t * c.spin), 2.5);
    }
    primary?.position.copy(u.primaryAt.value);
    if (spinner) {
      spinner.position.copy(u.primaryAt.value);
      spinner.rotation.y = t * look.spin;
      beamGain.value = 0.72 + 0.28 * Math.pow(alignment(look.beamTilt, t * look.spin), 2.5);
    }
    if (companion) companion.position.copy(u.companionAt.value);
    if (companionGlow) companionGlow.position.copy(u.companionAt.value);
    if (look.kind === 'comet' && cometMesh) {
      // the sheet's x axis runs down the tail (away from the sun) and its face turns toward the camera
      away.copy(u.sunL.value).negate().normalize();
      across.crossVectors(u.camL.value, away).normalize();
      facing.crossVectors(away, across);
      cometMesh.quaternion.setFromRotationMatrix(basis.makeBasis(away, across, facing));
    }
  });
</script>

{#each look.moons as moon, i}
  <T.Mesh bind:ref={moonMeshes[i]} geometry={sphere} material={slots[i % slots.length].material} scale={moon.size} renderOrder={1} />
{/each}

<T is={belt} visible={!!look.belt} renderOrder={1} />

<T.Mesh bind:ref={companion} geometry={sphere} material={companionStar} scale={look.companion?.radius ?? 1} renderOrder={0} visible={!!look.companion} />
<T.Mesh bind:ref={companionGlow} geometry={sphere} material={companionCorona} scale={CORONA_RADIUS * (look.companion?.radius ?? 1)} renderOrder={2} visible={!!look.companion} />

<!-- the magnetic axis leans away from the spin axis, so the beams sweep a cone like a lighthouse -->
<T.Group bind:ref={spinner} visible={look.jets}>
  <T.Group rotation.x={look.beamTilt}>
    <T.Mesh geometry={beamUp} material={beam} renderOrder={3} />
    <T.Mesh geometry={beamDown} material={beam} renderOrder={3} />
  </T.Group>
</T.Group>
<T.Group bind:ref={spinner2} visible={look.jets && !!look.companion}>
  <T.Group rotation.x={look.companion?.tilt ?? 0}>
    <T.Mesh geometry={beamUp} material={companionBeam} renderOrder={3} />
    <T.Mesh geometry={beamDown} material={companionBeam} renderOrder={3} />
  </T.Group>
</T.Group>
<T.Mesh bind:ref={nebulaMesh} geometry={nebulaPlane} material={materials.nebula} renderOrder={2} visible={look.kind === 'nebula' && !look.galaxy} />
<T is={galaxy} visible={!!look.galaxy} renderOrder={2} />

<T.Mesh bind:ref={cometMesh} geometry={cometSheet} material={comet} renderOrder={3} visible={look.kind === 'comet'} />
