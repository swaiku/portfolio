<script lang="ts">
  import Clock from './Clock.svelte';
  import { sim } from '../lib/planet/sim.svelte';

  let { status, base, tz, github }: { status: string; base: string; tz: string; github: string } = $props();
</script>

<footer class="foot">
  <p class="cell"><span class="dot" aria-hidden="true"></span>{status}</p>
  <p class="cell">Base <b>{base.split(',')[0]}</b> <Clock {tz} /></p>
  <p class="cell">Seed <b>{sim.seed}</b></p>
  <nav class="cell end" aria-label="Footer">
    <button type="button" onclick={() => dispatchEvent(new Event('planet:reseed'))}>Survey a new world ↻</button>
    <a href={github} rel="noopener">GitHub ↗</a>
    <a href="#top">Top ↑</a>
  </nav>
</footer>
