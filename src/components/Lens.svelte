<script lang="ts">
  import Clock from './Clock.svelte';
  import { sim } from '../lib/planet/sim.svelte';
  import { atlas, openAtlas, seenCount, tune } from '../lib/atlas.svelte';
  import { TYPES } from '../lib/planet/archetypes';

  let { base, coords, tz }: { base: string; coords: string; tz: string } = $props();

  const odds = $derived(TYPES.find((t) => t.id === sim.typeId)?.weight);
  const locked = $derived(sim.state === 'LOCKED');

  // the tuning dial: one tick per class, taller the rarer it is, lit once seen
  const TALL = { common: 12, uncommon: 18, rare: 24, epic: 30, legendary: 36 };
  const code = (i: number) => `CL-${String(i + 1).padStart(2, '0')}`;
  const at = $derived(TYPES.findIndex((t) => t.id === sim.typeId));
  const ready = $derived(sim.state === 'LOCKED' || sim.state === 'SURVEY');
  const step = (d: number) => tune(TYPES[(Math.max(at, 0) + d + TYPES.length) % TYPES.length].id);
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
  <button type="button" class="k hi corner bl" onclick={openAtlas}>Atlas · {seenCount()}/{TYPES.length} →</button>
  {#if sim.state !== 'NO-GL'}
    <div class="dial" role="group" aria-label="Tune the lens to a class of world">
      <p class="k hi now" aria-live="polite">{locked && at >= 0 ? `${code(at)} · ${TYPES[at].label}` : 'Tuning…'}</p>
      <div class="scale">
        {#if at >= 0}<span class="needle" class:busy={!locked} style="--i: {at}" aria-hidden="true"></span>{/if}
        <button type="button" class="step" disabled={!ready} onclick={() => step(-1)} aria-label="Previous class">‹</button>
        {#each TYPES as t, i (t.id)}
          {@const seen = !!atlas.seen[t.id]}
          <button
            type="button"
            class="tick"
            class:seen
            class:on={i === at}
            style="--h: {TALL[t.rarity]}px"
            disabled={!ready}
            onclick={() => tune(t.id)}
            title={seen ? `${code(i)} · ${t.label}` : `${code(i)} · unsurveyed`}
            aria-label={seen ? `Tune to ${t.label}` : `Tune to ${code(i)}, a class not seen yet`}
          ><i></i></button>
        {/each}
        <button type="button" class="step" disabled={!ready} onclick={() => step(1)} aria-label="Next class">›</button>
      </div>
    </div>
  {/if}
  {#if locked}
    <button type="button" class="k hi corner br" disabled={sim.cool > 0} onclick={() => dispatchEvent(new Event('planet:reseed'))}>
      {sim.cool > 0 ? `Recalibrating ${sim.cool}s` : 'Roll a new world ↻'}
    </button>
  {:else if sim.state !== 'NO-GL'}
    <span class="k corner br" aria-live="polite">Surveying <span class="num">{Math.round(sim.progress * 100)}%</span></span>
  {/if}
</div>

<style>
  .hud { position: absolute; inset: 0; }
  .corner { position: absolute; margin: 0; display: flex; flex-direction: column; gap: 5px; }
  .tl { left: 50px; top: 24px; }
  .tr { right: 50px; top: 24px; align-items: flex-end; text-align: right; }
  .bl { left: 50px; bottom: 22px; }
  .br { right: 50px; bottom: 22px; }
  /* the bottom corners swap a button for a readout while a world bakes: same box, so nothing jumps */
  .bl, .br { display: block; padding: 6px 0; line-height: 1.5; }
  /* a fixed slot for the percentage: the label must not shuffle as the digits change */
  .num { display: inline-block; min-width: 4.2ch; text-align: right; }
  button { background: none; border: 0; padding: 6px 0; cursor: pointer; color: inherit; }

  .dial { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .now { margin: 0; white-space: nowrap; }
  .scale { --tick: 26px; --step: 34px; position: relative; display: flex; align-items: flex-end; }
  /* the needle glides to the tick the lens is tuned to, and breathes while the new world bakes */
  .needle {
    position: absolute; bottom: -7px; width: 14px; height: 3px; border-radius: 2px; background: var(--color-amber);
    left: calc(var(--step) + var(--i) * var(--tick) + var(--tick) / 2 - 7px);
    box-shadow: 0 0 10px var(--color-amber);
    transition: left 0.8s var(--ease-out-expo), background-color 0.8s;
  }
  .needle.busy { animation: breathe 1.1s ease-in-out infinite alternate; }
  @keyframes breathe { from { opacity: 1; } to { opacity: 0.25; } }
  @media (prefers-reduced-motion: reduce) { .needle { transition: none; } .needle.busy { animation: none; } }
  .tick { width: var(--tick); height: 46px; padding: 0; display: flex; align-items: flex-end; justify-content: center; }
  .tick i { display: block; width: 2px; height: var(--h); border-left: 2px dotted rgb(236 239 251 / 0.35); }
  .tick.seen i { border-left-style: solid; border-color: rgb(236 239 251 / 0.75); }
  .tick.on i { border-color: var(--color-amber); height: calc(var(--h) + 8px); }
  .tick:hover:not(:disabled) i { border-color: var(--color-amber); }
  .tick:focus-visible { outline-offset: -2px; }
  .step { width: var(--step); height: 46px; font: 400 1.4rem/1 var(--font-display); color: var(--color-ink); }
  .step:hover:not(:disabled) { color: var(--color-amber); }
  button:hover:not(:disabled) { color: var(--color-amber); }
  button:disabled { opacity: 0.55; cursor: default; }
  @media (max-width: 1023px), (max-height: 679px) {
    .tl { left: 20px; top: 16px; }
    .tr { display: none; }
    .bl { left: 20px; bottom: 96px; }
    .br { right: 20px; bottom: 96px; }
    .scale { --tick: 21px; --step: 28px; }
  }
</style>
