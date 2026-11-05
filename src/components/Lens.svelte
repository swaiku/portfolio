<script lang="ts">
  import Clock from './Clock.svelte';
  import { sim } from '../lib/planet/sim.svelte';
  import { loggedCount, openAtlas } from '../lib/atlas.svelte';
  import { TYPES } from '../lib/planet/archetypes';

  let { base, coords, tz }: { base: string; coords: string; tz: string } = $props();

  const odds = $derived(TYPES.find((t) => t.id === sim.typeId)?.weight);
  const locked = $derived(sim.state === 'LOCKED');

</script>

<div class="hud">
  <p class="corner tl">
    <span class="k hi">Target · {locked ? sim.name : sim.state === 'NO-GL' ? 'stand-in, no GPU' : 'acquiring'}</span>
    {#if locked}<span class="k">{sim.rarity}{odds ? ` · ${odds}% of rolls` : ''}</span>{/if}
    {#if sim.state !== 'NO-GL'}<span class="k" data-seed>Seed {sim.seed}</span>{/if}
  </p>
  <p class="corner tr">
    <span class="k hi">Ground station · {base}</span>
    <span class="k">{coords} · <Clock {tz} /></span>
  </p>
  <button type="button" class="k hi corner bl" onclick={openAtlas}>Atlas · {loggedCount()}/{TYPES.length} →</button>
  {#if locked}
    <button type="button" class="k hi corner br" disabled={sim.cool > 0} onclick={() => dispatchEvent(new Event('planet:reseed'))}>
      {sim.cool > 0 ? `Recalibrating ${sim.cool}s` : 'Roll a new world ↻'}
    </button>
  {:else if sim.state !== 'NO-GL'}
    <span class="k corner br" aria-live="polite">Surveying {Math.round(sim.progress * 100)}%</span>
  {/if}
</div>

<style>
  .hud { position: absolute; inset: 0; }
  .corner { position: absolute; margin: 0; display: flex; flex-direction: column; gap: 5px; }
  .tl { left: 50px; top: 24px; }
  .tr { right: 50px; top: 24px; align-items: flex-end; text-align: right; }
  .bl { left: 50px; bottom: 22px; }
  .br { right: 50px; bottom: 22px; }
  button { background: none; border: 0; padding: 6px 0; cursor: pointer; }
  button:hover:not(:disabled) { color: var(--color-amber); }
  button:disabled { opacity: 0.55; cursor: default; }
  @media (max-width: 1023px), (max-height: 679px) {
    .tl { left: 20px; top: 16px; }
    .tr { display: none; }
    .bl { left: 20px; bottom: 12px; }
    .br { right: 20px; bottom: 12px; }
  }
</style>
