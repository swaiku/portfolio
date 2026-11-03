<script lang="ts">
  import Clock from './Clock.svelte';
  import { sim } from '../lib/planet/sim.svelte';
  import { atlas, loggedCount, openAtlas } from '../lib/atlas.svelte';
  import { TYPES } from '../lib/planet/archetypes';

  let { status, base, tz, github }: { status: string; base: string; tz: string; github: string } = $props();
</script>

<footer class="foot">
  <p class="cell"><span class="dot" aria-hidden="true"></span>{status}</p>
  <p class="cell">Base <b>{base.split(',')[0]}</b> <Clock {tz} /></p>
  <p class="cell" data-seed>Seed <b>{sim.seed}</b></p>
  <nav class="cell end" aria-label="Footer">
    <button type="button" onclick={openAtlas}>Atlas <b>{loggedCount()}/{TYPES.length}</b>{#if atlas.probes} · ◎{atlas.probes}{/if}</button>
    <button type="button" disabled={sim.state !== 'LOCKED' || sim.cool > 0} onclick={() => dispatchEvent(new Event('planet:reseed'))}>{sim.cool > 0 && sim.state === 'LOCKED' ? `Recalibrating ${sim.cool}s` : 'Survey a new world ↻'}</button>
    <a href={github} rel="noopener">GitHub ↗</a>
    <a href="#top">Top ↑</a>
  </nav>
</footer>
