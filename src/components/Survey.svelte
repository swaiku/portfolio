<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import { sim } from '../lib/planet/sim.svelte';

  const STAGES: Record<string, string> = {
    sky: 'Mapping the sky',
    nebula: 'Condensing the nebula',
    planet: 'Baking the terrain',
    clouds: 'Seeding the clouds',
    fadein: 'Bringing it into view',
  };

  let list = $state<HTMLElement>();
  let head = $state<HTMLElement>();
  let seen = $state(0); // how many facts have been read out so far
  let seed = '';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const acquired = $derived(sim.seed !== '------');
  const locked = $derived(acquired && sim.state === 'LOCKED');
  const total = $derived(sim.facts.length);

  // facts surface as the bake advances, so the wait is spent reading rather than watching a bar
  $effect(() => {
    if (!acquired) return;
    const n = locked ? total : Math.min(total - 1, Math.floor(sim.progress * total));
    if (n > seen) seen = n;
  });

  // a new world: clear the old readout, then let the new one fill in
  $effect(() => {
    if (!acquired || sim.seed === seed) return;
    seed = sim.seed;
    seen = 0;
  });

  // each fact eases in once, as it is read out
  const shown = new WeakSet<Element>();
  $effect(() => {
    if (!list) return;
    const rows = Array.from(list.children);
    const live = acquired ? seen : 0;
    rows.forEach((row, i) => {
      if (i < live && !shown.has(row)) {
        shown.add(row);
        if (reduced) gsap.set(row, { opacity: 1, y: 0 });
        else gsap.to(row, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' });
      } else if (i >= live && shown.has(row)) {
        shown.delete(row);
        gsap.set(row, { opacity: 0, y: 6 });
      }
    });
  });

  // the name and class settle in as soon as the world is rolled
  $effect(() => {
    if (!acquired || !head) return;
    sim.seed;
    if (reduced) gsap.set(head, { opacity: 1, y: 0 });
    else gsap.fromTo(head, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', overwrite: true });
  });

  onMount(() => () => gsap.killTweensOf([head, list?.children]));
</script>

<div class="survey">
  <p class="meta" bind:this={head}>
    Now surveying <b>{acquired ? sim.name : '…'}</b>
    {#if acquired}<span class="sub">{sim.kind}{sim.traits ? `, ${sim.traits}` : ''} <span class="tag" data-rarity={sim.rarity}>{sim.rarity}</span></span>{/if}
  </p>

  <ul class="rows" bind:this={list} aria-label="World data">
    {#each sim.facts as f (f.k)}
      <li class="row"><span class="k">{f.k}</span><span class="v">{f.v}</span></li>
    {/each}
  </ul>

  <p class="meta action">
    {#if locked}
      <button class="link" type="button" onclick={() => dispatchEvent(new Event('planet:reseed'))}>Survey a new world</button>
    {:else}
      {STAGES[sim.phase] ?? 'Starting up'}…
    {/if}
  </p>
</div>

<style>
  .survey { margin-top: 40px; }
  p { margin: 0; }
  .meta b { font-weight: 500; color: var(--color-amber); }
  .sub { display: block; margin-top: 6px; color: var(--color-dim); }
  .tag {
    display: inline-block; margin-left: 6px; padding: 2px 8px;
    border: 1px solid currentColor; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--r, #dfe3f7);
    background: color-mix(in srgb, currentColor 14%, transparent);
  }
  .tag[data-rarity='uncommon'] { --r: #6fdca0; }
  .tag[data-rarity='rare'] { --r: #8fc7ff; }
  .tag[data-rarity='epic'] { --r: #c39bff; }
  .tag[data-rarity='legendary'] { --r: #ffb84d; }
  .rows { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 2px; min-height: 12.5rem; align-content: start; }
  .row {
    display: grid;
    grid-template-columns: 7.2rem 1fr;
    gap: 0 14px;
    opacity: 0;
    transform: translateY(6px);
    font: 400 0.74rem/1.6 var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .k { color: var(--color-dim); }
  .v { color: var(--color-ink-2); }
  .action { margin-top: 14px; min-height: 1.6rem; }
  .action .link { background: none; border: 0; padding: 0; cursor: pointer; }
  @media (max-width: 760px) {
    .survey { margin-top: 28px; }
    .rows { min-height: 0; }
    .row:nth-child(n + 6) { display: none; }
  }
</style>
