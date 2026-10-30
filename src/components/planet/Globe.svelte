<script lang="ts">
  import { T } from '@threlte/core/webgpu';
  import type { Group, Material } from 'three/webgpu';
  import { RingGeometry, SphereGeometry } from 'three/webgpu';
  import { ATMO_RADIUS } from '../../lib/planet/tsl/atmosphere';
  import { CORONA_RADIUS } from '../../lib/planet/tsl/star';
  import Satellites from './Satellites.svelte';
  import type { Uniforms } from '../../lib/planet/uniforms';
  import type { WorldLook } from '../../lib/planet/uniforms';

  interface Props {
    group: Group | undefined;
    look: WorldLook;
    u: Uniforms;
    baked: boolean;
    materials: Record<'planet' | 'clouds' | 'atmosphere' | 'ring' | 'star' | 'corona' | 'hole' | 'nebula', Material>;
  }
  let { group = $bindable(), look, u, materials, baked }: Props = $props();
  // the primary star moves round the centre of mass in a binary, so it lives in a group of its own
  let primary = $state<Group>();

  const sphere = new SphereGeometry(1, 192, 128);
  // wide enough for any rolled ring; the material masks the real inner/outer radii
  const ringGeometry = new RingGeometry(1.1, 3.2, 192, 1).rotateX(-Math.PI / 2);
</script>

<!-- tilted frame; scale, position and spin are driven per frame by Scene -->
<T.Group bind:ref={group}>
  <T.Mesh geometry={sphere} material={materials.planet} renderOrder={0} visible={look.kind === 'planet' && baked} />
  <T.Mesh geometry={sphere} material={materials.clouds} scale={1.0075} renderOrder={1} visible={look.kind === 'planet' && look.clouds && baked} />
  <T.Mesh geometry={ringGeometry} material={materials.ring} renderOrder={1} visible={look.kind === 'planet' && look.ring} />
  <T.Mesh geometry={sphere} material={materials.atmosphere} scale={ATMO_RADIUS} renderOrder={2} visible={look.kind === 'planet'} />

  <T.Group bind:ref={primary}>
    <T.Mesh geometry={sphere} material={materials.star} scale={look.body} renderOrder={0} visible={look.kind === 'star'} />
    <T.Mesh geometry={sphere} material={materials.corona} scale={CORONA_RADIUS * look.body} renderOrder={2} visible={look.kind === 'star'} />
  </T.Group>

  <T.Mesh geometry={sphere} material={materials.hole} renderOrder={0} visible={look.kind === 'hole'} />

  <Satellites {look} {u} {materials} {primary} />
</T.Group>
