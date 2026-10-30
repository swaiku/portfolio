<script lang="ts">
  import { T } from '@threlte/core/webgpu';
  import type { Group, Material } from 'three/webgpu';
  import { RingGeometry, SphereGeometry } from 'three/webgpu';
  import { ATMO_RADIUS } from '../../lib/planet/tsl/atmosphere';
  import { CORONA_RADIUS } from '../../lib/planet/tsl/star';
  import type { WorldLook } from '../../lib/planet/uniforms';

  interface Props {
    group: Group | undefined;
    look: WorldLook;
    materials: Record<'planet' | 'clouds' | 'atmosphere' | 'ring' | 'star' | 'corona' | 'hole', Material>;
  }
  let { group = $bindable(), look, materials }: Props = $props();

  const sphere = new SphereGeometry(1, 192, 128);
  // wide enough for any rolled ring; the material masks the real inner/outer radii
  const ringGeometry = new RingGeometry(1.1, 3.2, 192, 1).rotateX(-Math.PI / 2);
</script>

<!-- tilted frame; scale, position and spin are driven per frame by Scene -->
<T.Group bind:ref={group}>
  <T.Mesh geometry={sphere} material={materials.planet} renderOrder={0} visible={look.kind === 'planet'} />
  <T.Mesh geometry={sphere} material={materials.clouds} scale={1.0075} renderOrder={1} visible={look.kind === 'planet' && look.clouds} />
  <T.Mesh geometry={ringGeometry} material={materials.ring} renderOrder={1} visible={look.kind === 'planet' && look.ring} />
  <T.Mesh geometry={sphere} material={materials.atmosphere} scale={ATMO_RADIUS} renderOrder={2} visible={look.kind === 'planet'} />

  <T.Mesh geometry={sphere} material={materials.star} renderOrder={0} visible={look.kind === 'star'} />
  <T.Mesh geometry={sphere} material={materials.corona} scale={CORONA_RADIUS} renderOrder={2} visible={look.kind === 'star'} />

  <T.Mesh geometry={sphere} material={materials.hole} renderOrder={0} visible={look.kind === 'hole'} />
</T.Group>
